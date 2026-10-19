"""
NetGuard AI - Resilient Storage Layer
Supports local SQLite storage and MongoDB Atlas fallback with identical document APIs.
"""

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_PATH = DB_DIR / "netguard.db"

_lock = threading.RLock()


def _get_nested_val(data: dict, key_path: str) -> Any:
    """Retrieve value from dot-separated key path like 'decision.status'."""
    parts = key_path.split(".")
    curr = data
    for part in parts:
        if isinstance(curr, dict) and part in curr:
            curr = curr[part]
        else:
            return None
    return curr


def _set_nested_val(data: dict, key_path: str, val: Any) -> None:
    """Set value in dot-separated key path like 'ai_analysis.random_forest_status'."""
    parts = key_path.split(".")
    curr = data
    for part in parts[:-1]:
        if part not in curr or not isinstance(curr[part], dict):
            curr[part] = {}
        curr = curr[part]
    curr[parts[-1]] = val


class SQLiteCursor:
    """Mock MongoDB Cursor for SQLite results."""

    def __init__(self, records: List[Dict[str, Any]]):
        self._records = list(records)

    def sort(self, key_or_list, direction: int = 1):
        if isinstance(key_or_list, list):
            key, direction = key_or_list[0]
        else:
            key = key_or_list

        reverse = direction == -1 or direction == "desc"

        def sort_key(doc):
            if key == "_id":
                ts = _get_nested_val(doc, "metrics.timestamp") or doc.get("_created_at") or doc.get("timestamp")
                if ts:
                    return str(ts)
                return str(doc.get("_id", ""))
            val = _get_nested_val(doc, key)
            if val is None:
                return ""
            if isinstance(val, datetime):
                return val.isoformat()
            return str(val)

        self._records.sort(key=sort_key, reverse=reverse)
        return self

    def limit(self, count: int):
        self._records = self._records[:count]
        return self

    def __iter__(self):
        return iter(self._records)

    def __len__(self):
        return len(self._records)

    def __getitem__(self, item):
        return self._records[item]


class SQLiteCollection:
    """MongoDB Collection compatibility layer over SQLite."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with _lock, self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS monitoring_records (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_monitoring_created_at 
                ON monitoring_records(created_at)
                """
            )
            conn.commit()

    def _matches_filter(self, doc: dict, query_filter: dict) -> bool:
        if not query_filter:
            return True

        for key, expected in query_filter.items():
            if key == "_id":
                if str(doc.get("_id")) != str(expected):
                    return False
                continue

            actual = _get_nested_val(doc, key)

            if isinstance(expected, dict):
                if "$exists" in expected:
                    exists = actual is not None
                    if exists != expected["$exists"]:
                        return False
                if "$in" in expected:
                    if actual not in expected["$in"]:
                        return False
            else:
                if actual != expected:
                    return False

        return True

    def _project(self, doc: dict, projection: Optional[dict]) -> dict:
        if not projection:
            return doc
        projected = {}
        include_mode = any(v == 1 for k, v in projection.items() if k != "_id")
        if include_mode:
            if projection.get("_id", 1) == 1:
                projected["_id"] = doc.get("_id")
            for k, v in projection.items():
                if v == 1 and k != "_id":
                    val = _get_nested_val(doc, k)
                    if val is not None:
                        _set_nested_val(projected, k, val)
            return projected
        return doc

    def insert_one(self, document: dict):
        with _lock:
            doc_copy = dict(document)
            if "_id" not in doc_copy:
                doc_copy["_id"] = str(uuid.uuid4())
            else:
                doc_copy["_id"] = str(doc_copy["_id"])

            serialized = json.dumps(doc_copy, default=str)
            with self._get_conn() as conn:
                conn.execute(
                    "INSERT INTO monitoring_records (id, data) VALUES (?, ?)",
                    (doc_copy["_id"], serialized),
                )
                conn.commit()

            class InsertResult:
                def __init__(self, inserted_id):
                    self.inserted_id = inserted_id

            return InsertResult(doc_copy["_id"])

    def find(self, query_filter: Optional[dict] = None, projection: Optional[dict] = None) -> SQLiteCursor:
        query_filter = query_filter or {}
        with _lock, self._get_conn() as conn:
            cur = conn.execute("SELECT id, data, created_at FROM monitoring_records ORDER BY created_at ASC")
            rows = cur.fetchall()

        matched = []
        for row in rows:
            try:
                doc = json.loads(row["data"])
                doc["_id"] = row["id"]
                doc["_created_at"] = row["created_at"]
                if self._matches_filter(doc, query_filter):
                    matched.append(self._project(doc, projection))
            except Exception:
                continue

        return SQLiteCursor(matched)

    def find_one(self, query_filter: Optional[dict] = None, projection: Optional[dict] = None, sort=None) -> Optional[dict]:
        cursor = self.find(query_filter, projection)
        if sort:
            cursor.sort(sort)
        records = list(cursor)
        return records[0] if records else None

    def update_one(self, query_filter: dict, update_statement: dict, upsert: bool = False):
        with _lock:
            doc = self.find_one(query_filter)
            if not doc:
                if upsert:
                    new_doc = dict(query_filter)
                    if "$set" in update_statement:
                        for k, v in update_statement["$set"].items():
                            _set_nested_val(new_doc, k, v)
                    return self.insert_one(new_doc)
                return None

            doc_id = str(doc["_id"])
            if "$set" in update_statement:
                for k, v in update_statement["$set"].items():
                    _set_nested_val(doc, k, v)

            serialized = json.dumps(doc, default=str)
            with self._get_conn() as conn:
                conn.execute(
                    "UPDATE monitoring_records SET data = ? WHERE id = ?",
                    (serialized, doc_id),
                )
                conn.commit()


class StorageManager:
    """Manages system database tables for alerts, devices, logs, and settings."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_tables()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_tables(self):
        with _lock, self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    source TEXT NOT NULL,
                    acknowledged INTEGER DEFAULT 0,
                    resolved INTEGER DEFAULT 0,
                    resolved_at TEXT,
                    acknowledged_at TEXT,
                    metadata TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS devices (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    ip TEXT NOT NULL,
                    role TEXT NOT NULL,
                    status TEXT NOT NULL,
                    latency_ms REAL,
                    last_seen TEXT NOT NULL,
                    metadata TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS system_logs (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    level TEXT NOT NULL,
                    source TEXT NOT NULL,
                    message TEXT NOT NULL,
                    details TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

            # Seed default devices if empty
            cur = conn.execute("SELECT COUNT(*) as count FROM devices")
            if cur.fetchone()["count"] == 0:
                now = datetime.now(timezone.utc).isoformat()
                default_devices = [
                    ("dev-host-01", "Host System (Collector Agent)", "127.0.0.1", "Monitoring Host", "ONLINE", 0.1, now, json.dumps({"os": "Darwin / macOS", "type": "Host Machine"})),
                    ("dev-gw-01", "Default Network Gateway", "192.168.1.1", "Default Gateway", "ONLINE", 2.4, now, json.dumps({"interface": "en0", "type": "Gateway"})),
                    ("dev-dns-01", "Primary DNS Resolver (Google)", "8.8.8.8", "DNS Resolver", "ONLINE", 14.2, now, json.dumps({"provider": "Google Public DNS", "type": "DNS Server"})),
                    ("dev-dns-02", "Secondary DNS Resolver (Cloudflare)", "1.1.1.1", "DNS Resolver", "ONLINE", 11.8, now, json.dumps({"provider": "Cloudflare DNS", "type": "DNS Server"})),
                ]
                conn.executemany(
                    "INSERT INTO devices (id, name, ip, role, status, latency_ms, last_seen, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    default_devices,
                )
                conn.commit()

            # Seed default settings if empty
            cur = conn.execute("SELECT COUNT(*) as count FROM settings")
            if cur.fetchone()["count"] == 0:
                defaults = {
                    "auto_refresh": True,
                    "refresh_interval": 5,
                    "cpu_warning_threshold": 80.0,
                    "cpu_critical_threshold": 95.0,
                    "memory_warning_threshold": 85.0,
                    "latency_warning_threshold": 100.0,
                    "active_collector": True,
                }
                now = datetime.now(timezone.utc).isoformat()
                for k, v in defaults.items():
                    conn.execute(
                        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                        (k, json.dumps(v), now),
                    )
                conn.commit()

    def add_alert(self, severity: str, title: str, message: str, source: str = "System", metadata: Optional[dict] = None) -> str:
        alert_id = f"alt-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        with _lock, self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO alerts (id, timestamp, severity, title, message, source, acknowledged, resolved, metadata)
                VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
                """,
                (alert_id, now, severity.upper(), title, message, source, json.dumps(metadata or {})),
            )
            conn.commit()
        self.add_log(severity.upper(), source, f"Alert created: [{severity.upper()}] {title} - {message}")
        return alert_id

    def get_alerts(self, limit: int = 50, severity: Optional[str] = None, include_resolved: bool = True) -> List[Dict[str, Any]]:
        with _lock, self._get_conn() as conn:
            query = "SELECT * FROM alerts WHERE 1=1"
            params = []
            if severity:
                query += " AND severity = ?"
                params.append(severity.upper())
            if not include_resolved:
                query += " AND resolved = 0"
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)

            cur = conn.execute(query, params)
            rows = cur.fetchall()

        alerts = []
        for r in rows:
            alerts.append({
                "id": r["id"],
                "timestamp": r["timestamp"],
                "severity": r["severity"],
                "title": r["title"],
                "message": r["message"],
                "source": r["source"],
                "acknowledged": bool(r["acknowledged"]),
                "resolved": bool(r["resolved"]),
                "resolved_at": r["resolved_at"],
                "acknowledged_at": r["acknowledged_at"],
                "metadata": json.loads(r["metadata"] or "{}"),
            })
        return alerts

    def acknowledge_alert(self, alert_id: str) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with _lock, self._get_conn() as conn:
            cur = conn.execute(
                "UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE id = ?",
                (now, alert_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def resolve_alert(self, alert_id: str) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with _lock, self._get_conn() as conn:
            cur = conn.execute(
                "UPDATE alerts SET resolved = 1, resolved_at = ? WHERE id = ?",
                (now, alert_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def add_log(self, level: str, source: str, message: str, details: Optional[dict] = None) -> str:
        log_id = f"log-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        with _lock, self._get_conn() as conn:
            conn.execute(
                "INSERT INTO system_logs (id, timestamp, level, source, message, details) VALUES (?, ?, ?, ?, ?, ?)",
                (log_id, now, level.upper(), source, message, json.dumps(details or {})),
            )
            conn.commit()
        return log_id

    def get_logs(self, limit: int = 100, level: Optional[str] = None, source: Optional[str] = None) -> List[Dict[str, Any]]:
        with _lock, self._get_conn() as conn:
            query = "SELECT * FROM system_logs WHERE 1=1"
            params = []
            if level:
                query += " AND level = ?"
                params.append(level.upper())
            if source:
                query += " AND source = ?"
                params.append(source)
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)

            cur = conn.execute(query, params)
            rows = cur.fetchall()

        logs = []
        for r in rows:
            logs.append({
                "id": r["id"],
                "timestamp": r["timestamp"],
                "level": r["level"],
                "source": r["source"],
                "message": r["message"],
                "details": json.loads(r["details"] or "{}"),
            })
        return logs

    def get_devices(self) -> List[Dict[str, Any]]:
        with _lock, self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM devices ORDER BY name ASC")
            rows = cur.fetchall()

        devices = []
        for r in rows:
            devices.append({
                "id": r["id"],
                "name": r["name"],
                "ip": r["ip"],
                "role": r["role"],
                "status": r["status"],
                "latency_ms": r["latency_ms"],
                "last_seen": r["last_seen"],
                "metadata": json.loads(r["metadata"] or "{}"),
            })
        return devices

    def register_device(self, name: str, ip: str, role: str = "Endpoint", metadata: Optional[dict] = None) -> str:
        dev_id = f"dev-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        with _lock, self._get_conn() as conn:
            conn.execute(
                "INSERT INTO devices (id, name, ip, role, status, latency_ms, last_seen, metadata) VALUES (?, ?, ?, ?, 'UNKNOWN', NULL, ?, ?)",
                (dev_id, name, ip, role, now, json.dumps(metadata or {})),
            )
            conn.commit()
        self.add_log("INFO", "DeviceManager", f"Registered new device {name} ({ip})")
        return dev_id

    def update_device_status(self, device_id: str, status: str, latency_ms: Optional[float] = None) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with _lock, self._get_conn() as conn:
            cur = conn.execute(
                "UPDATE devices SET status = ?, latency_ms = ?, last_seen = ? WHERE id = ?",
                (status.upper(), latency_ms, now, device_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def delete_device(self, device_id: str) -> bool:
        with _lock, self._get_conn() as conn:
            cur = conn.execute("DELETE FROM devices WHERE id = ?", (device_id,))
            conn.commit()
            return cur.rowcount > 0

    def get_settings(self) -> Dict[str, Any]:
        with _lock, self._get_conn() as conn:
            cur = conn.execute("SELECT key, value FROM settings")
            rows = cur.fetchall()

        settings = {}
        for r in rows:
            try:
                settings[r["key"]] = json.loads(r["value"])
            except Exception:
                settings[r["key"]] = r["value"]
        return settings

    def update_settings(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with _lock, self._get_conn() as conn:
            for k, v in updates.items():
                conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                    (k, json.dumps(v), now),
                )
            conn.commit()
        self.add_log("INFO", "Settings", f"Updated system settings: {list(updates.keys())}")
        return self.get_settings()

    def health_check(self) -> Dict[str, Any]:
        """Perform a health and telemetry probe on the storage engine."""
        try:
            with _lock, self._get_conn() as conn:
                cur = conn.execute("SELECT 1")
                ok = cur.fetchone() is not None
                alert_count = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
                dev_count = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
            return {
                "connected": ok,
                "backend": "sqlite",
                "db_path": str(self.db_path),
                "stats": {
                    "alerts_count": alert_count,
                    "devices_count": dev_count,
                },
            }
        except Exception as e:
            return {
                "connected": False,
                "backend": "sqlite",
                "error": str(e),
                "stats": {},
            }

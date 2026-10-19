"""
NetGuard AI - FastAPI Application Server
Enterprise Network Monitoring, Telemetry Ingestion, Anomaly Detection & AI Decision Engine.
"""

import csv
import io
import os
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai.service import run_full_inference
from database.connection import (
    get_db_info,
    monitoring_collection,
    save_metrics,
    storage_manager,
    test_connection,
)
from monitoring.collector import collect_metrics
from monitoring.latency_monitor import get_latency

from contextlib import asynccontextmanager

# ============================================================
# BACKGROUND TELEMETRY COLLECTOR & LIFESPAN
# ============================================================

_collector_running = False
_collector_thread = None
_last_collection_time: Optional[str] = None


def _background_collector_loop():
    global _collector_running, _last_collection_time
    while _collector_running:
        try:
            settings = storage_manager.get_settings()
            if settings.get("active_collector", True):
                metrics = collect_metrics()
                doc_id = save_metrics(metrics)
                _last_collection_time = metrics.get("timestamp")

                # Evaluate thresholds for automated alerts
                cpu = metrics.get("cpu_usage_percent", 0)
                mem = metrics.get("memory_usage_percent", 0)
                lat = metrics.get("latency_ms")

                cpu_warn = settings.get("cpu_warning_threshold", 80.0)
                cpu_crit = settings.get("cpu_critical_threshold", 95.0)
                mem_warn = settings.get("memory_warning_threshold", 85.0)
                lat_warn = settings.get("latency_warning_threshold", 100.0)

                if cpu >= cpu_crit:
                    storage_manager.add_alert(
                        "CRITICAL",
                        "CPU Utilization Critical",
                        f"Host CPU reached {cpu:.1f}% (threshold {cpu_crit:.1f}%)",
                        source="Threshold Monitor",
                    )
                elif cpu >= cpu_warn:
                    storage_manager.add_alert(
                        "WARNING",
                        "High CPU Utilization",
                        f"Host CPU reached {cpu:.1f}% (threshold {cpu_warn:.1f}%)",
                        source="Threshold Monitor",
                    )

                if mem >= mem_warn:
                    storage_manager.add_alert(
                        "WARNING",
                        "High Memory Consumption",
                        f"Host RAM reached {mem:.1f}% (threshold {mem_warn:.1f}%)",
                        source="Threshold Monitor",
                    )

                if lat is not None and lat >= lat_warn:
                    storage_manager.add_alert(
                        "WARNING",
                        "High Network Latency",
                        f"Network round-trip latency reached {lat:.1f} ms (threshold {lat_warn:.1f} ms)",
                        source="Latency Monitor",
                    )

                # Periodically trigger AI analysis (e.g., every cycle)
                run_full_inference(metrics)

            interval = max(2, int(settings.get("refresh_interval", 5)))
            time.sleep(interval)
        except Exception:
            time.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _collector_running, _collector_thread
    _collector_running = True
    _collector_thread = threading.Thread(target=_background_collector_loop, daemon=True)
    _collector_thread.start()
    storage_manager.add_log("INFO", "Server", "NetGuard AI backend started successfully")
    yield
    _collector_running = False
    storage_manager.add_log("INFO", "Server", "NetGuard AI backend shutting down")


app = FastAPI(
    title="NetGuard AI API",
    description="Intelligent Network Telemetry, Anomaly Detection & Self-Healing Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ============================================================
# CORS CONFIGURATION
# ============================================================

cors_env = os.getenv("CORS_ORIGINS", "")
extra_origins = [orig.strip() for orig in cors_env.split(",") if orig.strip()]

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
] + extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROOT & HEALTH
# ============================================================


@app.get("/")
def root():
    return {
        "project": "NetGuard AI",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
def health_check():
    db_info = get_db_info()
    return {
        "status": "healthy" if db_info["connected"] else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_info,
        "collector": {
            "running": _collector_running,
            "last_collected_at": _last_collection_time,
        },
        "version": "1.0.0",
    }


# ============================================================
# METRICS & TELEMETRY
# ============================================================


@app.get("/metrics")
def get_latest_metrics():
    """Return the most recent monitoring record from database."""
    latest = monitoring_collection.find_one({}, sort=[("_id", -1)])
    if not latest:
        # If no records exist, take an initial reading immediately
        metrics = collect_metrics()
        save_metrics(metrics)
        latest = monitoring_collection.find_one({}, sort=[("_id", -1)])

    if not latest:
        return {"status": "no_data", "message": "No monitoring data found"}

    latest["_id"] = str(latest.get("_id", ""))
    return latest


@app.post("/metrics/collect")
def trigger_collect():
    """Trigger an immediate live telemetry collection cycle."""
    metrics = collect_metrics()
    doc_id = save_metrics(metrics)
    ai_result = run_full_inference(metrics)
    return {
        "status": "success",
        "record_id": doc_id,
        "metrics": metrics,
        "ai_result": ai_result,
    }


@app.get("/metrics/history")
def get_metrics_history(limit: int = Query(20, ge=1, le=200)):
    """Return recent chronological monitoring records."""
    cursor = monitoring_collection.find({})
    cursor.sort("_id", -1)
    cursor.limit(limit)
    records = list(cursor)

    for r in records:
        r["_id"] = str(r.get("_id", ""))

    return {
        "count": len(records),
        "records": records,
    }


# ============================================================
# AI ANALYSIS & DECISION ENGINE
# ============================================================


@app.get("/ai/status")
def get_ai_status():
    """Return latest AI model analysis status and telemetry interpretations."""
    # Always evaluate active state or latest inference
    latest = monitoring_collection.find_one(
        {"ai_analysis": {"$exists": True}},
        sort=[("_id", -1)],
    )

    models_dict = None
    decision_dict = None

    if latest:
        raw_ai = latest.get("ai_analysis")
        if isinstance(raw_ai, dict):
            if "models" in raw_ai and isinstance(raw_ai["models"], dict):
                models_dict = raw_ai["models"]
            elif "isolation_forest" in raw_ai and isinstance(raw_ai["isolation_forest"], dict):
                models_dict = raw_ai
        decision_dict = latest.get("decision")

    if not models_dict:
        latest_metric_doc = monitoring_collection.find_one({}, sort=[("_id", -1)])
        metrics = latest_metric_doc.get("metrics") if latest_metric_doc else None
        res = run_full_inference(metrics)
        models_dict = res["models"]
        decision_dict = res["decision"]

    iso = models_dict.get("isolation_forest", {})
    rf = models_dict.get("random_forest", {})
    lstm = models_dict.get("lstm", {})

    normalized_ai = {
        "status": iso.get("status", "NOT CONFIGURED"),
        "anomaly_score": iso.get("score"),
        "random_forest_status": rf.get("status", "NOT CONFIGURED"),
        "random_forest_confidence": rf.get("confidence"),
        "lstm_status": lstm.get("status", "NOT CONFIGURED"),
        "isolation_forest": iso,
        "random_forest": rf,
        "lstm": lstm,
        "models": models_dict,
    }

    return {
        "record_id": str(latest.get("_id", "")) if latest else None,
        "ai_analysis": normalized_ai,
        "decision": decision_dict or {},
    }


@app.post("/ai/run-inference")
def trigger_ai_inference():
    """Force run AI anomaly detection and ensemble scoring."""
    latest = monitoring_collection.find_one({}, sort=[("_id", -1)])
    metrics = latest.get("metrics", {}) if latest else None
    result = run_full_inference(metrics)
    return result


@app.get("/decision")
def get_latest_decision():
    """Return the latest NetGuard AI ensemble decision and recommendation."""
    latest = monitoring_collection.find_one(
        {"decision": {"$exists": True}},
        projection={"_id": 1, "decision": 1, "ai_analysis": 1},
        sort=[("_id", -1)],
    )

    if not latest:
        res = run_full_inference()
        dec = res["decision"]
    else:
        dec = dict(latest.get("decision", {}))

    # Normalize aliases
    if "status" in dec and "verdict" not in dec:
        dec["verdict"] = dec["status"]
    if "verdict" in dec and "status" not in dec:
        dec["status"] = dec["verdict"]
    if "active_models" in dec and "contributing_models" not in dec:
        dec["contributing_models"] = dec["active_models"]
    if "contributing_models" in dec and "active_models" not in dec:
        dec["active_models"] = dec["contributing_models"]

    return {
        "record_id": str(latest.get("_id", "")) if latest else None,
        "decision": dec,
    }


# ============================================================
# ALERTS MANAGEMENT
# ============================================================


class AlertCreateRequest(BaseModel):
    severity: str = Field(..., description="CRITICAL, WARNING, or INFO")
    title: str = Field(..., max_length=150)
    message: str = Field(..., max_length=500)
    source: str = Field("Manual", max_length=100)


@app.get("/alerts")
def get_alerts(
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = None,
    include_resolved: bool = True,
):
    """Retrieve verified alerts from persistent database."""
    alerts = storage_manager.get_alerts(
        limit=limit, severity=severity, include_resolved=include_resolved
    )
    return {
        "count": len(alerts),
        "total": len(alerts),
        "alerts": alerts,
    }


@app.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str):
    success = storage_manager.acknowledge_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id, "acknowledged": True}


@app.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    success = storage_manager.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id, "resolved": True}


@app.post("/alerts/create")
def create_custom_alert(req: AlertCreateRequest):
    if req.severity.upper() not in ["CRITICAL", "WARNING", "INFO"]:
        raise HTTPException(
            status_code=400, detail="Severity must be CRITICAL, WARNING, or INFO"
        )
    alert_id = storage_manager.add_alert(
        severity=req.severity,
        title=req.title,
        message=req.message,
        source=req.source,
    )
    return {"status": "success", "alert_id": alert_id}


# ============================================================
# SYSTEM LOGS
# ============================================================


class LogCreateRequest(BaseModel):
    level: str = "INFO"
    source: str = "Custom"
    message: str


@app.get("/logs")
def get_logs(
    limit: int = Query(100, ge=1, le=500),
    level: Optional[str] = None,
    source: Optional[str] = None,
):
    """Retrieve operational and security log entries."""
    logs = storage_manager.get_logs(limit=limit, level=level, source=source)
    return {
        "count": len(logs),
        "logs": logs,
    }


@app.post("/logs")
def add_log_entry(req: LogCreateRequest):
    log_id = storage_manager.add_log(
        level=req.level, source=req.source, message=req.message
    )
    return {"status": "success", "log_id": log_id}


# ============================================================
# MONITORED DEVICES
# ============================================================


class DeviceRegisterRequest(BaseModel):
    name: str = Field(..., max_length=100)
    ip: str = Field(..., max_length=50)
    role: str = Field("Endpoint", max_length=50)


@app.get("/devices")
def get_monitored_devices():
    """Return monitored device inventory."""
    devices = storage_manager.get_devices()
    return {
        "count": len(devices),
        "devices": devices,
    }


@app.post("/devices")
def register_device(req: DeviceRegisterRequest):
    dev_id = storage_manager.register_device(
        name=req.name, ip=req.ip, role=req.role
    )
    return {"status": "success", "device_id": dev_id}


@app.post("/devices/{device_id}/ping")
def ping_monitored_device(device_id: str):
    """Test round-trip latency to a specific registered device."""
    devices = storage_manager.get_devices()
    target = next((d for d in devices if d["id"] == device_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Device not found")

    lat = get_latency(target["ip"])
    new_status = "ONLINE" if lat is not None else "OFFLINE"
    storage_manager.update_device_status(device_id, new_status, lat)

    return {
        "status": "success",
        "device_id": device_id,
        "device_status": new_status,
        "latency_ms": lat,
    }


@app.delete("/devices/{device_id}")
def delete_device(device_id: str):
    success = storage_manager.delete_device(device_id)
    if not success:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"status": "success", "device_id": device_id}


# ============================================================
# REPORTS & ANALYTICS
# ============================================================


@app.get("/reports/summary")
def get_report_summary(period: str = Query("24h", pattern="^(1h|6h|24h|7d|all)$")):
    """Calculate verified summary analytics from stored telemetry over the requested period."""
    hours_map = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "all": 999999}
    hours = hours_map.get(period, 24)

    cursor = monitoring_collection.find({})
    records = list(cursor)

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    period_records = []
    for r in records:
        ts_str = r.get("metrics", {}).get("timestamp")
        if ts_str:
            try:
                if isinstance(ts_str, str):
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                else:
                    ts = ts_str
                if ts >= cutoff:
                    period_records.append(r)
            except Exception:
                period_records.append(r)
        else:
            period_records.append(r)

    if not period_records:
        period_records = records[-10:] if records else []

    total_records = len(period_records)
    cpus = [
        float(r.get("metrics", {}).get("cpu_usage_percent", 0))
        for r in period_records
        if r.get("metrics", {}).get("cpu_usage_percent") is not None
    ]
    mems = [
        float(r.get("metrics", {}).get("memory_usage_percent", 0))
        for r in period_records
        if r.get("metrics", {}).get("memory_usage_percent") is not None
    ]
    lats = [
        float(r.get("metrics", {}).get("latency_ms", 0))
        for r in period_records
        if r.get("metrics", {}).get("latency_ms") is not None
    ]

    avg_cpu = round(sum(cpus) / len(cpus), 1) if cpus else None
    peak_cpu = round(max(cpus), 1) if cpus else None
    avg_mem = round(sum(mems) / len(mems), 1) if mems else None
    peak_mem = round(max(mems), 1) if mems else None
    avg_lat = round(sum(lats) / len(lats), 1) if lats else None

    # Alerts in period
    alerts = storage_manager.get_alerts(limit=200)
    crit_count = sum(1 for a in alerts if a["severity"] == "CRITICAL")
    warn_count = sum(1 for a in alerts if a["severity"] == "WARNING")
    info_count = sum(1 for a in alerts if a["severity"] == "INFO")

    return {
        "period": period,
        "generated_at": now.isoformat(),
        "total_telemetry_samples": total_records,
        "metrics_summary": {
            "avg_cpu_percent": avg_cpu,
            "peak_cpu_percent": peak_cpu,
            "avg_memory_percent": avg_mem,
            "peak_memory_percent": peak_mem,
            "avg_latency_ms": avg_lat,
        },
        "alerts_summary": {
            "total_alerts": len(alerts),
            "critical": crit_count,
            "warning": warn_count,
            "info": info_count,
        },
    }


@app.get("/reports/export")
def export_report_csv(period: str = Query("24h")):
    """Export actual stored telemetry as a downloadable CSV file."""
    cursor = monitoring_collection.find({})
    cursor.sort("_id", -1)
    cursor.limit(200)
    records = list(cursor)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Record_ID",
        "Timestamp",
        "CPU_Percent",
        "Memory_Percent",
        "Disk_Percent",
        "Latency_MS",
        "Bytes_Sent",
        "Bytes_Received",
        "AI_Status",
        "Decision_Status",
        "Recommended_Action",
    ])

    for r in records:
        m = r.get("metrics", {})
        ai_data = r.get("ai_analysis", {})
        dec = r.get("decision", {})
        writer.writerow([
            str(r.get("_id", "")),
            m.get("timestamp", ""),
            m.get("cpu_usage_percent", ""),
            m.get("memory_usage_percent", ""),
            m.get("disk_usage_percent", ""),
            m.get("latency_ms", ""),
            m.get("bytes_sent", ""),
            m.get("bytes_received", ""),
            ai_data.get("status", "NOT EVALUATED"),
            dec.get("status", "NOT EVALUATED"),
            dec.get("action", ""),
        ])

    csv_data = output.getvalue()
    filename = f"netguard-report-{period}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ============================================================
# SYSTEM SETTINGS
# ============================================================


class SettingsUpdateRequest(BaseModel):
    auto_refresh: Optional[bool] = None
    refresh_interval: Optional[int] = Field(None, ge=2, le=300)
    cpu_warning_threshold: Optional[float] = Field(None, ge=1.0, le=100.0)
    cpu_critical_threshold: Optional[float] = Field(None, ge=1.0, le=100.0)
    memory_warning_threshold: Optional[float] = Field(None, ge=1.0, le=100.0)
    latency_warning_threshold: Optional[float] = Field(None, ge=1.0, le=5000.0)
    active_collector: Optional[bool] = None


@app.get("/settings")
def get_settings():
    return storage_manager.get_settings()


@app.post("/settings")
def update_settings(req: SettingsUpdateRequest):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No settings provided to update")

    if (
        "cpu_warning_threshold" in updates
        and "cpu_critical_threshold" in updates
        and updates["cpu_warning_threshold"] >= updates["cpu_critical_threshold"]
    ):
        raise HTTPException(
            status_code=400,
            detail="CPU warning threshold must be lower than critical threshold",
        )

    updated = storage_manager.update_settings(updates)
    return {"status": "success", "settings": updated}


# ============================================================
# SYSTEM SUMMARY (BACKWARD COMPATIBILITY + HONEST DATA)
# ============================================================


@app.get("/summary")
def summary():
    """Return an overall NetGuard AI summary grounded strictly in real metrics."""
    latest = monitoring_collection.find_one({}, sort=[("_id", -1)])
    if not latest:
        # Collect initial reading
        metrics = collect_metrics()
        save_metrics(metrics)
        latest = monitoring_collection.find_one({}, sort=[("_id", -1)])

    if not latest:
        return {
            "status": "no_data",
            "message": "No monitoring data found",
            "network_status": "INSUFFICIENT DATA",
            "action": "Collector starting telemetry capture",
            "metrics": {},
            "ai": {
                "isolation_forest": "NOT CONFIGURED",
                "random_forest": "NOT CONFIGURED",
                "lstm": "NOT CONFIGURED",
            },
        }

    metrics_data = latest.get("metrics", {})
    ai_data = latest.get("ai_analysis", {})
    decision_data = latest.get("decision", {})

    # Ground network_status in real decision or state
    net_status = decision_data.get("status")
    if not net_status:
        net_status = ai_data.get("status")
    if not net_status or net_status == "UNKNOWN":
        net_status = "INSUFFICIENT DATA"

    action = decision_data.get("action")
    if not action:
        action = (
            "Baseline telemetry collection active"
            if net_status == "INSUFFICIENT DATA"
            else "Monitoring active"
        )

    return {
        "network_status": net_status,
        "action": action,
        "metrics": {
            "cpu_usage_percent": metrics_data.get("cpu_usage_percent"),
            "memory_usage_percent": metrics_data.get("memory_usage_percent"),
            "disk_usage_percent": metrics_data.get("disk_usage_percent"),
            "latency_ms": metrics_data.get("latency_ms"),
            "bytes_sent_per_sec": metrics_data.get("bytes_sent_per_sec", 0.0),
            "bytes_recv_per_sec": metrics_data.get("bytes_recv_per_sec", 0.0),
            "timestamp": metrics_data.get("timestamp"),
        },
        "ai": {
            "isolation_forest": ai_data.get("status", "NOT CONFIGURED"),
            "anomaly_score": ai_data.get("anomaly_score"),
            "random_forest": ai_data.get("random_forest_status", "NOT CONFIGURED"),
            "random_forest_confidence": ai_data.get("random_forest_confidence"),
            "lstm": ai_data.get("lstm_status", "NOT CONFIGURED"),
        },
    }
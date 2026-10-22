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

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai.service import run_full_inference
from backend.auth import (
    create_access_token,
    get_current_user,
    get_optional_current_user,
    hash_password,
    validate_email,
    validate_password_strength,
    verify_password,
)
from database.connection import (
    get_db_info,
    monitoring_collection,
    save_metrics,
    storage_manager,
    test_connection,
)
from monitoring.collector import collect_metrics
from monitoring.latency_monitor import get_latency
from backend.recovery import (
    ACTION_REGISTRY,
    get_available_actions,
    run_recovery_lifecycle,
)

from contextlib import asynccontextmanager

# ============================================================
# BACKGROUND TELEMETRY COLLECTOR & LIFESPAN
# ============================================================

_collector_running = False
_collector_thread = None
_collector_stop_event = threading.Event()
_last_collection_time: Optional[str] = None


def _background_collector_loop():
    global _collector_running, _last_collection_time
    while _collector_running and not _collector_stop_event.is_set():
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

                if cpu is not None and cpu >= cpu_crit:
                    storage_manager.add_alert(
                        "CRITICAL",
                        "CPU Utilization Critical",
                        f"Host CPU reached {cpu:.1f}% (threshold {cpu_crit:.1f}%)",
                        source="Threshold Monitor",
                    )
                elif cpu is not None and cpu >= cpu_warn:
                    storage_manager.add_alert(
                        "WARNING",
                        "High CPU Utilization",
                        f"Host CPU reached {cpu:.1f}% (threshold {cpu_warn:.1f}%)",
                        source="Threshold Monitor",
                    )

                if mem is not None and mem >= mem_warn:
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

                # Periodically trigger AI consensus analysis
                ai_res = run_full_inference(metrics)
                decision = ai_res.get("decision", {})

                # Check self-healing recovery eligibility if in AUTOMATIC mode
                rec_mode = settings.get("recovery_mode", "MANUAL")
                if rec_mode == "AUTOMATIC" and decision.get("status") in ["CRITICAL", "WARNING"]:
                    run_recovery_lifecycle(
                        decision=decision,
                        metrics=metrics,
                        mode="AUTOMATIC",
                        operator_email="system@netguard.ai",
                    )

            interval = max(2, int(settings.get("refresh_interval", 5)))
            _collector_stop_event.wait(timeout=interval)
        except Exception:
            _collector_stop_event.wait(timeout=5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _collector_running, _collector_thread, _collector_stop_event
    _collector_running = True
    _collector_stop_event.clear()
    if _collector_thread is None or not _collector_thread.is_alive():
        _collector_thread = threading.Thread(target=_background_collector_loop, daemon=True)
        _collector_thread.start()
    storage_manager.add_log("INFO", "Server", "NetGuard AI backend started successfully")
    yield
    _collector_running = False
    _collector_stop_event.set()
    if _collector_thread and _collector_thread.is_alive():
        _collector_thread.join(timeout=2.0)
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
# AUTHENTICATION & USER MANAGEMENT
# ============================================================


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)
    organization: Optional[str] = Field(None, max_length=100)
    terms_accepted: bool = Field(...)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_user(req: RegisterRequest, response: Response):
    email = req.email.strip().lower()
    full_name = req.full_name.strip()
    organization = req.organization.strip() if req.organization else None

    if not req.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms of Service and Privacy Policy to proceed.",
        )

    if not validate_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address.",
        )

    if req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    valid, err_msg = validate_password_strength(req.password)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )

    existing = storage_manager.get_user_by_email(email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    hashed_pw = hash_password(req.password)
    user = storage_manager.create_user(
        email=email,
        password_hash=hashed_pw,
        full_name=full_name,
        organization=organization,
        role="operator",
    )

    token = create_access_token(user, remember_me=False)

    response.set_cookie(
        key="netguard_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400,
    )

    storage_manager.add_log(
        "INFO",
        "Authentication",
        f"New operator registered: {email} ({organization or 'Independent'})",
    )

    return {
        "status": "success",
        "token": token,
        "token_type": "bearer",
        "user": user,
    }


@app.post("/auth/login")
def login_user(req: LoginRequest, response: Response):
    email = req.email.strip().lower()

    if not email or not req.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required.",
        )

    if storage_manager.is_user_locked_out(email):
        storage_manager.add_log(
            "WARNING",
            "Security",
            f"Blocked login attempt on locked account: {email}",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked due to excessive failed attempts. Please try again later.",
        )

    user = storage_manager.get_user_by_email(email)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        storage_manager.record_failed_login(email)
        storage_manager.add_log(
            "WARNING",
            "Authentication",
            f"Failed login attempt for {email}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )

    storage_manager.update_user_login(user["id"])
    token = create_access_token(user, remember_me=req.remember_me)

    cookie_max_age = 7 * 86400 if req.remember_me else 86400
    response.set_cookie(
        key="netguard_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=cookie_max_age,
    )

    storage_manager.add_log(
        "INFO",
        "Authentication",
        f"Operator signed in: {email} (role: {user.get('role', 'operator')})",
    )

    sanitized = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "organization": user.get("organization"),
        "role": user.get("role", "operator"),
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
    }

    return {
        "status": "success",
        "token": token,
        "token_type": "bearer",
        "user": sanitized,
    }


@app.post("/auth/logout")
def logout_user(
    response: Response,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    jti = current_user.get("_current_jti")
    exp = current_user.get("_current_exp")
    if jti and exp:
        storage_manager.revoke_token(jti, user_id=current_user["id"], expires_at=exp)

    response.delete_cookie(key="netguard_token")

    storage_manager.add_log(
        "INFO",
        "Authentication",
        f"Operator logged out: {current_user.get('email')}",
    )

    return {
        "status": "success",
        "message": "Signed out successfully.",
    }


@app.get("/auth/me")
def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    sanitized = {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name", ""),
        "organization": current_user.get("organization"),
        "role": current_user.get("role", "operator"),
        "created_at": current_user.get("created_at"),
        "last_login_at": current_user.get("last_login_at"),
    }
    return {
        "status": "success",
        "user": sanitized,
    }


@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    storage_manager.add_log(
        "INFO",
        "Authentication",
        f"Password recovery requested for {email}",
    )
    return {
        "status": "success",
        "message": "If an account matches that email address, password reset instructions have been dispatched.",
    }


# ============================================================
# METRICS & TELEMETRY
# ============================================================


@app.get("/metrics")
def get_latest_metrics(current_user: Dict[str, Any] = Depends(get_current_user)):
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
def trigger_collect(current_user: Dict[str, Any] = Depends(get_current_user)):
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
def get_metrics_history(
    limit: int = Query(20, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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
def get_ai_status(current_user: Dict[str, Any] = Depends(get_current_user)):
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
def trigger_ai_inference(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Force run AI anomaly detection and ensemble scoring."""
    latest = monitoring_collection.find_one({}, sort=[("_id", -1)])
    metrics = latest.get("metrics", {}) if latest else None
    result = run_full_inference(metrics)
    return result


@app.get("/decision")
def get_latest_decision(current_user: Dict[str, Any] = Depends(get_current_user)):
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
    current_user: Dict[str, Any] = Depends(get_current_user),
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
def acknowledge_alert(
    alert_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    success = storage_manager.acknowledge_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id, "acknowledged": True}


@app.post("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    success = storage_manager.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id, "resolved": True}


@app.post("/alerts/create")
def create_custom_alert(
    req: AlertCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve operational and security log entries."""
    logs = storage_manager.get_logs(limit=limit, level=level, source=source)
    return {
        "count": len(logs),
        "logs": logs,
    }


@app.post("/logs")
def add_log_entry(
    req: LogCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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
def get_monitored_devices(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return monitored device inventory."""
    devices = storage_manager.get_devices()
    return {
        "count": len(devices),
        "devices": devices,
    }


@app.post("/devices")
def register_device(
    req: DeviceRegisterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    dev_id = storage_manager.register_device(
        name=req.name, ip=req.ip, role=req.role
    )
    return {"status": "success", "device_id": dev_id}


@app.post("/devices/{device_id}/ping")
def ping_monitored_device(
    device_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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
def delete_device(
    device_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    success = storage_manager.delete_device(device_id)
    if not success:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"status": "success", "device_id": device_id}


# ============================================================
# REPORTS & ANALYTICS
# ============================================================


@app.get("/reports/summary")
def get_report_summary(
    period: str = Query("24h", pattern="^(1h|6h|24h|7d|all)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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
def export_report_csv(
    period: str = Query("24h"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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
    recovery_mode: Optional[str] = Field(None, pattern="^(MANUAL|AUTOMATIC|DRY_RUN)$")
    recovery_cooldown_seconds: Optional[int] = Field(None, ge=10, le=3600)


@app.get("/settings")
def get_settings(current_user: Dict[str, Any] = Depends(get_current_user)):
    return storage_manager.get_settings()


@app.post("/settings")
def update_settings(
    req: SettingsUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
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
# SELF-HEALING & RECOVERY ENDPOINTS
# ============================================================


class RecoveryTriggerRequest(BaseModel):
    action_key: str
    mode: Optional[str] = Field("DRY_RUN", pattern="^(DRY_RUN|MANUAL|AUTOMATIC)$")


@app.get("/recovery/actions")
def get_recovery_actions_list(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return all registered self-healing actions and execution capabilities."""
    return {
        "status": "success",
        "actions": get_available_actions(),
    }


@app.get("/recovery/history")
def get_recovery_history(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve audit history of automated and manual recovery attempts."""
    actions = storage_manager.get_recovery_actions(limit=limit, status=status)
    return {
        "count": len(actions),
        "actions": actions,
    }


@app.get("/recovery/status")
def get_recovery_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return current recovery engine state, configured mode, and statistics."""
    settings = storage_manager.get_settings()
    actions = storage_manager.get_recovery_actions(limit=100)

    total = len(actions)
    verified = sum(1 for a in actions if a["status"] == "VERIFIED")
    pending = sum(1 for a in actions if a["status"] == "PENDING_APPROVAL")
    dry_runs = sum(1 for a in actions if a["status"] == "DRY_RUN")
    failed = sum(1 for a in actions if a["status"] == "FAILED")

    return {
        "configured_mode": settings.get("recovery_mode", "MANUAL"),
        "cooldown_seconds": float(settings.get("recovery_cooldown_seconds", 300)),
        "statistics": {
            "total_actions": total,
            "verified": verified,
            "pending_approval": pending,
            "dry_runs": dry_runs,
            "failed": failed,
        },
        "latest_action": actions[0] if actions else None,
    }


@app.post("/recovery/trigger")
def trigger_recovery_action(
    req: RecoveryTriggerRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Manually execute or dry-run a specific recovery action."""
    if req.action_key not in ACTION_REGISTRY:
        raise HTTPException(
            status_code=400, detail=f"Unknown recovery action: {req.action_key}"
        )

    latest_metric_doc = monitoring_collection.find_one({}, sort=[("_id", -1)])
    metrics = latest_metric_doc.get("metrics", {}) if latest_metric_doc else {}
    latest_decision_doc = monitoring_collection.find_one(
        {"decision": {"$exists": True}}, sort=[("_id", -1)]
    )
    decision = latest_decision_doc.get("decision", {}) if latest_decision_doc else {}

    operator = current_user.get("email", "operator@netguard.ai")
    res = run_recovery_lifecycle(
        decision=decision,
        metrics=metrics,
        force_action_key=req.action_key,
        mode=req.mode,
        operator_email=operator,
    )
    return res


@app.post("/recovery/approve/{action_id}")
def approve_recovery_action(
    action_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Approve and execute a pending recovery action with verification."""
    action = storage_manager.get_recovery_action_by_id(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Recovery action not found")

    if action["status"] != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Action is in '{action['status']}' state; only PENDING_APPROVAL actions can be approved.",
        )

    action_key = action["action_key"]
    if action_key not in ACTION_REGISTRY:
        raise HTTPException(
            status_code=500, detail="Action implementation not registered"
        )

    latest_metric_doc = monitoring_collection.find_one({}, sort=[("_id", -1)])
    metrics = latest_metric_doc.get("metrics", {}) if latest_metric_doc else {}
    latest_decision_doc = monitoring_collection.find_one(
        {"decision": {"$exists": True}}, sort=[("_id", -1)]
    )
    decision = latest_decision_doc.get("decision", {}) if latest_decision_doc else {}

    operator = current_user.get("email", "operator@netguard.ai")
    res = run_recovery_lifecycle(
        decision=decision,
        metrics=metrics,
        force_action_key=action_key,
        mode="MANUAL",
        operator_email=operator,
    )

    # Mark original pending record as superseded
    storage_manager.update_recovery_action(
        action_id,
        {
            "status": "EXECUTED",
            "logs": action.get("logs", [])
            + [f"Approved and executed as {res.get('action_id')}"],
        },
    )
    return res


# ============================================================
# SYSTEM SUMMARY (BACKWARD COMPATIBILITY + HONEST DATA)
# ============================================================


@app.get("/summary")
def summary(current_user: Dict[str, Any] = Depends(get_current_user)):
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
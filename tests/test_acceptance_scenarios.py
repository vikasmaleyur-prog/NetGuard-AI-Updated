"""
NetGuard AI - Acceptance Scenarios A through G (Part 14)
Executes end-to-end verification of all seven production operational scenarios:
- Scenario A: Normal Operation
- Scenario B: Warning Anomaly
- Scenario C: Critical Anomaly
- Scenario D: Model Unavailable / Graceful Degradation
- Scenario E: Database Resilient Fallback
- Scenario F: Recovery Execution & Cooldown
- Scenario G: Production Startup
"""

import os
import sys
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app
from database.connection import storage_manager, monitoring_collection
from ai.decision_engine import evaluate_decision
from ai.anomaly_detector import predict_single
from ai.random_forest import classify_issue
from ai.lstm_model import evaluate_sequence
from backend.recovery import (
    run_recovery_lifecycle,
    get_available_actions,
    _last_action_execution,
)

client = TestClient(app)

# Seed authentication header
auth_res = client.post(
    "/auth/login",
    json={"email": "admin@netguard.ai", "password": "NetGuardAdmin2026!"},
)
if auth_res.status_code == 200:
    client.headers["Authorization"] = f"Bearer {auth_res.json()['token']}"


# -----------------------------------------------------------------------------
# Scenario A: Normal Operation
# -----------------------------------------------------------------------------
def test_scenario_a_normal_operation():
    """
    Scenario A:
    All metrics within normal bounds (CPU ~18%, Memory ~32%, Latency ~12ms, 0% loss).
    Decision engine returns NORMAL, high agreement, no spurious alerts.
    """
    normal_telemetry = {
        "cpu_usage_percent": 18.5,
        "memory_usage_percent": 32.1,
        "disk_usage_percent": 45.0,
        "bytes_sent": 120000.0,
        "bytes_received": 240000.0,
        "packets_sent": 150.0,
        "packets_received": 300.0,
        "errors_in": 0.0,
        "errors_out": 0.0,
        "drops_in": 0.0,
        "drops_out": 0.0,
        "packet_loss_percent": 0.0,
        "latency_ms": 12.4,
    }

    if_res = predict_single(normal_telemetry)
    assert if_res.get("status") in ["NORMAL", "INSUFFICIENT DATA"]

    rf_res = classify_issue(normal_telemetry)
    assert rf_res.get("class_name") == "NOMINAL", "Normal metrics should classify as NOMINAL"

    seq_records = [{"metrics": normal_telemetry}] * 10
    lstm_res = evaluate_sequence(seq_records)

    decision = evaluate_decision(
        isolation_result=if_res,
        random_forest_result=rf_res,
        lstm_result=lstm_res,
        current_metrics=normal_telemetry,
    )
    assert decision["verdict"] == "NORMAL", f"Expected NORMAL verdict, got {decision['verdict']}"
    assert decision["status"] == "NORMAL"
    assert decision["anomaly_votes"] == 0


# -----------------------------------------------------------------------------
# Scenario B: Warning Anomaly
# -----------------------------------------------------------------------------
def test_scenario_b_warning_anomaly():
    """
    Scenario B:
    Elevated metric (e.g. CPU 86% or Latency 115ms) triggers WARNING state.
    Alert deduplication ensures only 1 alert is dispatched within the cooldown window.
    """
    warning_telemetry = {
        "cpu_usage_percent": 86.0,
        "memory_usage_percent": 45.0,
        "disk_usage_percent": 50.0,
        "bytes_sent": 250000.0,
        "bytes_received": 300000.0,
        "packets_sent": 350.0,
        "packets_received": 400.0,
        "errors_in": 0.0,
        "errors_out": 0.0,
        "drops_in": 0.0,
        "drops_out": 0.0,
        "packet_loss_percent": 1.2,
        "latency_ms": 115.0,
    }

    if_res = predict_single(warning_telemetry)
    rf_res = classify_issue(warning_telemetry)
    seq_records = [{"metrics": warning_telemetry}] * 10
    lstm_res = evaluate_sequence(seq_records)

    decision = evaluate_decision(
        isolation_result=if_res,
        random_forest_result=rf_res,
        lstm_result=lstm_res,
        current_metrics=warning_telemetry,
    )
    assert decision["verdict"] in ["WARNING", "ANOMALY"]
    assert decision["status"] in ["WARNING", "CRITICAL"]

    # Deduplication test: add alert twice in storage within 5 minutes
    title = "Scenario B High CPU Warning"
    source = "E2E_Test"
    id1 = storage_manager.add_alert(
        severity="WARNING",
        title=title,
        message="Elevated CPU detected at 86%",
        source=source,
    )
    id2 = storage_manager.add_alert(
        severity="WARNING",
        title=title,
        message="Elevated CPU detected at 86%",
        source=source,
    )

    assert id1 is not None
    assert id1 == id2, "Duplicate alert must return the existing alert ID"


# -----------------------------------------------------------------------------
# Scenario C: Critical Anomaly
# -----------------------------------------------------------------------------
def test_scenario_c_critical_anomaly():
    """
    Scenario C:
    Multiple thresholds severely breached (CPU 98%, Memory 94%, Packet loss 18%).
    Random forest identifies issue, decision engine flags CRITICAL, and safe recovery playbook is selected.
    """
    critical_telemetry = {
        "cpu_usage_percent": 98.2,
        "memory_usage_percent": 94.5,
        "disk_usage_percent": 91.0,
        "bytes_sent": 45000000.0,
        "bytes_received": 85000000.0,
        "packets_sent": 50000.0,
        "packets_received": 75000.0,
        "errors_in": 50.0,
        "errors_out": 40.0,
        "drops_in": 25.0,
        "drops_out": 30.0,
        "packet_loss_percent": 18.5,
        "latency_ms": 320.0,
    }

    rf_res = classify_issue(critical_telemetry)
    assert rf_res.get("class_name") in ["MEMORY_EXHAUSTION", "HIGH_CPU_LOAD", "TRAFFIC_ANOMALY"]

    decision = evaluate_decision(
        isolation_result={"status": "ANOMALY", "score": -0.85},
        random_forest_result=rf_res,
        lstm_result={"status": "STANDBY", "forecast": 95.0, "residual": 12.0},
        current_metrics=critical_telemetry,
    )
    assert decision["verdict"] in ["CRITICAL", "ANOMALY"]
    assert decision["status"] == "CRITICAL"
    assert len(decision["evidence"]) >= 1

    # Recovery selection check in MANUAL mode (generates PENDING_APPROVAL)
    rec_result = run_recovery_lifecycle(decision, critical_telemetry, mode="MANUAL")
    assert rec_result["status"] in ["PENDING_APPROVAL", "DRY_RUN", "VERIFIED", "SKIPPED"]
    assert "action_key" in rec_result


# -----------------------------------------------------------------------------
# Scenario D: Model Unavailable / Graceful Degradation
# -----------------------------------------------------------------------------
def test_scenario_d_model_unavailable_graceful_degradation():
    """
    Scenario D:
    Simulates missing or corrupted models.
    The decision engine refuses to falsely claim NORMAL and surfaces degraded telemetry.
    """
    dummy_telemetry = {
        "cpu_usage_percent": 75.0,
        "memory_usage_percent": 60.0,
        "latency_ms": 40.0,
    }

    # Pass unconfigured/failed models
    unavail_if = {"status": "UNAVAILABLE", "detail": "Missing model weights"}
    unavail_rf = {"status": "UNAVAILABLE", "detail": "Missing model weights"}
    standby_lstm = {"status": "STANDBY", "detail": "TensorFlow not installed"}

    decision = evaluate_decision(
        isolation_result=unavail_if,
        random_forest_result=unavail_rf,
        lstm_result=standby_lstm,
        current_metrics=dummy_telemetry,
    )
    # Refuses to return NORMAL when active_models == 0
    assert decision["verdict"] != "NORMAL", "System must not declare NORMAL when primary models are UNAVAILABLE"
    assert decision["status"] == "INSUFFICIENT DATA"
    assert decision["rule"] == "INSUFFICIENT_TELEMETRY"


# -----------------------------------------------------------------------------
# Scenario E: Database Resilient Fallback
# -----------------------------------------------------------------------------
def test_scenario_e_database_resilient_fallback():
    """
    Scenario E:
    Verifies SQLite fallback operates seamlessly, tables exist, and metrics / alerts
    can be written and read without MongoDB Atlas.
    """
    health = storage_manager.health_check()
    assert health["connected"] is True
    assert health["backend"] == "sqlite"

    # Write a test metric via monitoring_collection
    insert_res = monitoring_collection.insert_one({
        "timestamp": "2026-10-22T20:00:00Z",
        "metrics": {
            "cpu_usage_percent": 42.0,
            "memory_usage_percent": 55.0,
            "latency_ms": 25.0,
        },
        "source": "ScenarioE_Test",
    })
    assert insert_res is not None

    # Query metrics via monitoring_collection
    recent = list(monitoring_collection.find({"source": "ScenarioE_Test"}))
    assert len(recent) > 0


# -----------------------------------------------------------------------------
# Scenario F: Recovery Execution & Cooldown
# -----------------------------------------------------------------------------
def test_scenario_f_recovery_execution_and_cooldown():
    """
    Scenario F:
    Tests DRY_RUN simulation, manual execution, audit logging, and cooldown rejection.
    """
    test_decision = {"status": "CRITICAL", "action": "Investigate high packet loss"}
    test_metrics = {"latency_ms": 150.0, "packet_loss_percent": 22.0}

    # 1. Trigger dry run
    dry_run = run_recovery_lifecycle(
        decision=test_decision,
        metrics=test_metrics,
        force_action_key="flush_dns_cache",
        mode="DRY_RUN",
    )
    assert dry_run["status"] in ["DRY_RUN", "SIMULATED", "VERIFIED"]
    assert "action_id" in dry_run

    # 2. Trigger real execution (force execution bypasses pending approval)
    _last_action_execution.pop("flush_dns_cache", None)
    first_exec = run_recovery_lifecycle(
        decision=test_decision,
        metrics=test_metrics,
        force_action_key="flush_dns_cache",
        mode="AUTOMATIC",
    )
    assert first_exec["status"] in ["VERIFIED", "FAILED", "DRY_RUN"]

    # 3. Immediate second execution must be rejected due to active cooldown
    second_exec = run_recovery_lifecycle(
        decision=test_decision,
        metrics=test_metrics,
        force_action_key="flush_dns_cache",
        mode="AUTOMATIC",
    )
    assert second_exec["status"] == "SKIPPED"
    assert "cooldown_remaining_seconds" in second_exec

    # 4. Verify audit history
    history = storage_manager.get_recovery_actions(limit=5)
    assert len(history) >= 2


# -----------------------------------------------------------------------------
# Scenario G: Production Startup & Clean State
# -----------------------------------------------------------------------------
def test_scenario_g_production_startup():
    """
    Scenario G:
    Verifies all critical endpoints return 200 OK with valid schemas, models are loaded,
    and system status is healthy.
    """
    # Health endpoint
    h_res = client.get("/health")
    assert h_res.status_code == 200
    h_data = h_res.json()
    assert h_data["status"] == "healthy"
    assert h_data["database"]["connected"] is True

    # Summary endpoint
    s_res = client.get("/summary")
    assert s_res.status_code == 200
    s_data = s_res.json()
    assert "network_status" in s_data
    assert "metrics" in s_data

    # AI Status endpoint
    ai_res = client.get("/ai/status")
    assert ai_res.status_code == 200
    ai_data = ai_res.json()["ai_analysis"]
    assert ai_data["isolation_forest"]["status"] in ["ACTIVE", "NORMAL", "ANOMALY"]
    assert ai_data["random_forest"]["status"] in ["ACTIVE", "NORMAL", "ANOMALY"]
    assert ai_data["lstm"]["status"] in ["STANDBY", "NOT CONFIGURED"]

    # Recovery Actions endpoint
    rec_res = client.get("/recovery/actions")
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert len(rec_data["actions"]) == 4

"""
NetGuard AI - Decision Engine Unit Tests
Validates consensus logic, transparent evidence logging, and threshold boundaries.
"""

from ai.decision_engine import evaluate_decision


def test_decision_engine_nominal_consensus():
    """Verify consensus produces NORMAL when active models agree on nominal telemetry."""
    iso = {"status": "NORMAL", "score": 0.15}
    rf = {"status": "NORMAL", "class_name": "NOMINAL", "confidence": 98.0}
    lstm = {"status": "NORMAL", "deviation_score": 0.02}
    metrics = {"cpu_usage_percent": 25.0, "memory_usage_percent": 50.0, "latency_ms": 15.0}

    res = evaluate_decision(
        isolation_result=iso,
        random_forest_result=rf,
        lstm_result=lstm,
        current_metrics=metrics,
    )
    assert res["status"] == "NORMAL"
    assert res["active_models"] == 3
    assert res["anomaly_votes"] == 0
    assert len(res["evidence"]) >= 3


def test_decision_engine_majority_anomaly_critical():
    """Verify consensus produces CRITICAL when multiple models flag anomalies."""
    iso = {"status": "ANOMALY", "score": -0.18}
    rf = {"status": "ANOMALY", "class_name": "HIGH_CPU_LOAD", "confidence": 95.0}
    lstm = {"status": "NORMAL", "deviation_score": 0.05}
    metrics = {"cpu_usage_percent": 88.0, "memory_usage_percent": 55.0, "latency_ms": 25.0}

    res = evaluate_decision(
        isolation_result=iso,
        random_forest_result=rf,
        lstm_result=lstm,
        current_metrics=metrics,
    )
    assert res["status"] == "CRITICAL"
    assert res["rule"] == "ENSEMBLE_MAJORITY_ANOMALY"
    assert res["anomaly_votes"] == 2


def test_decision_engine_hard_threshold_breach():
    """Verify deterministic critical breach takes precedence even if models are inactive."""
    metrics = {"cpu_usage_percent": 98.5, "memory_usage_percent": 50.0, "latency_ms": 15.0}
    res = evaluate_decision(
        isolation_result={"status": "NOT CONFIGURED"},
        random_forest_result={"status": "NOT CONFIGURED"},
        lstm_result={"status": "STANDBY"},
        current_metrics=metrics,
    )
    assert res["status"] == "CRITICAL"
    assert res["rule"] == "HARD_METRIC_CRITICAL_BREACH"


def test_decision_engine_missing_models_insufficient_data():
    """Verify missing models NEVER default to NORMAL; produces INSUFFICIENT DATA."""
    res = evaluate_decision(
        isolation_result={"status": "NOT CONFIGURED"},
        random_forest_result={"status": "NOT CONFIGURED"},
        lstm_result={"status": "NOT CONFIGURED"},
        current_metrics={"cpu_usage_percent": 30.0, "memory_usage_percent": 50.0},
    )
    assert res["status"] == "INSUFFICIENT DATA"
    assert res["rule"] == "INSUFFICIENT_TELEMETRY"
    assert res["active_models"] == 0

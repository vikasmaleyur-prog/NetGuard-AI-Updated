"""
NetGuard AI - Consensus & Decision Engine
Evaluates telemetry metrics, statistical thresholds, Isolation Forest, Random Forest,
and temporal sequence forecasts into an explainable, authoritative network health verdict.

Enforces strict SecOps principles:
  - Missing or unconfigured models NEVER count as positive votes for NORMAL.
  - Hard metric threshold breaches are classified distinctly from predictive warnings.
  - Every decision records its governing rule, contributing evidence, and confidence score.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def evaluate_decision(
    isolation_result: Optional[dict] = None,
    random_forest_result: Optional[dict] = None,
    lstm_result: Optional[dict] = None,
    current_metrics: Optional[dict] = None,
    thresholds: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Compute ensemble decision and recommended action across available AI detectors and telemetry.
    """
    thresholds = thresholds or {
        "cpu_warning_threshold": 80.0,
        "cpu_critical_threshold": 95.0,
        "memory_warning_threshold": 85.0,
        "latency_warning_threshold": 100.0,
    }

    current_metrics = current_metrics or {}
    iso = isolation_result or {}
    rf = random_forest_result or {}
    lstm = lstm_result or {}

    evidence: List[str] = []
    active_models = 0
    anomaly_votes = 0

    # 1. Isolation Forest Evaluation
    iso_status = iso.get("status")
    if iso_status in ["NORMAL", "ANOMALY"]:
        active_models += 1
        if iso_status == "ANOMALY":
            anomaly_votes += 1
            score = iso.get("score")
            evidence.append(f"Isolation Forest flagged anomaly (score {score})")
        else:
            evidence.append("Isolation Forest reports normal telemetry bounds")
    elif iso_status:
        evidence.append(f"Isolation Forest inactive: {iso.get('detail', iso_status)}")

    # 2. Random Forest Classification Evaluation
    rf_status = rf.get("status")
    if rf_status in ["NORMAL", "ANOMALY"]:
        active_models += 1
        if rf_status == "ANOMALY":
            anomaly_votes += 1
            c_name = rf.get("class_name", "UNKNOWN")
            conf = rf.get("confidence", 0.0)
            evidence.append(f"Random Forest classified threat: {c_name} ({conf}% confidence)")
        else:
            evidence.append("Random Forest classified nominal behavior")
    elif rf_status:
        evidence.append(f"Random Forest inactive: {rf.get('detail', rf_status)}")

    # 3. LSTM / Sequence Deviation Evaluation
    lstm_status = lstm.get("status")
    if lstm_status in ["NORMAL", "ANOMALY"]:
        active_models += 1
        if lstm_status == "ANOMALY":
            anomaly_votes += 1
            dev = lstm.get("deviation_score")
            evidence.append(f"Sequence forecaster flagged trajectory deviation ({dev})")
        else:
            evidence.append("Sequence trajectory aligns with expected baseline")
    elif lstm_status:
        evidence.append(f"Sequence forecaster inactive: {lstm.get('detail', lstm_status)}")

    # 4. Check observed metric threshold breaches (Deterministic safety boundary)
    cpu = current_metrics.get("cpu_usage_percent")
    mem = current_metrics.get("memory_usage_percent")
    lat = current_metrics.get("latency_ms")
    loss = current_metrics.get("packet_loss_percent")

    cpu_crit = thresholds.get("cpu_critical_threshold", 95.0)
    cpu_warn = thresholds.get("cpu_warning_threshold", 80.0)
    mem_warn = thresholds.get("memory_warning_threshold", 85.0)
    lat_warn = thresholds.get("latency_warning_threshold", 100.0)

    is_hard_critical = False
    is_hard_warning = False

    if cpu is not None and cpu >= cpu_crit:
        is_hard_critical = True
        evidence.append(f"Deterministic breach: CPU utilization critical at {cpu:.1f}% >= {cpu_crit:.1f}%")
    elif cpu is not None and cpu >= cpu_warn:
        is_hard_warning = True
        evidence.append(f"Deterministic warning: CPU utilization elevated at {cpu:.1f}% >= {cpu_warn:.1f}%")

    if mem is not None and mem >= mem_warn:
        is_hard_warning = True
        evidence.append(f"Deterministic warning: RAM utilization elevated at {mem:.1f}% >= {mem_warn:.1f}%")

    if lat is not None and lat >= lat_warn:
        is_hard_warning = True
        evidence.append(f"Deterministic warning: Network latency elevated at {lat:.1f}ms >= {lat_warn:.1f}ms")

    if loss is not None and loss >= 25.0:
        is_hard_critical = True
        evidence.append(f"Deterministic breach: Packet loss critical at {loss:.1f}% >= 25.0%")

    # 5. Consensus Rules Formulation
    now_iso = datetime.now(timezone.utc).isoformat()

    if is_hard_critical:
        status = "CRITICAL"
        rule = "HARD_METRIC_CRITICAL_BREACH"
        action = "Immediate action required: host or network performance is critically degraded"
    elif active_models == 0:
        status = "INSUFFICIENT DATA"
        rule = "INSUFFICIENT_TELEMETRY"
        action = "Collecting telemetry baseline to train and evaluate AI models"
    elif anomaly_votes >= 2:
        status = "CRITICAL"
        rule = "ENSEMBLE_MAJORITY_ANOMALY"
        action = "Multi-model anomaly confirmed: isolate affected resources and verify network path"
    elif anomaly_votes == 1 or is_hard_warning:
        status = "WARNING"
        rule = "PARTIAL_ANOMALY_OR_WARNING"
        action = "Anomaly detected by partial ensemble: monitor host telemetry and review logs"
    else:
        status = "NORMAL"
        rule = "NOMINAL_CONSENSUS"
        action = "All active models and telemetry thresholds confirm nominal operations"

    # Confidence calculation: agreement ratio
    if active_models > 0:
        agreement = max(anomaly_votes, active_models - anomaly_votes) / float(active_models)
        confidence_weight = round(agreement * 100.0, 1)
    else:
        confidence_weight = 0.0

    return {
        "status": status,
        "verdict": status,
        "rule": rule,
        "action": action,
        "active_models": active_models,
        "contributing_models": active_models,
        "anomaly_votes": anomaly_votes,
        "confidence_weight": confidence_weight,
        "evidence": evidence,
        "decided_at": now_iso,
    }


if __name__ == "__main__":
    sample_iso = {"status": "ANOMALY", "score": -0.12}
    sample_rf = {"status": "ANOMALY", "class_name": "HIGH_CPU_LOAD", "confidence": 92.5}
    sample_lstm = {"status": "NORMAL", "deviation_score": 0.04}
    sample_metrics = {"cpu_usage_percent": 96.0, "memory_usage_percent": 45.0, "latency_ms": 15.0}

    decision = evaluate_decision(
        isolation_result=sample_iso,
        random_forest_result=sample_rf,
        lstm_result=sample_lstm,
        current_metrics=sample_metrics,
    )
    print("Decision Output:")
    for k, v in decision.items():
        print(f"  {k}: {v}")

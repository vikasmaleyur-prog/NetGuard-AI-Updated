"""
NetGuard AI - AI & Anomaly Detection Service
Orchestrates Isolation Forest, Random Forest, LSTM, and the Ensemble Decision Engine.
Grounded strictly in verified model outputs and transparent confidence metrics.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from database.connection import monitoring_collection, storage_manager

FEATURES = [
    "cpu_usage_percent",
    "memory_usage_percent",
    "disk_usage_percent",
    "bytes_sent",
    "bytes_received",
    "packets_sent",
    "packets_received",
    "errors_in",
    "errors_out",
    "drops_in",
    "drops_out",
    "latency_ms",
]

# Cache trained models in memory
_isolation_forest_model = None
_random_forest_model = None
_lstm_runtime_available = False
_last_run_timestamp = None


def check_lstm_availability() -> Tuple[bool, str]:
    """Check if TensorFlow / Keras runtime is available to load netguard_lstm.keras."""
    global _lstm_runtime_available
    keras_path = Path(__file__).resolve().parent / "netguard_lstm.keras"
    if not keras_path.exists():
        return False, "Model file netguard_lstm.keras not found"
    try:
        import tensorflow as tf
        _lstm_runtime_available = True
        return True, "TensorFlow runtime available"
    except ImportError:
        _lstm_runtime_available = False
        return False, "TensorFlow runtime not installed in environment (Python 3.13)"


def extract_feature_vector(metrics: dict) -> List[float]:
    """Extract ordered numerical features from a metrics dictionary."""
    row = []
    for feat in FEATURES:
        val = metrics.get(feat, 0)
        if val is None:
            val = 0.0
        try:
            row.append(float(val))
        except (ValueError, TypeError):
            row.append(0.0)
    return row


def get_all_records() -> List[dict]:
    """Fetch chronological monitoring records from active storage."""
    cursor = monitoring_collection.find({})
    cursor.sort("_id", 1)
    return list(cursor)


def train_isolation_forest_if_needed(records: List[dict]):
    """Train or refresh Isolation Forest model using stored telemetry."""
    global _isolation_forest_model
    if len(records) < 5:
        return None, "Requires at least 5 monitoring records to fit Isolation Forest."

    from sklearn.ensemble import IsolationForest

    data = [extract_feature_vector(r.get("metrics", {})) for r in records]
    contamination = min(0.2, max(0.05, 1.0 / len(data)))
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42
    )
    model.fit(data)
    _isolation_forest_model = model
    return model, "Trained successfully"


def train_random_forest_if_needed(records: List[dict]):
    """Train Random Forest classifier if labeled anomalies exist in dataset."""
    global _random_forest_model
    if len(records) < 10:
        return None, "Requires at least 10 records for Random Forest training."

    labels = []
    for r in records:
        status = r.get("ai_analysis", {}).get("status")
        if status == "ANOMALY":
            labels.append(1)
        elif status == "NORMAL":
            labels.append(0)
        else:
            labels.append(0)

    anomaly_count = sum(labels)
    if anomaly_count == 0 or anomaly_count == len(labels):
        return None, f"Requires both normal and anomaly samples to train (found {anomaly_count} anomalies in {len(labels)} records)."

    from sklearn.ensemble import RandomForestClassifier

    data = [extract_feature_vector(r.get("metrics", {})) for r in records]
    model = RandomForestClassifier(
        n_estimators=50,
        max_depth=6,
        random_state=42,
        class_weight="balanced"
    )
    model.fit(data, labels)
    _random_forest_model = model
    return model, "Trained successfully"


def run_full_inference(latest_metrics: Optional[dict] = None) -> Dict[str, Any]:
    """
    Execute AI inference on current metrics using all verified active models.
    Returns honest results with transparent explanations.
    """
    global _last_run_timestamp
    records = get_all_records()

    if not latest_metrics:
        if records:
            latest_record = records[-1]
            latest_metrics = latest_record.get("metrics", {})
        else:
            return {
                "status": "INSUFFICIENT_DATA",
                "message": "No monitoring records available for AI analysis",
                "models": {
                    "isolation_forest": {"status": "NOT CONFIGURED", "score": None, "detail": "No records in database"},
                    "random_forest": {"status": "NOT CONFIGURED", "confidence": None, "detail": "No training samples"},
                    "lstm": {"status": "NOT CONFIGURED", "detail": "TensorFlow runtime not available for Python 3.13"}
                },
                "decision": {
                    "status": "INSUFFICIENT DATA",
                    "action": "Collect telemetry to begin AI evaluation",
                    "anomaly_votes": 0,
                    "confidence_weight": 0.0
                },
                "analyzed_at": datetime.now(timezone.utc).isoformat()
            }

    sample = [extract_feature_vector(latest_metrics)]
    now_iso = datetime.now(timezone.utc).isoformat()
    _last_run_timestamp = now_iso

    active_votes = 0
    total_active_models = 0
    model_results = {}

    # 1. Isolation Forest
    global _isolation_forest_model
    if _isolation_forest_model is None or len(records) >= 5:
        _isolation_forest_model, if_msg = train_isolation_forest_if_needed(records)

    if _isolation_forest_model is not None:
        try:
            pred = _isolation_forest_model.predict(sample)[0]
            score = float(_isolation_forest_model.decision_function(sample)[0])
            status = "ANOMALY" if pred == -1 else "NORMAL"
            model_results["isolation_forest"] = {
                "status": status,
                "score": round(score, 4),
                "algorithm": "Isolation Forest (Unsupervised)",
                "detail": f"Anomaly score {round(score, 4)} (negative indicates anomaly boundary deviation)"
            }
            total_active_models += 1
            if status == "ANOMALY":
                active_votes += 1
        except Exception as e:
            model_results["isolation_forest"] = {
                "status": "ERROR",
                "score": None,
                "detail": str(e)
            }
    else:
        model_results["isolation_forest"] = {
            "status": "INSUFFICIENT DATA",
            "score": None,
            "detail": f"Need at least 5 records ({len(records)} available)"
        }

    # 2. Random Forest
    global _random_forest_model
    if _random_forest_model is None and len(records) >= 10:
        _random_forest_model, rf_msg = train_random_forest_if_needed(records)

    if _random_forest_model is not None:
        try:
            rf_pred = _random_forest_model.predict(sample)[0]
            probs = _random_forest_model.predict_proba(sample)[0]
            rf_status = "ANOMALY" if rf_pred == 1 else "NORMAL"
            confidence = float(probs[1] if rf_pred == 1 else probs[0])
            model_results["random_forest"] = {
                "status": rf_status,
                "confidence": round(confidence * 100, 1),
                "algorithm": "Random Forest (Supervised)",
                "detail": f"{round(confidence * 100, 1)}% confidence"
            }
            total_active_models += 1
            if rf_status == "ANOMALY":
                active_votes += 1
        except Exception as e:
            model_results["random_forest"] = {
                "status": "ERROR",
                "confidence": None,
                "detail": str(e)
            }
    else:
        model_results["random_forest"] = {
            "status": "NOT CONFIGURED",
            "confidence": None,
            "detail": f"Requires labeled dataset ({len(records)} records currently stored)"
        }

    # 3. LSTM
    lstm_ok, lstm_msg = check_lstm_availability()
    if lstm_ok:
        model_results["lstm"] = {
            "status": "STANDBY",
            "detail": "Keras model available; sequence window building"
        }
    else:
        model_results["lstm"] = {
            "status": "NOT CONFIGURED",
            "detail": lstm_msg
        }

    # Ensemble Decision Logic:
    # Based strictly on active, verified models
    if total_active_models == 0:
        decision_status = "INSUFFICIENT DATA"
        action = "Gathering telemetry samples to train baseline models"
    elif active_votes >= 2 or (total_active_models == 1 and active_votes == 1):
        decision_status = "CRITICAL"
        action = "Investigate anomalous network metrics and apply corrective controls"
    elif active_votes == 1:
        decision_status = "WARNING"
        action = "Anomaly detected by partial ensemble; continue monitoring closely"
    else:
        decision_status = "NORMAL"
        action = "All active models report metrics within nominal thresholds"

    decision = {
        "status": decision_status,
        "action": action,
        "anomaly_votes": active_votes,
        "active_models": total_active_models,
        "decided_at": now_iso
    }

    # Save to latest document in database if records exist
    if records:
        latest_id = records[-1]["_id"]
        monitoring_collection.update_one(
            {"_id": latest_id},
            {
                "$set": {
                    "ai_analysis": {
                        "status": model_results.get("isolation_forest", {}).get("status", "UNKNOWN"),
                        "anomaly_score": model_results.get("isolation_forest", {}).get("score"),
                        "random_forest_status": model_results.get("random_forest", {}).get("status", "UNKNOWN"),
                        "random_forest_confidence": model_results.get("random_forest", {}).get("confidence"),
                        "lstm_status": model_results.get("lstm", {}).get("status", "NOT CONFIGURED"),
                        "analyzed_at": now_iso
                    },
                    "decision": decision
                }
            }
        )

        # Trigger security alert if CRITICAL or WARNING
        if decision_status in ["CRITICAL", "WARNING"]:
            storage_manager.add_alert(
                severity=decision_status,
                title=f"AI Anomaly Detected: {decision_status}",
                message=action,
                source="AI Ensemble Engine",
                metadata={"models": model_results, "metrics": latest_metrics}
            )

    return {
        "status": "SUCCESS",
        "models": model_results,
        "decision": decision,
        "analyzed_at": now_iso
    }

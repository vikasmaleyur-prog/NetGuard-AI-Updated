"""
NetGuard AI - AI & Anomaly Detection Service
Coordinated AI orchestration service integrating Isolation Forest, Random Forest,
LSTM temporal sequence prediction, and the Ensemble Decision Engine.

Thread-safe, non-blocking, and grounded strictly in verified outputs.
"""

import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai.anomaly_detector import FEATURES, extract_features as extract_feature_vector
from ai.anomaly_detector import predict_single as if_predict
from ai.decision_engine import evaluate_decision
from ai.lstm_model import evaluate_sequence as lstm_evaluate
from ai.random_forest import classify_issue as rf_classify
from database.connection import monitoring_collection, storage_manager

_inference_lock = threading.Lock()
_last_inference_result: Optional[Dict[str, Any]] = None
_last_run_timestamp: Optional[str] = None


def get_recent_records(limit: int = 50) -> List[dict]:
    """Retrieve chronological recent records from active storage."""
    cursor = monitoring_collection.find({})
    cursor.sort("_id", 1)
    records = list(cursor)
    return records[-limit:] if records else []


def run_full_inference(latest_metrics: Optional[dict] = None) -> Dict[str, Any]:
    """
    Execute end-to-end AI anomaly detection and classification across all active models.
    Guarantees thread-safe inference and persists results to the authoritative telemetry record.
    """
    global _last_inference_result, _last_run_timestamp

    with _inference_lock:
        now_iso = datetime.now(timezone.utc).isoformat()
        records = get_recent_records(limit=60)

        if not latest_metrics:
            if records:
                latest_metrics = records[-1].get("metrics", {})
            else:
                return {
                    "status": "INSUFFICIENT_DATA",
                    "message": "No telemetry records stored to evaluate",
                    "models": {
                        "isolation_forest": {
                            "status": "NOT CONFIGURED",
                            "score": None,
                            "detail": "No telemetry captured yet",
                        },
                        "random_forest": {
                            "status": "NOT CONFIGURED",
                            "confidence": None,
                            "detail": "No telemetry captured yet",
                        },
                        "lstm": {
                            "status": "NOT CONFIGURED",
                            "detail": "No telemetry captured yet",
                        },
                    },
                    "decision": {
                        "status": "INSUFFICIENT DATA",
                        "verdict": "INSUFFICIENT DATA",
                        "action": "Collector starting telemetry capture",
                        "active_models": 0,
                        "anomaly_votes": 0,
                        "confidence_weight": 0.0,
                        "evidence": ["Waiting for initial telemetry frames"],
                        "decided_at": now_iso,
                    },
                    "analyzed_at": now_iso,
                }

        # 1. Isolation Forest Inference
        iso_res = if_predict(latest_metrics, records=records)

        # 2. Random Forest Issue Classification
        rf_res = rf_classify(latest_metrics)

        # 3. LSTM Sequence Forecasting
        lstm_res = lstm_evaluate(records)

        # 4. Read system thresholds for decision engine
        try:
            settings = storage_manager.get_settings()
        except Exception:
            settings = {}

        thresholds = {
            "cpu_warning_threshold": float(settings.get("cpu_warning_threshold", 80.0)),
            "cpu_critical_threshold": float(settings.get("cpu_critical_threshold", 95.0)),
            "memory_warning_threshold": float(settings.get("memory_warning_threshold", 85.0)),
            "latency_warning_threshold": float(settings.get("latency_warning_threshold", 100.0)),
        }

        # 5. Ensemble Decision Formulation
        decision_res = evaluate_decision(
            isolation_result=iso_res,
            random_forest_result=rf_res,
            lstm_result=lstm_res,
            current_metrics=latest_metrics,
            thresholds=thresholds,
        )

        models_dict = {
            "isolation_forest": iso_res,
            "random_forest": rf_res,
            "lstm": lstm_res,
        }

        result = {
            "status": "SUCCESS",
            "models": models_dict,
            "decision": decision_res,
            "analyzed_at": now_iso,
        }

        # 6. Update database record with AI analysis and decision
        if records:
            latest_id = records[-1]["_id"]
            monitoring_collection.update_one(
                {"_id": latest_id},
                {
                    "$set": {
                        "ai_analysis": {
                            "status": iso_res.get("status", "NOT CONFIGURED"),
                            "anomaly_score": iso_res.get("score"),
                            "random_forest_status": rf_res.get("status", "NOT CONFIGURED"),
                            "random_forest_confidence": rf_res.get("confidence"),
                            "random_forest_class": rf_res.get("class_name"),
                            "lstm_status": lstm_res.get("status", "NOT CONFIGURED"),
                            "lstm_deviation": lstm_res.get("deviation_score"),
                            "isolation_forest": iso_res,
                            "random_forest": rf_res,
                            "lstm": lstm_res,
                            "models": models_dict,
                            "analyzed_at": now_iso,
                        },
                        "decision": decision_res,
                    }
                },
            )

            # 7. Generate actionable alert on WARNING or CRITICAL conditions
            dec_status = decision_res.get("status")
            if dec_status in ["CRITICAL", "WARNING"]:
                storage_manager.add_alert(
                    severity=dec_status,
                    title=f"AI Consensus Anomaly: {dec_status}",
                    message=decision_res.get("action", "Anomalous telemetry detected"),
                    source="AI Consensus Engine",
                    metadata={
                        "rule": decision_res.get("rule"),
                        "models": models_dict,
                        "evidence": decision_res.get("evidence", []),
                    },
                )

        _last_inference_result = result
        _last_run_timestamp = now_iso
        return result


if __name__ == "__main__":
    res = run_full_inference()
    print("Full AI Inference Result:")
    print("Decision:", res["decision"])
    print("Models:", res["models"])

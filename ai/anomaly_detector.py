"""
NetGuard AI - Isolation Forest Anomaly Detection
Unsupervised anomaly detection across 12 host and network telemetry dimensions.
Supports persistent model artifacts, configurable anomaly thresholds, and independent inference.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from database.connection import monitoring_collection

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

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"
DEFAULT_CONTAMINATION = 0.10
DEFAULT_THRESHOLD = 0.0

_cached_model: Optional[IsolationForest] = None


def extract_features(record: dict) -> List[float]:
    """Extract ordered 12-dimensional numerical feature vector from a monitoring record."""
    metrics = record.get("metrics", {}) if "metrics" in record else record
    row = []
    for feat in FEATURES:
        val = metrics.get(feat, 0.0)
        if val is None:
            val = 0.0
        try:
            row.append(float(val))
        except (ValueError, TypeError):
            row.append(0.0)
    return row


def train_isolation_forest(
    records: List[dict],
    contamination: float = DEFAULT_CONTAMINATION,
    save_path: Optional[Path] = None
) -> Tuple[Optional[IsolationForest], str]:
    """
    Train Isolation Forest model on historical telemetry records and persist artifact to disk.
    Requires at least 5 samples.
    """
    global _cached_model

    if len(records) < 5:
        return None, f"Insufficient records for training: {len(records)} provided, minimum 5 required."

    data = [extract_features(r) for r in records]
    contamination = min(0.25, max(0.02, contamination))

    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
    )
    model.fit(data)
    _cached_model = model

    target_path = save_path or MODEL_PATH
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, str(target_path))
    except Exception as err:
        return model, f"Trained successfully, but artifact persistence failed: {err}"

    return model, f"Trained successfully on {len(data)} records with contamination={contamination}."


def get_model(records: Optional[List[dict]] = None) -> Tuple[Optional[IsolationForest], str]:
    """
    Load persisted model from disk if available, or train from records if available.
    """
    global _cached_model

    if _cached_model is not None:
        return _cached_model, "Using in-memory cached model."

    if MODEL_PATH.exists():
        try:
            _cached_model = joblib.load(str(MODEL_PATH))
            return _cached_model, f"Loaded model from {MODEL_PATH.name}."
        except Exception:
            pass

    if records and len(records) >= 5:
        return train_isolation_forest(records)

    return None, "Model not initialized and insufficient records to fit baseline."


def predict_single(
    metrics: dict,
    threshold: float = DEFAULT_THRESHOLD,
    records: Optional[List[dict]] = None
) -> Dict[str, Any]:
    """
    Execute Isolation Forest inference against a single telemetry reading.
    Returns score, status ('NORMAL' | 'ANOMALY'), threshold, and explanatory detail.
    """
    model, msg = get_model(records)
    if model is None:
        return {
            "status": "INSUFFICIENT DATA",
            "score": None,
            "threshold": threshold,
            "algorithm": "Isolation Forest (Unsupervised)",
            "detail": msg,
        }

    features = [extract_features(metrics)]
    try:
        score = float(model.decision_function(features)[0])
        status = "ANOMALY" if score < threshold else "NORMAL"
        return {
            "status": status,
            "score": round(score, 4),
            "threshold": threshold,
            "algorithm": "Isolation Forest (Unsupervised)",
            "detail": f"Anomaly score {round(score, 4)} (score < {threshold} denotes anomaly boundary deviation)",
        }
    except Exception as err:
        return {
            "status": "ERROR",
            "score": None,
            "threshold": threshold,
            "algorithm": "Isolation Forest (Unsupervised)",
            "detail": f"Inference execution failed: {err}",
        }


if __name__ == "__main__":
    recs = list(monitoring_collection.find({}))
    model, msg = get_model(recs)
    print(f"Isolation Forest status: {msg}")
    if recs:
        res = predict_single(recs[-1].get("metrics", {}), records=recs)
        print("Inference result:", res)

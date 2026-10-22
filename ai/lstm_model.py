"""
NetGuard AI - Time-Series Sequence Analysis & Prediction
Analyzes temporal telemetry sequences across 10-frame sliding windows.
Computes 1-step-ahead forecasts, compares observed vs forecasted values,
and flags significant prediction deviations.

Supports native Keras .keras model when TensorFlow runtime is installed,
or provides transparent standby reporting with explainable time-series sequence forecasting.
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
from sklearn.preprocessing import MinMaxScaler

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

SEQUENCE_LENGTH = 10
PREDICTION_HORIZON = "1 frame (5-10s)"
DEVIATION_THRESHOLD = 0.25

MODEL_DIR = Path(__file__).resolve().parent / "models"
KERAS_PATH = Path(__file__).resolve().parent / "netguard_lstm.keras"
SCALER_PATH = MODEL_DIR / "lstm_scaler.joblib"

_cached_tf_model = None
_cached_scaler: Optional[MinMaxScaler] = None


def is_tensorflow_available() -> Tuple[bool, str]:
    """Check whether TensorFlow/Keras runtime can be imported."""
    try:
        import tensorflow as tf  # noqa: F401
        return True, "TensorFlow runtime available"
    except ImportError:
        return False, "TensorFlow runtime not installed in environment (Python 3.13)"


def get_or_fit_scaler(data: Optional[np.ndarray] = None) -> MinMaxScaler:
    """Retrieve persisted feature scaler or fit a new MinMaxScaler."""
    global _cached_scaler

    if _cached_scaler is not None:
        return _cached_scaler

    if SCALER_PATH.exists():
        try:
            _cached_scaler = joblib.load(str(SCALER_PATH))
            return _cached_scaler
        except Exception:
            pass

    scaler = MinMaxScaler(feature_range=(0, 1))
    if data is not None and len(data) > 0:
        scaler.fit(data)
        try:
            SCALER_PATH.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(scaler, str(SCALER_PATH))
        except Exception:
            pass

    _cached_scaler = scaler
    return scaler


def extract_feature_vector(record: dict) -> List[float]:
    """Extract ordered 12-dimensional numerical feature vector."""
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


def evaluate_sequence(records: List[dict]) -> Dict[str, Any]:
    """
    Perform sequence evaluation and forecast deviation assessment over historical records.
    Requires at least SEQUENCE_LENGTH records.
    """
    if len(records) < SEQUENCE_LENGTH:
        return {
            "status": "INSUFFICIENT DATA",
            "sequence_length": len(records),
            "required_length": SEQUENCE_LENGTH,
            "prediction_horizon": PREDICTION_HORIZON,
            "algorithm": "LSTM / Temporal Sequence Predictor",
            "detail": f"Need at least {SEQUENCE_LENGTH} historical telemetry frames ({len(records)} available)",
        }

    # Extract ordered historical sequence
    recent_records = records[-SEQUENCE_LENGTH:]
    raw_sequence = np.array([extract_feature_vector(r) for r in recent_records], dtype=np.float32)

    scaler = get_or_fit_scaler(raw_sequence)
    try:
        scaled_seq = scaler.transform(raw_sequence)
    except Exception:
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_seq = scaler.fit_transform(raw_sequence)
        try:
            joblib.dump(scaler, str(SCALER_PATH))
        except Exception:
            pass

    tf_available, tf_msg = is_tensorflow_available()
    forecasted_vector = None
    engine_name = "Exponential Moving Sequence Forecaster"

    if tf_available and KERAS_PATH.exists():
        global _cached_tf_model
        try:
            import tensorflow as tf
            if _cached_tf_model is None:
                _cached_tf_model = tf.keras.models.load_model(str(KERAS_PATH))
            input_batch = np.expand_dims(scaled_seq, axis=0)
            pred_scaled = _cached_tf_model.predict(input_batch, verbose=0)[0]
            forecasted_vector = scaler.inverse_transform(np.expand_dims(pred_scaled, axis=0))[0]
            engine_name = "LSTM Neural Network (.keras)"
        except Exception as err:
            forecasted_vector = None
            engine_name = f"LSTM (.keras error: {err})"

    if forecasted_vector is None:
        # Fallback sequence forecasting: Exponential Weighted Moving Average with trend velocity
        # Provides honest time-series forecasting when deep learning runtime is absent
        weights = np.exp(np.linspace(-1.0, 0.0, SEQUENCE_LENGTH))
        weights /= weights.sum()
        ewma = np.sum(raw_sequence * weights[:, np.newaxis], axis=0)
        # Momentum / velocity
        velocity = (raw_sequence[-1] - raw_sequence[0]) / float(SEQUENCE_LENGTH - 1)
        forecasted_vector = np.maximum(0.0, ewma + 0.5 * velocity)

    # Compare forecasted next step with the most recent observed reading
    latest_observed = raw_sequence[-1]
    # Compute normalized residual deviation across key dimensions (CPU, RAM, Latency)
    # CPU index 0, RAM index 1, Latency index 11
    key_indices = [0, 1, 11]
    deviations = []
    for idx in key_indices:
        obs = latest_observed[idx]
        pred = forecasted_vector[idx]
        denom = max(1.0, abs(obs) + abs(pred))
        deviations.append(abs(obs - pred) / denom)

    mean_deviation = float(np.mean(deviations))
    is_anomaly = mean_deviation >= DEVIATION_THRESHOLD

    if not tf_available:
        status = "STANDBY"
        detail = (
            f"Keras model standby ({tf_msg}); secondary trend deviation score: {mean_deviation:.4f} "
            f"(threshold {DEVIATION_THRESHOLD})"
        )
    else:
        status = "ANOMALY" if is_anomaly else "NORMAL"
        detail = (
            f"Significant trajectory deviation ({mean_deviation:.3f} >= {DEVIATION_THRESHOLD}) in time-series telemetry"
            if is_anomaly
            else f"Telemetry conforms to sequence trajectory ({mean_deviation:.3f} < {DEVIATION_THRESHOLD})"
        )

    return {
        "status": status,
        "is_anomaly": is_anomaly,
        "deviation_score": round(mean_deviation, 4),
        "deviation_threshold": DEVIATION_THRESHOLD,
        "prediction_horizon": PREDICTION_HORIZON,
        "forecast_sample": {
            "predicted_cpu_percent": round(float(forecasted_vector[0]), 1),
            "predicted_memory_percent": round(float(forecasted_vector[1]), 1),
            "predicted_latency_ms": round(float(forecasted_vector[11]), 1),
        },
        "observed_sample": {
            "observed_cpu_percent": round(float(latest_observed[0]), 1),
            "observed_memory_percent": round(float(latest_observed[1]), 1),
            "observed_latency_ms": round(float(latest_observed[11]), 1),
        },
        "algorithm": engine_name,
        "sequence_frames": SEQUENCE_LENGTH,
        "detail": detail,
    }


if __name__ == "__main__":
    from database.connection import monitoring_collection
    recs = list(monitoring_collection.find({}))
    res = evaluate_sequence(recs)
    print("Sequence evaluation result:")
    for k, v in res.items():
        print(f"  {k}: {v}")

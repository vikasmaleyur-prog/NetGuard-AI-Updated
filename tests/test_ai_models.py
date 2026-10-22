"""
NetGuard AI - AI Models Unit & Integration Tests
Validates Isolation Forest, Random Forest Issue Classifier, and LSTM Time-Series Forecaster.
"""

import numpy as np
from ai.anomaly_detector import extract_features, predict_single, train_isolation_forest, FEATURES
from ai.random_forest import classify_issue, train_and_evaluate, CLASS_NAMES
from ai.lstm_model import evaluate_sequence, SEQUENCE_LENGTH


def test_isolation_forest_pipeline():
    """Verify Isolation Forest handles feature extraction, training, and inference."""
    assert len(FEATURES) == 12

    # Insufficient records
    insufficient_res = predict_single({"cpu_usage_percent": 25.0}, records=[])
    assert insufficient_res["status"] in ["INSUFFICIENT DATA", "NORMAL", "ANOMALY"]

    # Generate synthetic training records
    synthetic_records = [
        {"metrics": {f: 10.0 + i for f in FEATURES}}
        for i in range(10)
    ]
    model, msg = train_isolation_forest(synthetic_records)
    assert model is not None

    # Test inference
    result = predict_single({"cpu_usage_percent": 15.0}, records=synthetic_records)
    assert result["status"] in ["NORMAL", "ANOMALY"]
    assert "score" in result
    assert result["threshold"] == 0.0


def test_random_forest_issue_classification():
    """Verify Random Forest classifies diagnostic issue categories with confidence scores."""
    # Classify nominal sample
    nominal_sample = {
        "cpu_usage_percent": 20.0,
        "memory_usage_percent": 35.0,
        "latency_ms": 15.0,
    }
    res_nom = classify_issue(nominal_sample)
    assert res_nom["status"] in ["NORMAL", "ANOMALY"]
    assert "class_name" in res_nom
    assert res_nom["confidence"] is not None
    assert 0.0 <= res_nom["confidence"] <= 100.0

    # Classify high CPU saturation sample
    cpu_spike_sample = {
        "cpu_usage_percent": 98.0,
        "memory_usage_percent": 45.0,
        "latency_ms": 20.0,
    }
    res_cpu = classify_issue(cpu_spike_sample)
    assert res_cpu["status"] == "ANOMALY"
    assert res_cpu["class_name"] == "HIGH_CPU_LOAD"
    assert res_cpu["confidence"] >= 50.0


def test_lstm_sequence_forecaster():
    """Verify LSTM handles insufficient history and sliding window evaluation."""
    # Under-threshold history
    short_records = [{"metrics": {f: 10.0 for f in FEATURES}} for _ in range(3)]
    res_short = evaluate_sequence(short_records)
    assert res_short["status"] == "INSUFFICIENT DATA"
    assert res_short["required_length"] == SEQUENCE_LENGTH

    # 10 frames sequence
    full_records = [{"metrics": {f: 20.0 + i * 0.5 for f in FEATURES}} for i in range(12)]
    res_full = evaluate_sequence(full_records)
    assert res_full["status"] in ["STANDBY", "NORMAL", "ANOMALY"]
    assert "deviation_score" in res_full
    assert "forecast_sample" in res_full

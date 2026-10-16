from datetime import datetime, timezone

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


def load_monitoring_data():
    """Load monitoring records from MongoDB."""

    records = list(
        monitoring_collection.find({}).sort("_id", 1)
    )

    return records


def prepare_features(records):
    """Convert MongoDB records into ML feature data."""

    data = []

    for record in records:
        metrics = record.get("metrics", {})

        row = [
            metrics.get(feature, 0)
            for feature in FEATURES
        ]

        data.append(row)

    return data


def train_isolation_forest(data):
    """Train the Isolation Forest model."""

    model = IsolationForest(
        n_estimators=100,
        contamination=0.15,
        random_state=42
    )

    model.fit(data)

    return model


def detect_anomalies(model, data):
    """Detect anomalies and calculate anomaly scores."""

    predictions = model.predict(data)
    scores = model.decision_function(data)

    results = []

    for prediction, score in zip(predictions, scores):

        status = "ANOMALY" if prediction == -1 else "NORMAL"

        results.append({
            "status": status,
            "anomaly_score": round(float(score), 4)
        })

    return results


def save_ai_results(records, results):
    """Store AI analysis results inside the corresponding MongoDB records."""

    for record, result in zip(records, results):

        monitoring_collection.update_one(
            {"_id": record["_id"]},
            {
                "$set": {
                    "ai_analysis": {
                        "algorithm": "Isolation Forest",
                        "status": result["status"],
                        "anomaly_score": result["anomaly_score"],
                        "analyzed_at": datetime.now(timezone.utc)
                    }
                }
            }
        )


def run_anomaly_detection():
    """Run the complete Isolation Forest pipeline."""

    records = load_monitoring_data()

    if len(records) < 5:
        raise RuntimeError(
            "Not enough monitoring records for anomaly detection."
        )

    data = prepare_features(records)

    model = train_isolation_forest(data)

    results = detect_anomalies(model, data)

    save_ai_results(records, results)

    print("NetGuard AI - Isolation Forest")
    print("--------------------------------")

    for index, result in enumerate(results, start=1):

        print(
            f"Record {index}: "
            f"{result['status']} | "
            f"Score: {result['anomaly_score']}"
        )

    print("--------------------------------")
    print(f"Records analyzed: {len(records)}")

    anomalies = sum(
        1
        for result in results
        if result["status"] == "ANOMALY"
    )

    print(f"Anomalies detected: {anomalies}")
    print("AI results saved to MongoDB.")


if __name__ == "__main__":
    run_anomaly_detection()
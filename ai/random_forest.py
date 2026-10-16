from sklearn.ensemble import RandomForestClassifier

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
        monitoring_collection.find({})
    )

    return records


def prepare_features(records):
    """Convert MongoDB monitoring records into ML features."""

    data = []

    for record in records:
        metrics = record.get("metrics", {})

        row = [
            metrics.get(feature, 0)
            for feature in FEATURES
        ]

        data.append(row)

    return data


def create_labels(records):
    """
    Create training labels using Isolation Forest results.

    0 = NORMAL
    1 = ANOMALY
    """

    labels = []

    for record in records:
        ai_analysis = record.get("ai_analysis", {})

        status = ai_analysis.get(
            "status",
            "NORMAL"
        )

        if status == "ANOMALY":
            labels.append(1)
        else:
            labels.append(0)

    return labels


def train_random_forest(data, labels):
    """Train the Random Forest classification model."""

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        class_weight="balanced"
    )

    model.fit(data, labels)

    return model


def predict_anomalies(model, data):
    """Predict network status using Random Forest."""

    predictions = model.predict(data)
    probabilities = model.predict_proba(data)

    results = []

    for prediction, probability in zip(
        predictions,
        probabilities
    ):

        if prediction == 1:
            status = "ANOMALY"
            confidence = probability[1]
        else:
            status = "NORMAL"
            confidence = probability[0]

        results.append({
            "status": status,
            "confidence": round(
                float(confidence),
                4
            )
        })

    return results


def save_random_forest_results(records, results):
    """Save Random Forest results to MongoDB."""

    for record, result in zip(
        records,
        results
    ):

        monitoring_collection.update_one(
            {
                "_id": record["_id"]
            },
            {
                "$set": {
                    "ai_analysis.random_forest_status":
                        result["status"],

                    "ai_analysis.random_forest_confidence":
                        result["confidence"]
                }
            }
        )


def run_random_forest():
    """Complete Random Forest pipeline."""

    records = load_monitoring_data()

    if len(records) < 10:
        raise RuntimeError(
            "Not enough monitoring records for Random Forest."
        )

    data = prepare_features(records)

    labels = create_labels(records)

    anomaly_count = sum(labels)

    if anomaly_count == 0:
        raise RuntimeError(
            "No anomaly labels found. "
            "Run Isolation Forest first."
        )

    model = train_random_forest(
        data,
        labels
    )

    results = predict_anomalies(
        model,
        data
    )

    print("NetGuard AI - Random Forest")
    print("--------------------------------")

    for index, result in enumerate(
        results[-10:],
        start=max(1, len(results) - 9)
    ):

        print(
            f"Record {index}: "
            f"{result['status']} | "
            f"Confidence: "
            f"{result['confidence']}"
        )

    print("--------------------------------")

    print(
        f"Records analyzed: "
        f"{len(records)}"
    )

    print(
        f"Training anomalies: "
        f"{anomaly_count}"
    )

    predicted_anomalies = sum(
        1
        for result in results
        if result["status"] == "ANOMALY"
    )

    print(
        f"Predicted anomalies: "
        f"{predicted_anomalies}"
    )

    # Save Random Forest results to MongoDB
    save_random_forest_results(
        records,
        results
    )

    print(
        "Random Forest results "
        "saved to MongoDB."
    )

    return model, results


if __name__ == "__main__":
    records = load_monitoring_data()

    model, results = run_random_forest()

    save_random_forest_results(records, results)

    print("Random Forest results saved to MongoDB.")
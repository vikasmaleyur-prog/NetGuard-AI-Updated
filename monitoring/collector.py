from datetime import datetime, timezone

from monitoring.system_monitor import get_system_metrics
from monitoring.network_monitor import get_network_metrics
from monitoring.latency_monitor import get_latency
from database.connection import save_metrics


def collect_metrics():
    """Collect all monitoring metrics."""

    metrics = {}

    # System metrics
    metrics.update(get_system_metrics())

    # Network metrics
    metrics.update(get_network_metrics())

    # Latency
    metrics["latency_ms"] = get_latency()

    # Timestamp for time-series analysis
    metrics["timestamp"] = datetime.now(timezone.utc)

    return metrics


if __name__ == "__main__":
    metrics = collect_metrics()

    print("NetGuard AI - Complete Monitoring Data")
    print("--------------------------------------")

    for key, value in metrics.items():
        print(f"{key}: {value}")

    # Save metrics to MongoDB
    try:
        document_id = save_metrics(metrics)

        print("--------------------------------------")
        print(f"Saved to MongoDB: {document_id}")

    except Exception as error:
        print("--------------------------------------")
        print(f"MongoDB save failed: {error}")
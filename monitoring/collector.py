"""
NetGuard AI - Complete Telemetry Collector
Aggregates CPU, memory, disk, network, throughput, and latency measurements.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from monitoring.system_monitor import get_system_metrics
from monitoring.network_monitor import get_network_metrics
from monitoring.latency_monitor import get_latency
from database.connection import save_metrics


def collect_metrics():
    """Collect all monitoring metrics into a single timestamped dictionary."""
    metrics = {}

    # System metrics
    metrics.update(get_system_metrics())

    # Network metrics & throughput rates
    metrics.update(get_network_metrics())

    # Latency
    metrics["latency_ms"] = get_latency()

    # ISO Timestamp for chronological time-series analysis
    now = datetime.now(timezone.utc)
    metrics["timestamp"] = now.isoformat()

    return metrics


if __name__ == "__main__":
    metrics = collect_metrics()
    print("NetGuard AI - Complete Monitoring Data")
    print("--------------------------------------")
    for key, value in metrics.items():
        print(f"{key}: {value}")

    try:
        document_id = save_metrics(metrics)
        print("--------------------------------------")
        print(f"Saved to database: {document_id}")
    except Exception as error:
        print("--------------------------------------")
        print(f"Database save failed: {error}")
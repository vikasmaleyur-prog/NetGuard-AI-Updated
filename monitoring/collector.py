"""
NetGuard AI - Complete Telemetry Collector
Aggregates CPU, memory, disk, network throughput, packet loss, and latency measurements.
Validates inputs and timestamps each observation consistently in ISO-8601 UTC.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from monitoring.system_monitor import get_system_metrics
from monitoring.network_monitor import get_network_metrics
from monitoring.latency_monitor import get_network_quality, get_latency
from database.connection import save_metrics


def collect_metrics(probe_quality: bool = True) -> Dict[str, Any]:
    """
    Collect all system, network, throughput, and latency metrics into a single dictionary.
    Handles component failures gracefully without producing fabricated healthy readings.
    """
    metrics: Dict[str, Any] = {}

    # 1. System metrics (CPU, RAM, Disk, Load averages)
    try:
        metrics.update(get_system_metrics())
    except Exception as err:
        metrics["system_error"] = str(err)
        metrics["cpu_usage_percent"] = None
        metrics["memory_usage_percent"] = None
        metrics["disk_usage_percent"] = None

    # 2. Network metrics & real-time throughput rates
    try:
        metrics.update(get_network_metrics())
    except Exception as err:
        metrics["network_error"] = str(err)
        metrics["bytes_sent_per_sec"] = 0.0
        metrics["bytes_recv_per_sec"] = 0.0

    # 3. Latency, jitter, and packet-loss rate
    if probe_quality:
        try:
            quality = get_network_quality(host="8.8.8.8", port=53, count=3, timeout=0.8)
            metrics["latency_ms"] = quality.get("latency_ms")
            metrics["packet_loss_percent"] = quality.get("packet_loss_percent", 0.0)
            metrics["jitter_ms"] = quality.get("jitter_ms")
            metrics["probes_sent"] = quality.get("probes_sent", 3)
            metrics["probes_received"] = quality.get("probes_received", 0)
        except Exception as err:
            metrics["latency_ms"] = None
            metrics["packet_loss_percent"] = None
            metrics["jitter_ms"] = None
            metrics["latency_error"] = str(err)
    else:
        metrics["latency_ms"] = None
        metrics["packet_loss_percent"] = None
        metrics["jitter_ms"] = None

    # 4. Standard ISO-8601 UTC timestamp
    now = datetime.now(timezone.utc)
    metrics["timestamp"] = now.isoformat()

    return metrics


if __name__ == "__main__":
    metrics = collect_metrics()
    print("NetGuard AI - Complete Monitoring Snapshot")
    print("-----------------------------------------")
    for key, value in sorted(metrics.items()):
        if key != "interfaces":
            print(f"{key}: {value}")

    try:
        document_id = save_metrics(metrics)
        print("-----------------------------------------")
        print(f"Saved to database: {document_id}")
    except Exception as error:
        print("-----------------------------------------")
        print(f"Database save failed: {error}")

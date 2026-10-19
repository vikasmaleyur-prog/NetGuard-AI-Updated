"""
NetGuard AI - Background Telemetry Agent
Periodically polls and records system & network telemetry.
"""

import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from monitoring.collector import collect_metrics
from database.connection import save_metrics
from database.connection import storage_manager

COLLECTION_INTERVAL = 5


def run_monitoring_agent(interval: int = COLLECTION_INTERVAL, max_cycles: int = 0):
    """Continuously collect and store monitoring metrics."""
    print("NetGuard AI Monitoring Agent")
    print("----------------------------")
    print(f"Collection interval: {interval} seconds")
    print("Monitoring started...")
    print("Press Ctrl+C to stop.")
    print()

    cycles = 0
    while True:
        try:
            metrics = collect_metrics()
            document_id = save_metrics(metrics)

            cpu = metrics.get('cpu_usage_percent', '--')
            ram = metrics.get('memory_usage_percent', '--')
            lat = metrics.get('latency_ms', '--')

            print(
                f"[OK] Metrics saved | "
                f"CPU: {cpu}% | "
                f"RAM: {ram}% | "
                f"Latency: {lat} ms | "
                f"ID: {document_id}"
            )

            cycles += 1
            if max_cycles > 0 and cycles >= max_cycles:
                break

            time.sleep(interval)

        except KeyboardInterrupt:
            print("\nMonitoring agent stopped.")
            break

        except Exception as error:
            print(f"[ERROR] Monitoring failed: {error}")
            time.sleep(interval)


if __name__ == "__main__":
    run_monitoring_agent()
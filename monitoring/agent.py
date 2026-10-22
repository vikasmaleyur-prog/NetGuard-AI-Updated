"""
NetGuard AI - Background Telemetry Agent
Periodically polls and records system & network telemetry.
Provides graceful shutdown support via threading.Event or KeyboardInterrupt.
"""

import sys
import threading
import time
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from monitoring.collector import collect_metrics
from database.connection import save_metrics, storage_manager

COLLECTION_INTERVAL = 5


def run_monitoring_agent(
    interval: int = COLLECTION_INTERVAL,
    max_cycles: int = 0,
    stop_event: Optional[threading.Event] = None
):
    """Continuously collect and store monitoring metrics until stopped."""
    print("NetGuard AI Monitoring Agent")
    print("----------------------------")
    print(f"Collection interval: {interval} seconds")
    print("Monitoring started...")
    print("Press Ctrl+C to stop.")
    print()

    cycles = 0
    while True:
        if stop_event is not None and stop_event.is_set():
            print("\nMonitoring agent received stop signal.")
            break

        try:
            metrics = collect_metrics()
            document_id = save_metrics(metrics)

            cpu = metrics.get("cpu_usage_percent", "--")
            ram = metrics.get("memory_usage_percent", "--")
            lat = metrics.get("latency_ms", "--")
            loss = metrics.get("packet_loss_percent", 0.0)

            print(
                f"[OK] Metrics saved | "
                f"CPU: {cpu}% | "
                f"RAM: {ram}% | "
                f"Latency: {lat} ms | "
                f"Loss: {loss}% | "
                f"ID: {document_id}"
            )

            cycles += 1
            if max_cycles > 0 and cycles >= max_cycles:
                break

            # Sleep in 0.5s increments to respond promptly to stop_event
            sleep_elapsed = 0.0
            while sleep_elapsed < interval:
                if stop_event is not None and stop_event.is_set():
                    break
                time.sleep(0.5)
                sleep_elapsed += 0.5

        except KeyboardInterrupt:
            print("\nMonitoring agent stopped.")
            break

        except Exception as error:
            print(f"[ERROR] Monitoring cycle failed: {error}")
            time.sleep(min(interval, 5))


if __name__ == "__main__":
    run_monitoring_agent()

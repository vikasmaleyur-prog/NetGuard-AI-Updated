import time

from monitoring.collector import collect_metrics
from database.connection import save_metrics


COLLECTION_INTERVAL = 5


def run_monitoring_agent():
    """Continuously collect and store monitoring metrics."""

    print("NetGuard AI Monitoring Agent")
    print("----------------------------")
    print(f"Collection interval: {COLLECTION_INTERVAL} seconds")
    print("Monitoring started...")
    print("Press Ctrl+C to stop.")
    print()

    while True:
        try:
            metrics = collect_metrics()

            document_id = save_metrics(metrics)

            print(
                f"[OK] Metrics saved | "
                f"CPU: {metrics.get('cpu_usage_percent')}% | "
                f"RAM: {metrics.get('memory_usage_percent')}% | "
                f"Latency: {metrics.get('latency_ms')} ms | "
                f"ID: {document_id}"
            )

            time.sleep(COLLECTION_INTERVAL)

        except KeyboardInterrupt:
            print("\nMonitoring agent stopped.")
            break

        except Exception as error:
            print(f"[ERROR] Monitoring failed: {error}")
            time.sleep(COLLECTION_INTERVAL)


if __name__ == "__main__":
    run_monitoring_agent()
from monitoring.system_monitor import get_system_metrics
from monitoring.network_monitor import get_network_metrics
from monitoring.latency_monitor import get_latency


def collect_metrics():
    system_metrics = get_system_metrics()
    network_metrics = get_network_metrics()
    latency = get_latency()

    return {
        **system_metrics,
        **network_metrics,
        "latency_ms": latency
    }


if __name__ == "__main__":
    metrics = collect_metrics()

    print("NetGuard AI - Complete Monitoring Data")
    print("--------------------------------------")

    for key, value in metrics.items():
        print(f"{key}: {value}")
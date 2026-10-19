"""
NetGuard AI - Network Traffic Monitor
Collects network I/O counters and calculates real-time throughput rates.
"""

import time
import psutil

_last_sample_time = None
_last_counters = None


def get_active_interfaces():
    """Retrieve list of active network interfaces with IP addresses and status."""
    results = []
    try:
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()
        for name, stat in stats.items():
            if not stat.isup:
                continue
            ip = "Unassigned"
            if name in addrs:
                for a in addrs[name]:
                    if getattr(a.family, "name", "") == "AF_INET":
                        ip = a.address
                        break
            results.append({
                "name": name,
                "status": "UP",
                "speed_mbps": stat.speed,
                "mtu": stat.mtu,
                "ip_address": ip,
            })
    except Exception:
        pass
    return results[:8]


def get_network_metrics():
    """
    Collect network metrics including cumulative counters, throughput rates, and interfaces.
    """
    global _last_sample_time, _last_counters

    network = psutil.net_io_counters()
    curr_time = time.time()

    bytes_sent_rate = 0.0
    bytes_recv_rate = 0.0
    packets_sent_rate = 0.0
    packets_recv_rate = 0.0

    if _last_sample_time is not None and _last_counters is not None:
        delta_time = curr_time - _last_sample_time
        if delta_time > 0:
            delta_sent = max(0, network.bytes_sent - _last_counters.bytes_sent)
            delta_recv = max(0, network.bytes_recv - _last_counters.bytes_recv)
            delta_psent = max(0, network.packets_sent - _last_counters.packets_sent)
            delta_precv = max(0, network.packets_recv - _last_counters.packets_recv)

            bytes_sent_rate = round(delta_sent / delta_time, 2)
            bytes_recv_rate = round(delta_recv / delta_time, 2)
            packets_sent_rate = round(delta_psent / delta_time, 2)
            packets_recv_rate = round(delta_precv / delta_time, 2)

    _last_sample_time = curr_time
    _last_counters = network

    return {
        "bytes_sent": network.bytes_sent,
        "bytes_received": network.bytes_recv,
        "packets_sent": network.packets_sent,
        "packets_received": network.packets_recv,
        "errors_in": network.errin,
        "errors_out": network.errout,
        "drops_in": network.dropin,
        "drops_out": network.dropout,
        "bytes_sent_per_sec": bytes_sent_rate,
        "bytes_recv_per_sec": bytes_recv_rate,
        "packets_sent_per_sec": packets_sent_rate,
        "packets_recv_per_sec": packets_recv_rate,
        "interfaces": get_active_interfaces(),
    }


if __name__ == "__main__":
    metrics = get_network_metrics()
    print("NetGuard AI - Network Metrics")
    print("-----------------------------")
    print(f"Bytes Sent: {metrics['bytes_sent']}")
    print(f"Bytes Received: {metrics['bytes_received']}")
    print(f"Packets Sent: {metrics['packets_sent']}")
    print(f"Packets Received: {metrics['packets_received']}")
    print(f"Errors In: {metrics['errors_in']}")
    print(f"Errors Out: {metrics['errors_out']}")
    print(f"Drops In: {metrics['drops_in']}")
    print(f"Drops Out: {metrics['drops_out']}")
"""
NetGuard AI - Network Latency & Packet Loss Monitor
Measures network round-trip latency and packet loss safely without requiring root/sudo privileges.
Uses multi-probe TCP socket handshake timing as an unprivileged fallback when raw ICMP is restricted.
"""

import socket
import time
from typing import Dict, List, Optional


def _single_probe(host: str, port: int, timeout: float) -> Optional[float]:
    """Execute a single TCP handshake or ICMP probe to measure RTT in milliseconds."""
    start_time = time.perf_counter()
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        sock.close()
        elapsed = (time.perf_counter() - start_time) * 1000.0
        return round(elapsed, 2)
    except (socket.timeout, socket.gaierror, ConnectionRefusedError, OSError):
        pass

    # Try fallback HTTP port 80 if primary port failed
    if port != 80:
        start_time = time.perf_counter()
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            sock.connect((host, 80))
            sock.close()
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return round(elapsed, 2)
        except Exception:
            pass

    # Optional ICMP fallback
    try:
        from ping3 import ping
        res = ping(host, timeout=timeout)
        if res is not None:
            return round(res * 1000.0, 2)
    except Exception:
        pass

    return None


def get_network_quality(
    host: str = "8.8.8.8",
    port: int = 53,
    count: int = 4,
    timeout: float = 0.8
) -> Dict[str, Optional[float]]:
    """
    Measure round-trip latency and packet loss rate over a series of probes.
    Returns latency statistics and packet loss percentage.
    """
    successful_latencies: List[float] = []

    for _ in range(count):
        lat = _single_probe(host, port, timeout)
        if lat is not None:
            successful_latencies.append(lat)

    received = len(successful_latencies)
    packet_loss = round(((count - received) / float(count)) * 100.0, 1)

    if successful_latencies:
        avg_lat = round(sum(successful_latencies) / float(received), 2)
        min_lat = round(min(successful_latencies), 2)
        max_lat = round(max(successful_latencies), 2)
        jitter = round(max_lat - min_lat, 2)
    else:
        avg_lat = None
        min_lat = None
        max_lat = None
        jitter = None

    return {
        "latency_ms": avg_lat,
        "packet_loss_percent": packet_loss,
        "min_latency_ms": min_lat,
        "max_latency_ms": max_lat,
        "jitter_ms": jitter,
        "probes_sent": count,
        "probes_received": received,
    }


def get_latency(host: str = "8.8.8.8", port: int = 53, timeout: float = 2.0) -> Optional[float]:
    """
    Measure round-trip latency in milliseconds.
    Maintained for backward compatibility.
    """
    quality = get_network_quality(host=host, port=port, count=2, timeout=min(timeout, 1.0))
    return quality.get("latency_ms")


if __name__ == "__main__":
    quality = get_network_quality()
    print("NetGuard AI - Network Quality Assessment")
    print("---------------------------------------")
    print(f"Target: 8.8.8.8")
    print(f"Measured Latency: {quality['latency_ms']} ms")
    print(f"Packet Loss: {quality['packet_loss_percent']}%")
    print(f"Jitter: {quality['jitter_ms']} ms")
    print(f"Probes: {quality['probes_received']}/{quality['probes_sent']} received")

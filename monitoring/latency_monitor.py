"""
NetGuard AI - Network Latency Monitor
Measures network round-trip latency safely without requiring root/sudo privileges.
Uses TCP socket handshake timing as an unprivileged fallback when raw ICMP is restricted.
"""

import socket
import time
from typing import Optional


def get_latency(host: str = "8.8.8.8", port: int = 53, timeout: float = 2.0) -> Optional[float]:
    """
    Measure round-trip latency in milliseconds.
    Attempts ICMP ping first, and automatically falls back to TCP socket handshake timing
    if raw sockets are restricted by operating system permissions.
    """
    # 1. Attempt unprivileged TCP handshake (e.g., DNS port 53 or HTTP 80/443)
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

    # 2. Try secondary port (HTTP 80) if DNS failed
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

    # 3. Optional ping3 ICMP fallback if permissions exist
    try:
        from ping3 import ping
        res = ping(host, timeout=timeout)
        if res is not None:
            return round(res * 1000.0, 2)
    except Exception:
        pass

    return None


if __name__ == "__main__":
    latency = get_latency()
    print("NetGuard AI - Network Latency")
    print("-----------------------------")
    if latency is None:
        print("Target unreachable or network disconnected.")
    else:
        print(f"Target: 8.8.8.8")
        print(f"Measured Latency: {latency} ms")
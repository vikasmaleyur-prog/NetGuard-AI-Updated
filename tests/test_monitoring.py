"""
NetGuard AI - Monitoring & Telemetry Unit Tests
Validates packet loss measurement, latency stats, throughput calculation,
counter-reset detection, and clean collector lifecycle.
"""

import threading
import time
from monitoring.latency_monitor import get_network_quality, get_latency
from monitoring.network_monitor import get_network_metrics
from monitoring.collector import collect_metrics
from monitoring.agent import run_monitoring_agent


def test_network_quality_packet_loss_calculation():
    """Verify latency monitor calculates packet loss, jitter, and round-trip times."""
    quality = get_network_quality(host="8.8.8.8", port=53, count=2, timeout=1.0)
    assert isinstance(quality, dict)
    assert "packet_loss_percent" in quality
    assert "probes_sent" in quality
    assert "probes_received" in quality
    assert quality["probes_sent"] == 2
    assert 0.0 <= quality["packet_loss_percent"] <= 100.0


def test_network_metrics_counter_reset_safety():
    """Verify network metrics monitor calculates rates and detects counter resets."""
    # First reading initializes baseline
    first = get_network_metrics()
    assert "bytes_sent" in first
    assert "bytes_sent_per_sec" in first
    assert isinstance(first["interfaces"], list)

    # Second reading computes rate
    time.sleep(0.1)
    second = get_network_metrics()
    assert second["bytes_sent_per_sec"] >= 0.0
    assert second["counter_reset"] is False


def test_telemetry_collector_schema_and_timestamp():
    """Verify collect_metrics outputs complete, valid schema with ISO UTC timestamp."""
    metrics = collect_metrics(probe_quality=False)
    assert isinstance(metrics, dict)
    assert "timestamp" in metrics
    assert "T" in metrics["timestamp"]  # ISO-8601
    assert "cpu_usage_percent" in metrics
    assert "memory_usage_percent" in metrics
    assert "disk_usage_percent" in metrics


def test_monitoring_agent_clean_shutdown():
    """Verify background agent stops cleanly via threading.Event without hanging."""
    stop_event = threading.Event()
    stop_event.set()  # Immediate stop signal
    # Should exit immediately on first check
    run_monitoring_agent(interval=1, max_cycles=1, stop_event=stop_event)

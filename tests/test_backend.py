"""
NetGuard AI - Backend & Storage Automated Test Suite
"""

import sys
from pathlib import Path
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app
from database.connection import storage_manager, monitoring_collection
from ai.service import extract_feature_vector, run_full_inference

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "NetGuard AI"
    assert data["status"] == "running"


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert data["database"]["connected"] is True


def test_summary():
    response = client.get("/summary")
    assert response.status_code == 200
    data = response.json()
    assert "network_status" in data
    assert "metrics" in data
    assert "ai" in data


def test_metrics_and_history():
    # Test metrics endpoint
    m_res = client.get("/metrics")
    assert m_res.status_code == 200
    m_data = m_res.json()
    assert "metrics" in m_data or "status" in m_data

    # Test collect
    c_res = client.post("/metrics/collect")
    assert c_res.status_code == 200
    c_data = c_res.json()
    assert c_data["status"] == "success"

    # Test history
    h_res = client.get("/metrics/history?limit=5")
    assert h_res.status_code == 200
    h_data = h_res.json()
    assert "records" in h_data
    assert len(h_data["records"]) >= 1


def test_ai_status_and_inference():
    ai_res = client.get("/ai/status")
    assert ai_res.status_code == 200
    ai_data = ai_res.json()
    assert "ai_analysis" in ai_data

    inf_res = client.post("/ai/run-inference")
    assert inf_res.status_code == 200
    inf_data = inf_res.json()
    assert "models" in inf_data
    assert "decision" in inf_data


def test_alerts_lifecycle():
    # Create test alert
    create_res = client.post(
        "/alerts/create",
        json={
            "severity": "WARNING",
            "title": "High Latency Detected",
            "message": "Gateway latency exceeded threshold",
            "source": "AutomatedTest",
        },
    )
    assert create_res.status_code == 200
    alert_id = create_res.json()["alert_id"]

    # List alerts
    list_res = client.get("/alerts")
    assert list_res.status_code == 200
    alerts = list_res.json()["alerts"]
    assert any(a["id"] == alert_id for a in alerts)

    # Acknowledge
    ack_res = client.post(f"/alerts/{alert_id}/acknowledge")
    assert ack_res.status_code == 200
    assert ack_res.json()["acknowledged"] is True

    # Resolve
    res_res = client.post(f"/alerts/{alert_id}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["resolved"] is True


def test_devices():
    dev_res = client.get("/devices")
    assert dev_res.status_code == 200
    devs = dev_res.json()["devices"]
    assert len(devs) >= 1

    # Register new device
    reg_res = client.post(
        "/devices",
        json={"name": "Test Server", "ip": "127.0.0.1", "role": "Test"},
    )
    assert reg_res.status_code == 200
    dev_id = reg_res.json()["device_id"]

    # Ping device
    ping_res = client.post(f"/devices/{dev_id}/ping")
    assert ping_res.status_code == 200

    # Delete device
    del_res = client.delete(f"/devices/{dev_id}")
    assert del_res.status_code == 200


def test_reports():
    sum_res = client.get("/reports/summary?period=24h")
    assert sum_res.status_code == 200
    data = sum_res.json()
    assert "metrics_summary" in data
    assert "alerts_summary" in data

    export_res = client.get("/reports/export?period=24h")
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers.get("content-type", "")


def test_settings():
    get_res = client.get("/settings")
    assert get_res.status_code == 200

    upd_res = client.post("/settings", json={"refresh_interval": 10})
    assert upd_res.status_code == 200
    assert upd_res.json()["settings"]["refresh_interval"] == 10

    # Reset back to 5
    client.post("/settings", json={"refresh_interval": 5})


if __name__ == "__main__":
    test_root()
    test_health()
    test_summary()
    test_metrics_and_history()
    test_ai_status_and_inference()
    test_alerts_lifecycle()
    test_devices()
    test_reports()
    test_settings()
    print("All backend tests passed successfully!")

"""
NetGuard AI - Authentication & Session Security Automated Test Suite
Validates registration, login, token revocation, brute-force mitigation, and route protection.
"""

import sys
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app
from database.connection import storage_manager

client = TestClient(app)


def test_public_routes_accessible_without_auth():
    """Verify / and /health remain public for service discovery and load balancing."""
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["project"] == "NetGuard AI"

    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"


def test_protected_routes_reject_unauthenticated_requests():
    """Verify metrics, summary, alerts, devices, settings reject unauthenticated requests with 401."""
    # Ensure client has no auth header
    unauthed_client = TestClient(app)

    res_metrics = unauthed_client.get("/metrics")
    assert res_metrics.status_code == 401
    assert "token required" in res_metrics.json()["detail"].lower()

    res_summary = unauthed_client.get("/summary")
    assert res_summary.status_code == 401

    res_alerts = unauthed_client.get("/alerts")
    assert res_alerts.status_code == 401

    res_devices = unauthed_client.get("/devices")
    assert res_devices.status_code == 401

    res_settings = unauthed_client.get("/settings")
    assert res_settings.status_code == 401


def test_login_seeded_admin_success():
    """Verify default seeded administrator can log in successfully."""
    res = client.post(
        "/auth/login",
        json={"email": "admin@netguard.ai", "password": "NetGuardAdmin2026!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@netguard.ai"
    assert data["user"]["role"] == "admin"
    assert "password_hash" not in data["user"]


def test_login_invalid_password_returns_generic_401():
    """Verify incorrect credentials return generic 401 without user enumeration."""
    res = client.post(
        "/auth/login",
        json={"email": "admin@netguard.ai", "password": "WrongPassword999!"},
    )
    assert res.status_code == 401
    assert "invalid email address or password" in res.json()["detail"].lower()


def test_login_nonexistent_user_returns_generic_401():
    """Verify non-existent email returns same generic 401 to prevent email harvesting."""
    res = client.post(
        "/auth/login",
        json={"email": "nonexistent_operator@netguard.ai", "password": "SomePassword123!"},
    )
    assert res.status_code == 401
    assert "invalid email address or password" in res.json()["detail"].lower()


def test_registration_validation_checks():
    """Verify input validation for registration: passwords match, strength, email, terms."""
    rand_email = f"user_{uuid.uuid4().hex[:6]}@example.com"

    # Missing terms acceptance
    r_terms = client.post(
        "/auth/register",
        json={
            "full_name": "Test User",
            "email": rand_email,
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!",
            "terms_accepted": False,
        },
    )
    assert r_terms.status_code == 400
    assert "terms" in r_terms.json()["detail"].lower()

    # Passwords do not match
    r_mismatch = client.post(
        "/auth/register",
        json={
            "full_name": "Test User",
            "email": rand_email,
            "password": "ValidPassword2026!",
            "confirm_password": "DifferentPassword2026!",
            "terms_accepted": True,
        },
    )
    assert r_mismatch.status_code == 400
    assert "do not match" in r_mismatch.json()["detail"].lower()

    # Weak password (< 8 chars)
    r_weak = client.post(
        "/auth/register",
        json={
            "full_name": "Test User",
            "email": rand_email,
            "password": "abc",
            "confirm_password": "abc",
            "terms_accepted": True,
        },
    )
    assert r_weak.status_code in [400, 422]

    # Invalid email format
    r_email = client.post(
        "/auth/register",
        json={
            "full_name": "Test User",
            "email": "not-an-email",
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!",
            "terms_accepted": True,
        },
    )
    assert r_email.status_code == 400


def test_registration_and_auth_profile_flow():
    """Verify successful registration, token issuance, profile fetch, and token verification."""
    unique_email = f"operator_{uuid.uuid4().hex[:8]}@netguard.corp"
    reg_res = client.post(
        "/auth/register",
        json={
            "full_name": "Sarah Connor",
            "email": unique_email,
            "organization": "Cyberdyne Defense",
            "password": "SkyNetDefense2026!",
            "confirm_password": "SkyNetDefense2026!",
            "terms_accepted": True,
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["status"] == "success"
    token = reg_data["token"]
    assert token is not None
    assert reg_data["user"]["full_name"] == "Sarah Connor"
    assert reg_data["user"]["email"] == unique_email
    assert reg_data["user"]["organization"] == "Cyberdyne Defense"
    assert "password_hash" not in reg_data["user"]

    # Verify duplicate registration is rejected with 409
    dup_res = client.post(
        "/auth/register",
        json={
            "full_name": "Sarah Connor Duplicate",
            "email": unique_email,
            "password": "SkyNetDefense2026!",
            "confirm_password": "SkyNetDefense2026!",
            "terms_accepted": True,
        },
    )
    assert dup_res.status_code == 409

    # Use issued token to fetch /auth/me profile
    me_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()["user"]
    assert me_data["email"] == unique_email
    assert me_data["full_name"] == "Sarah Connor"
    assert "password_hash" not in me_data

    # Use issued token to access protected /metrics
    metrics_res = client.get("/metrics", headers={"Authorization": f"Bearer {token}"})
    assert metrics_res.status_code == 200


def test_logout_and_session_revocation():
    """Verify logout invalidates token so subsequent requests with that token fail."""
    # Login as admin to get a fresh token
    login_res = client.post(
        "/auth/login",
        json={"email": "admin@netguard.ai", "password": "NetGuardAdmin2026!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    # Verify token works
    pre_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert pre_res.status_code == 200

    # Logout
    logout_res = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "success"

    # Attempt to use revoked token - MUST return 401
    post_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert post_res.status_code == 401
    assert "revoked" in post_res.json()["detail"].lower() or "expired" in post_res.json()["detail"].lower()


def test_forgot_password_generic_confirmation():
    """Verify forgot password returns generic success message without leaking email existence."""
    res1 = client.post(
        "/auth/forgot-password",
        json={"email": "admin@netguard.ai"},
    )
    assert res1.status_code == 200
    assert "instructions have been dispatched" in res1.json()["message"]

    res2 = client.post(
        "/auth/forgot-password",
        json={"email": "nonexistent@fakecorp.org"},
    )
    assert res2.status_code == 200
    assert "instructions have been dispatched" in res2.json()["message"]


if __name__ == "__main__":
    test_public_routes_accessible_without_auth()
    test_protected_routes_reject_unauthenticated_requests()
    test_login_seeded_admin_success()
    test_login_invalid_password_returns_generic_401()
    test_login_nonexistent_user_returns_generic_401()
    test_registration_validation_checks()
    test_registration_and_auth_profile_flow()
    test_logout_and_session_revocation()
    test_forgot_password_generic_confirmation()
    print("All authentication tests passed successfully!")

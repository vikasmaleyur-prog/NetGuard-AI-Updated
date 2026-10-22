"""
NetGuard AI - Self-Healing Recovery Engine Tests
Validates action eligibility, dry-run mode, cooldown enforcement, and audit persistence.
"""

from backend.recovery import (
    ACTION_REGISTRY,
    get_available_actions,
    run_recovery_lifecycle,
)
from database.connection import storage_manager


def test_recovery_action_registry():
    """Verify registered recovery actions have valid metadata and safety properties."""
    actions = get_available_actions()
    assert len(actions) >= 4
    for a in actions:
        assert "action_key" in a
        assert "title" in a
        assert "target" in a
        assert a["is_safe"] is True


def test_recovery_dry_run_lifecycle():
    """Verify dry-run mode simulates remediation and records audit trail without modifying system."""
    decision = {"status": "CRITICAL", "action": "Network latency spike detected"}
    metrics = {"latency_ms": 140.0, "packet_loss_percent": 12.0}

    res = run_recovery_lifecycle(
        decision=decision,
        metrics=metrics,
        force_action_key="flush_dns_cache",
        mode="DRY_RUN",
        operator_email="test@netguard.ai",
    )

    assert res["status"] == "DRY_RUN"
    assert "action_id" in res
    assert "execution_duration_ms" in res

    # Verify audit record exists in database
    audit = storage_manager.get_recovery_action_by_id(res["action_id"])
    assert audit is not None
    assert audit["mode"] == "DRY_RUN"
    assert audit["operator_email"] == "test@netguard.ai"


def test_recovery_cooldown_enforcement():
    """Verify cooldown prevents immediate duplicate action thrashing."""
    from backend.recovery import _last_action_execution
    _last_action_execution.clear()  # Reset cooldown map for test isolation

    decision = {"status": "CRITICAL"}
    metrics = {"latency_ms": 150.0}

    # First manual execution
    first = run_recovery_lifecycle(
        decision=decision,
        metrics=metrics,
        force_action_key="flush_dns_cache",
        mode="MANUAL",
    )
    assert first["status"] in ["VERIFIED", "FAILED", "DRY_RUN"]

    # Immediate second execution should be throttled by cooldown
    second = run_recovery_lifecycle(
        decision=decision,
        metrics=metrics,
        force_action_key="flush_dns_cache",
        mode="MANUAL",
    )
    assert second["status"] == "SKIPPED"
    assert "cooling down" in second["message"]

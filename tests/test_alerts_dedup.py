"""
NetGuard AI - Alerts Deduplication Unit Tests
Verifies alert creation, deduplication within cooldown window, and resolution.
"""

from database.connection import storage_manager


def test_alert_deduplication():
    """Verify repeated alerts with identical title & source update occurrence count without duplicate rows."""
    title = "Test CPU Saturation Spike"
    source = "Test Deduplication Monitor"

    # First occurrence
    id1 = storage_manager.add_alert(
        severity="WARNING",
        title=title,
        message="CPU reached 88%",
        source=source,
    )

    # Immediate second occurrence
    id2 = storage_manager.add_alert(
        severity="WARNING",
        title=title,
        message="CPU reached 89%",
        source=source,
    )

    # Must return the same alert ID
    assert id1 == id2

    # Verify duplicate count in metadata was incremented
    alerts = storage_manager.get_alerts(limit=10)
    matching = [a for a in alerts if a["id"] == id1]
    assert len(matching) == 1
    assert matching[0]["metadata"].get("duplicate_count", 1) >= 2

    # Clean up by resolving
    storage_manager.resolve_alert(id1)

"""Permission management for actions."""

# TODO: Implement permission checking


def check_permission(action: str, risk_level: str) -> bool:
    """Check if an action is permitted based on its risk level."""
    if risk_level in ("safe", "low"):
        return True
    return False

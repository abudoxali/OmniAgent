"""Defines action types and their risk levels."""
from enum import Enum


class RiskLevel(Enum):
    """Risk levels for agent actions."""
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActionType(Enum):
    """Types of actions the agent can perform."""
    COPY = "copy"
    PASTE_PREVIEW = "paste_preview"
    READ_CONTEXT = "read_context"
    # Future: FILE_WRITE, SHELL_EXEC, etc.

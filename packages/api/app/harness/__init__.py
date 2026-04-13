"""Harness abstraction layer for Lex the Computer.

Exports the AgentHarness ABC, shared dataclasses, and the factory function.
Concrete implementations live in their own modules (openclaw.py, hermes.py).
"""

from .base import (
    AgentHarness,
    Automation,
    HarnessConfig,
    Session,
    Skill,
    StreamChunk,
)
from .factory import get_harness

__all__ = [
    "AgentHarness",
    "Automation",
    "HarnessConfig",
    "Session",
    "Skill",
    "StreamChunk",
    "get_harness",
]

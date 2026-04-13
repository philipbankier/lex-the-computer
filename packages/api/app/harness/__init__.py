"""Harness abstraction layer for Lex the Computer.

Exports the AgentHarness ABC and all shared dataclasses.
Concrete implementations live in their own modules (e.g. openclaw.py).
"""

from .base import (
    AgentHarness,
    Automation,
    HarnessConfig,
    Session,
    Skill,
    StreamChunk,
)

__all__ = [
    "AgentHarness",
    "Automation",
    "HarnessConfig",
    "Session",
    "Skill",
    "StreamChunk",
]

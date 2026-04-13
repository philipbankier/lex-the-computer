"""
Harness factory — returns the correct AgentHarness based on configuration.
"""

from app.config import settings
from app.harness.base import AgentHarness, HarnessConfig


def get_harness() -> AgentHarness:
    """Create and return the configured AgentHarness implementation."""
    if settings.agent_harness == "hermes":
        from app.harness.hermes import HermesHarness

        return HermesHarness(
            HarnessConfig(
                gateway_url=settings.hermes_api_url,
                gateway_token=settings.hermes_api_key,
                extra={"data_dir": settings.hermes_data_dir},
            )
        )

    if settings.agent_harness == "openclaw":
        from app.harness.openclaw import OpenClawHarness

        return OpenClawHarness(
            HarnessConfig(
                gateway_url=settings.openclaw_gateway_url,
                gateway_token=settings.openclaw_gateway_token,
            )
        )

    raise ValueError(f"Unknown agent harness: {settings.agent_harness!r}")

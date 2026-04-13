"""Tests for the harness factory."""

from unittest.mock import patch

import pytest

from app.harness.factory import get_harness
from app.harness.hermes import HermesHarness
from app.harness.openclaw import OpenClawHarness


class TestGetHarness:
    def test_returns_hermes_when_configured(self):
        with patch("app.harness.factory.settings") as mock_settings:
            mock_settings.agent_harness = "hermes"
            mock_settings.hermes_api_url = "http://test:8642"
            mock_settings.hermes_api_key = "test-key"
            mock_settings.hermes_data_dir = "/tmp/hermes"
            harness = get_harness()
            assert isinstance(harness, HermesHarness)
            assert harness._base_url == "http://test:8642"
            assert harness._api_key == "test-key"

    def test_returns_openclaw_when_configured(self):
        with patch("app.harness.factory.settings") as mock_settings:
            mock_settings.agent_harness = "openclaw"
            mock_settings.openclaw_gateway_url = "ws://test:18789"
            mock_settings.openclaw_gateway_token = "oc-token"
            harness = get_harness()
            assert isinstance(harness, OpenClawHarness)
            assert harness.config.gateway_url == "ws://test:18789"

    def test_raises_for_unknown_harness(self):
        with patch("app.harness.factory.settings") as mock_settings:
            mock_settings.agent_harness = "unknown"
            with pytest.raises(ValueError, match="Unknown agent harness"):
                get_harness()

    def test_hermes_data_dir_in_extra(self):
        with patch("app.harness.factory.settings") as mock_settings:
            mock_settings.agent_harness = "hermes"
            mock_settings.hermes_api_url = "http://test:8642"
            mock_settings.hermes_api_key = ""
            mock_settings.hermes_data_dir = "/custom/dir"
            harness = get_harness()
            assert harness.config.extra["data_dir"] == "/custom/dir"

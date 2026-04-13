"""Tests for the automations service."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services import automations_service


@pytest.fixture(autouse=True)
def reset_harness():
    automations_service._harness = None
    yield
    automations_service._harness = None


class TestAutomationsService:
    async def test_list_automations(self, mock_harness):
        automations_service._harness = mock_harness
        await mock_harness.create_automation(
            name="Test", instruction="Go", schedule="0 9 * * *", delivery="telegram",
        )
        result = await automations_service.list_automations()
        assert len(result) == 1
        assert result[0].name == "Test"

    async def test_create_automation(self, mock_harness):
        automations_service._harness = mock_harness
        result = await automations_service.create_automation(
            name="New Job", instruction="Do it", schedule="0 8 * * *", delivery="discord",
        )
        assert result.name == "New Job"
        assert result.delivery == "discord"

    async def test_update_automation(self, mock_harness):
        automations_service._harness = mock_harness
        created = await automations_service.create_automation(
            name="Before", instruction="x", schedule="* * * * *", delivery="email",
        )
        updated = await automations_service.update_automation(created.id, name="After")
        assert updated.name == "After"

    async def test_delete_automation(self, mock_harness):
        automations_service._harness = mock_harness
        created = await automations_service.create_automation(
            name="Temp", instruction="x", schedule="* * * * *", delivery="email",
        )
        assert await automations_service.delete_automation(created.id) is True
        assert await automations_service.list_automations() == []

    async def test_delete_nonexistent(self, mock_harness):
        automations_service._harness = mock_harness
        assert await automations_service.delete_automation("fake") is False

    async def test_toggle_automation(self, mock_harness):
        automations_service._harness = mock_harness
        created = await automations_service.create_automation(
            name="Toggle", instruction="x", schedule="0 0 * * *", delivery="telegram",
        )
        assert created.enabled is True
        toggled = await automations_service.toggle_automation(created.id)
        assert toggled.enabled is False

    async def test_toggle_nonexistent_raises(self, mock_harness):
        automations_service._harness = mock_harness
        with pytest.raises(ValueError, match="not found"):
            await automations_service.toggle_automation("nonexistent")

    async def test_get_harness_lazy_init(self):
        with patch("app.services.automations_service._factory_get_harness") as mock_factory:
            from conftest import MockHarness
            mock_factory.return_value = MockHarness()
            automations_service._harness = None
            harness = automations_service._get_harness()
            mock_factory.assert_called_once()
            assert harness is not None

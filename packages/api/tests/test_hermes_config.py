"""Tests for the Hermes config generator."""

from __future__ import annotations

from pathlib import Path

import yaml
import pytest

from app.services.hermes_config import generate_hermes_config, write_hermes_config


class TestGenerateHermesConfig:
    def test_default_config(self):
        result = generate_hermes_config()
        config = result["config"]
        assert config["model"] == "claude-sonnet-4-6"
        assert config["terminal"]["backend"] == "docker"
        assert config["terminal"]["cwd"] == "/data/workspace"
        assert config["api_server"]["enabled"] is True
        assert config["api_server"]["port"] == 8642
        assert config["approvals"]["mode"] == "off"
        assert config["compression"]["threshold"] == 0.7

    def test_custom_model_and_provider(self):
        result = generate_hermes_config(
            model="gpt-4", provider="openai", api_key="sk-openai-123",
        )
        assert result["config"]["model"] == "gpt-4"
        assert result["env"]["OPENAI_API_KEY"] == "sk-openai-123"

    def test_anthropic_api_key(self):
        result = generate_hermes_config(provider="anthropic", api_key="sk-ant-123")
        assert result["env"]["ANTHROPIC_API_KEY"] == "sk-ant-123"

    def test_openrouter_api_key(self):
        result = generate_hermes_config(provider="openrouter", api_key="or-123")
        assert result["env"]["OPENROUTER_API_KEY"] == "or-123"

    def test_unknown_provider_api_key(self):
        result = generate_hermes_config(provider="custom", api_key="key-123")
        assert result["env"]["CUSTOM_API_KEY"] == "key-123"

    def test_no_api_key(self):
        result = generate_hermes_config(api_key="")
        assert "ANTHROPIC_API_KEY" not in result["env"]
        assert "API_SERVER_KEY" in result["env"]

    def test_api_server_key(self):
        result = generate_hermes_config(api_server_key="my-key", api_server_port=9000)
        assert result["config"]["api_server"]["port"] == 9000
        assert result["env"]["API_SERVER_KEY"] == "my-key"

    def test_honcho_memory(self):
        result = generate_hermes_config(memory_provider="honcho")
        config = result["config"]
        assert "plugins" in config
        assert config["plugins"]["honcho"]["enabled"] is True
        assert config["plugins"]["honcho"]["base_url"] == "http://honcho-api:8000"

    def test_core_memory_no_plugins(self):
        result = generate_hermes_config(memory_provider="core")
        assert "plugins" not in result["config"]

    def test_telegram_channel(self):
        result = generate_hermes_config(telegram_bot_token="bot:123", telegram_user_id=42)
        config = result["config"]
        assert "channels" in config
        tg = config["channels"]["telegram"]
        assert tg["enabled"] is True
        assert tg["bot_token_env"] == "TELEGRAM_BOT_TOKEN"
        assert tg["allowed_users"] == [42]
        assert result["env"]["TELEGRAM_BOT_TOKEN"] == "bot:123"

    def test_telegram_no_user_filter(self):
        result = generate_hermes_config(telegram_bot_token="bot:456")
        tg = result["config"]["channels"]["telegram"]
        assert "allowed_users" not in tg

    def test_discord_channel(self):
        result = generate_hermes_config(discord_bot_token="disc-token")
        config = result["config"]
        disc = config["channels"]["discord"]
        assert disc["enabled"] is True
        assert result["env"]["DISCORD_BOT_TOKEN"] == "disc-token"

    def test_no_channels(self):
        result = generate_hermes_config()
        assert "channels" not in result["config"]

    def test_both_channels(self):
        result = generate_hermes_config(
            telegram_bot_token="tg-token", discord_bot_token="disc-token",
        )
        config = result["config"]
        assert "telegram" in config["channels"]
        assert "discord" in config["channels"]

    def test_custom_workspace(self):
        result = generate_hermes_config(workspace_dir="/custom/ws")
        assert result["config"]["terminal"]["cwd"] == "/custom/ws"


class TestWriteHermesConfig:
    def test_writes_config_yaml(self, tmp_path):
        config = {"model": "test", "terminal": {"backend": "docker"}}
        env = {"API_KEY": "secret"}
        path = write_hermes_config(str(tmp_path), config, env)
        assert path == tmp_path / "config.yaml"
        assert path.exists()
        loaded = yaml.safe_load(path.read_text())
        assert loaded["model"] == "test"

    def test_writes_env_file(self, tmp_path):
        config = {"model": "test"}
        env = {"API_KEY": "secret", "OTHER": "value"}
        write_hermes_config(str(tmp_path), config, env)
        env_path = tmp_path / ".env"
        assert env_path.exists()
        content = env_path.read_text()
        assert "API_KEY=secret" in content
        assert "OTHER=value" in content

    def test_creates_dir_if_missing(self, tmp_path):
        target = tmp_path / "nested" / "dir"
        write_hermes_config(str(target), {"model": "x"}, {})
        assert (target / "config.yaml").exists()

    def test_returns_config_path(self, tmp_path):
        result = write_hermes_config(str(tmp_path), {"model": "x"}, {})
        assert isinstance(result, Path)
        assert result.name == "config.yaml"

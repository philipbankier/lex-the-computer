"""
Hermes configuration generator.

Produces config.yaml and .env content from Lex onboarding selections,
and writes them to the Hermes data directory.
"""

from pathlib import Path
from typing import Any

import yaml


def generate_hermes_config(
    model: str = "claude-sonnet-4-6",
    provider: str = "anthropic",
    api_key: str = "",
    memory_provider: str = "core",
    terminal_backend: str = "docker",
    telegram_bot_token: str = "",
    telegram_user_id: int | None = None,
    discord_bot_token: str = "",
    workspace_dir: str = "/data/workspace",
    api_server_key: str = "lex-local-dev",
    api_server_port: int = 8642,
) -> dict[str, Any]:
    """Generate Hermes config.yaml content and .env values.

    Returns dict with keys:
      - "config": dict suitable for YAML serialization (config.yaml)
      - "env": dict of environment variable name -> value (.env)
    """
    config: dict[str, Any] = {
        "model": model,
        "terminal": {
            "backend": terminal_backend,
            "cwd": workspace_dir,
        },
        "approvals": {
            "mode": "off",
        },
        "compression": {
            "threshold": 0.7,
        },
        "api_server": {
            "enabled": True,
            "host": "0.0.0.0",
            "port": api_server_port,
        },
    }

    if memory_provider == "honcho":
        config["plugins"] = {
            "honcho": {
                "enabled": True,
                "base_url": "http://honcho-api:8000",
            },
        }

    channels: dict[str, Any] = {}
    if telegram_bot_token:
        tg: dict[str, Any] = {
            "enabled": True,
            "bot_token_env": "TELEGRAM_BOT_TOKEN",
        }
        if telegram_user_id:
            tg["allowed_users"] = [telegram_user_id]
        channels["telegram"] = tg
    if discord_bot_token:
        channels["discord"] = {
            "enabled": True,
            "bot_token_env": "DISCORD_BOT_TOKEN",
        }
    if channels:
        config["channels"] = channels

    env: dict[str, str] = {}
    if api_key:
        env_key = {
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
        }.get(provider, f"{provider.upper()}_API_KEY")
        env[env_key] = api_key
    env["API_SERVER_KEY"] = api_server_key
    if telegram_bot_token:
        env["TELEGRAM_BOT_TOKEN"] = telegram_bot_token
    if discord_bot_token:
        env["DISCORD_BOT_TOKEN"] = discord_bot_token

    return {"config": config, "env": env}


def write_hermes_config(hermes_data_dir: str, config: dict[str, Any], env: dict[str, str]) -> Path:
    """Write config.yaml and .env to the Hermes data directory.

    Returns the path to the written config.yaml.
    """
    data_dir = Path(hermes_data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    config_path = data_dir / "config.yaml"
    config_path.write_text(yaml.dump(config, default_flow_style=False, sort_keys=False), encoding="utf-8")

    env_path = data_dir / ".env"
    lines = [f"{k}={v}" for k, v in env.items()]
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return config_path

"""
Hermes configuration generator.

Produces config.yaml and .env content from Lex onboarding selections.
"""

from typing import Any


def generate_hermes_config(
    model: str = "claude-sonnet-4-6",
    provider: str = "anthropic",
    api_key: str = "",
    memory_provider: str = "core",
    terminal_backend: str = "docker",
    telegram_bot_token: str = "",
    discord_bot_token: str = "",
    api_server_key: str = "lex-local-dev",
    api_server_port: int = 8642,
) -> dict[str, Any]:
    """Generate Hermes config.yaml content and .env values.

    Returns dict with keys:
      - "config": dict suitable for YAML serialization (config.yaml)
      - "env": dict of environment variable name → value (.env)
    """
    config: dict[str, Any] = {
        "model": model,
        "terminal": {
            "backend": terminal_backend,
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
        channels["telegram"] = {
            "enabled": True,
            "bot_token_env": "TELEGRAM_BOT_TOKEN",
        }
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

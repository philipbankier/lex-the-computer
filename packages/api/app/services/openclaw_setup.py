"""
OpenClaw setup helper.

Generates and writes openclaw.json + SOUL.md for new users during onboarding.
"""

import json
import os
import shutil
from pathlib import Path

# Providers detectable by CLI binary
_CLI_PROVIDERS = [
    {"id": "claude-cli", "name": "Claude (Max/Pro)", "binary": "claude"},
    {"id": "codex-cli", "name": "OpenAI Codex", "binary": "codex"},
    {"id": "gemini-cli", "name": "Google Gemini", "binary": "gemini"},
]

# Providers detectable by environment variable (API-key based)
_API_PROVIDERS = [
    {"id": "openrouter", "name": "OpenRouter (200+ models)", "env": "OPENROUTER_API_KEY"},
    {"id": "anthropic", "name": "Anthropic API", "env": "ANTHROPIC_API_KEY"},
    {"id": "openai", "name": "OpenAI API", "env": "OPENAI_API_KEY"},
]


class OpenClawSetup:
    def __init__(self, workspace_dir: str):
        self.workspace_dir = workspace_dir
        self.config_path = Path(workspace_dir) / ".openclaw" / "openclaw.json"

    def generate_config(self, provider: str, model: str, telegram_config: dict | None = None) -> dict:
        """Generate openclaw.json from onboarding selections."""
        # Normalise model reference: if model already contains "/" assume it's
        # fully qualified (e.g. "anthropic/claude-sonnet-4-6"), otherwise
        # combine with provider (e.g. "claude-cli/opus").
        model_ref = model if "/" in model else f"{provider}/{model}"

        config: dict = {
            "version": "2026.2.25",
            "gateway": {
                "port": 18789,
                "host": "127.0.0.1",
            },
            "agents": {
                "main": {
                    "model": model_ref,
                    "fallbackModel": "claude-cli/sonnet",
                }
            },
            "defaultAgent": "main",
            "session": {
                "rotateBytes": "2mb",
                "pruneAfter": "30d",
                "maxEntries": 200,
            },
        }

        if telegram_config:
            config["channels"] = {
                "telegram": {
                    "enabled": True,
                    "botToken": telegram_config.get("bot_token", ""),
                    "userId": telegram_config.get("user_id"),
                    "mode": "polling",
                }
            }

        return config

    def read_config(self) -> dict:
        """Read existing openclaw.json, returning empty dict if not present."""
        if not self.config_path.exists():
            return {}
        return json.loads(self.config_path.read_text(encoding="utf-8"))

    def write_config(self, config: dict) -> None:
        """Write config to workspace/.openclaw/openclaw.json"""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")

    def detect_cli_providers(self) -> list[dict]:
        """Detect installed AI CLIs (claude, codex, gemini) via shutil.which()"""
        results = []
        for p in _CLI_PROVIDERS:
            results.append(
                {
                    "id": p["id"],
                    "name": p["name"],
                    "detected": shutil.which(p["binary"]) is not None,
                }
            )
        for p in _API_PROVIDERS:
            results.append(
                {
                    "id": p["id"],
                    "name": p["name"],
                    "detected": bool(os.environ.get(p["env"])),
                }
            )
        return results

    def write_persona(self, name: str, prompt: str) -> None:
        """Write SOUL.md to workspace with persona configuration"""
        soul_md = Path(self.workspace_dir) / "SOUL.md"
        soul_md.parent.mkdir(parents=True, exist_ok=True)
        soul_md.write_text(f"# {name}\n\n{prompt}\n", encoding="utf-8")

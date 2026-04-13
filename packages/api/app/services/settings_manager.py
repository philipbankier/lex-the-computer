import json
from pathlib import Path

from app.config import settings

PROVIDER_MODELS: dict[str, list[str]] = {
    "openai": ["gpt-4o", "gpt-4o-mini", "o3-mini", "o4-mini"],
    "anthropic": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    "google": ["gemini-2.5-pro", "gemini-2.5-flash"],
    "mistral": ["mistral-large-latest", "mistral-medium-latest"],
    "groq": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
    "openrouter": ["auto"],
}

_CONFIG_FILE = Path(settings.workspace_dir) / ".lex" / "providers.json"


def _load_config() -> dict:
    if _CONFIG_FILE.exists():
        return json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
    return {}


def _save_config(config: dict) -> None:
    _CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    _CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


def list_providers() -> list[dict]:
    config = _load_config()
    result = []
    for provider_id, models in PROVIDER_MODELS.items():
        result.append({
            "id": provider_id,
            "provider": provider_id,
            "models": models,
            "configured": provider_id in config,
        })
    return result


def get_provider(provider_id: str) -> dict | None:
    config = _load_config()
    if provider_id not in config:
        return None
    return config[provider_id]


def set_provider(provider_id: str, api_key: str, base_url: str | None = None, model: str | None = None) -> dict:
    config = _load_config()
    config[provider_id] = {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
    }
    _save_config(config)
    return config[provider_id]


def delete_provider(provider_id: str) -> bool:
    config = _load_config()
    if provider_id not in config:
        return False
    del config[provider_id]
    _save_config(config)
    return True

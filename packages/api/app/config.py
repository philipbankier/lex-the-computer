from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/lex"
    redis_url: str = "redis://redis:6379"

    # Agent Harness
    agent_harness: str = "hermes"  # "hermes" or "openclaw"

    # Hermes
    hermes_api_url: str = "http://hermes:8642"
    hermes_api_key: str = "lex-local-dev"
    hermes_data_dir: str = "/data/hermes"

    # OpenClaw
    openclaw_gateway_url: str = "ws://openclaw:18789"
    openclaw_gateway_token: str = ""

    # Honcho
    honcho_base_url: str = "http://honcho-api:8000"

    # Workspace
    workspace_dir: str = "/data/workspace"

    # Auth
    session_cookie_name: str = "lex_session"
    session_secret: str = "change-me-in-production"
    allowed_emails: list[str] = []  # empty = allow all

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_connect_client_id: str = ""

    # Media
    fal_key: str = ""
    groq_api_key: str = ""

    # OAuth providers
    google_client_id: str = ""
    google_client_secret: str = ""
    notion_client_id: str = ""
    notion_client_secret: str = ""
    dropbox_client_id: str = ""
    dropbox_client_secret: str = ""
    linear_client_id: str = ""
    linear_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""

    # Channels
    telegram_bot_token: str = ""
    discord_bot_token: str = ""

    # Multi-user (reserved for future)
    multi_user: bool = False
    admin_email: str = ""

    # Server
    base_url: str = "http://localhost:8000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

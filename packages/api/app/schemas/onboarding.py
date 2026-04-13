from pydantic import BaseModel


class AccountStep(BaseModel):
    email: str | None = None
    password: str | None = None
    single_user: bool = False


class ProviderStep(BaseModel):
    provider: str  # "anthropic", "openai", "openrouter", "local"
    model: str = "claude-sonnet-4-6"
    api_key: str = ""


class MemoryStep(BaseModel):
    provider: str = "honcho"  # "honcho" or "core"


class ChannelStep(BaseModel):
    telegram_bot_token: str | None = None
    telegram_user_id: int | None = None
    discord_bot_token: str | None = None


class WorkspaceStep(BaseModel):
    workspace_dir: str = "/data/workspace"


class OnboardingStatus(BaseModel):
    session_id: str
    current_step: int
    completed: bool
    steps: dict[str, bool]


class OnboardingStartResponse(BaseModel):
    session_id: str
    current_step: int

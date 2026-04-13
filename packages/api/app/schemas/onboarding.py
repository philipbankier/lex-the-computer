from pydantic import BaseModel


class ProfileStep(BaseModel):
    name: str
    handle: str | None = None
    bio: str | None = None


class MemoryStep(BaseModel):
    provider: str = "honcho"


class ProviderStep(BaseModel):
    provider: str
    model: str | None = None
    api_key: str | None = None


class PersonaStep(BaseModel):
    name: str
    prompt: str


class ChannelStep(BaseModel):
    telegram_bot_token: str | None = None
    discord_bot_token: str | None = None


class OnboardingStatus(BaseModel):
    completed: bool
    current_step: str | None = None
    steps: dict[str, bool] = {}

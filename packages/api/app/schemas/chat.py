from pydantic import BaseModel


class CreateConversationRequest(BaseModel):
    title: str | None = None


class SendMessageRequest(BaseModel):
    content: str
    model: str | None = None


class ConversationResponse(BaseModel):
    id: str
    title: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    message_count: int = 0


class AutomationCreate(BaseModel):
    name: str
    agent: str | None = None
    cron: str
    message: str
    enabled: bool = True


class AutomationUpdate(BaseModel):
    name: str | None = None
    cron: str | None = None
    message: str | None = None
    enabled: bool | None = None


class AutomationResponse(BaseModel):
    id: str
    name: str
    agent: str | None = None
    cron: str
    message: str
    enabled: bool

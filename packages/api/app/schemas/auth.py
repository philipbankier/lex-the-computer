from pydantic import BaseModel


class AuthRequest(BaseModel):
    email: str


class AuthResponse(BaseModel):
    id: int
    email: str


class SessionUser(BaseModel):
    id: int
    email: str
    name: str | None = None
    handle: str | None = None
    role: str = "user"
    onboarding_completed: bool = False


class SessionResponse(BaseModel):
    authenticated: bool
    user: SessionUser | None = None

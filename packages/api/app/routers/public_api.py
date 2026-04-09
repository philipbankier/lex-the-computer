from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.api_keys import validate_api_key

router = APIRouter(prefix="/api/v1", tags=["public-api"])


async def require_api_key(request: Request, db: AsyncSession = Depends(get_db)) -> int:
    """Extract and validate API key from Authorization header. Returns user_id."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header. Use: Bearer <api_key>")
    key = auth[7:]
    result = await validate_api_key(key, db)
    if not result["valid"]:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    return result["user_id"]


class AskRequest(BaseModel):
    message: str
    model_name: str = "gpt-4o-mini"
    stream: bool = False
    conversation_id: int | None = None


@router.post("/ask")
async def ask(body: AskRequest, user_id: int = Depends(require_api_key)):
    # In V2, this proxies to the OpenClaw harness — stubbed for now
    return {
        "response": "Public API will be connected to OpenClaw harness in Phase R4.",
        "model": body.model_name,
    }


@router.get("/models/available")
async def list_models(user_id: int = Depends(require_api_key)):
    # Will query OpenClaw for available models
    return {"data": []}


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: int, user_id: int = Depends(require_api_key)):
    # Will query OpenClaw sessions
    return {"error": "Conversations are managed by OpenClaw in V2"}, 501

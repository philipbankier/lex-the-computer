import asyncio
import socket
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.domain import CustomDomain

router = APIRouter(prefix="/api/domains", tags=["domains"])


class DomainCreate(BaseModel):
    domain: str
    target_type: str  # 'site' | 'space' | 'service'
    target_id: int | None = None


@router.post("/")
async def add_domain(body: DomainCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.target_type not in ("site", "space", "service"):
        return {"error": "target_type must be site, space, or service"}, 400

    token = f"lex-verify-{uuid4().hex[:12]}"
    domain = CustomDomain(
        user_id=user.id,
        domain=body.domain.lower().strip(),
        target_type=body.target_type,
        target_id=body.target_id,
        verified=False,
        verification_token=token,
        ssl_status="pending",
    )
    db.add(domain)
    await db.commit()
    await db.refresh(domain)
    return {
        "domain": domain,
        "dns_instructions": {
            "cname": {"type": "CNAME", "name": body.domain, "value": "your-lex-server.example.com"},
            "txt": {"type": "TXT", "name": f"_lex-verification.{body.domain}", "value": token},
        },
    }


@router.get("/")
async def list_domains(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomDomain).where(CustomDomain.user_id == user.id))
    return result.scalars().all()


@router.post("/{domain_id}/verify")
async def verify_domain(domain_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomDomain).where(CustomDomain.id == domain_id).limit(1))
    dom = result.scalar_one_or_none()
    if not dom:
        return {"error": "Not found"}, 404

    try:
        loop = asyncio.get_event_loop()
        txt_records = await loop.run_in_executor(
            None, lambda: socket.getaddrinfo(f"_lex-verification.{dom.domain}", None, socket.AF_INET, socket.SOCK_STREAM)
        )
        # DNS TXT lookup via resolver
        import dns.resolver
        answers = dns.resolver.resolve(f"_lex-verification.{dom.domain}", "TXT")
        flat = [r.to_text().strip('"') for rdata in answers for r in rdata.strings]
    except Exception:
        flat = []

    verified = dom.verification_token in flat
    if verified:
        dom.verified = True
        dom.ssl_status = "active"
        await db.commit()
        # Try updating Caddy
        await _update_caddy(dom.domain, dom.target_type, dom.target_id)
        return {"verified": True, "domain": dom}

    return {
        "verified": False,
        "expected_record": {"type": "TXT", "name": f"_lex-verification.{dom.domain}", "value": dom.verification_token},
        "found_records": flat,
    }


@router.delete("/{domain_id}")
async def delete_domain(domain_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomDomain).where(CustomDomain.id == domain_id).limit(1))
    dom = result.scalar_one_or_none()
    if dom:
        await _remove_caddy(dom.domain)
    await db.execute(delete(CustomDomain).where(CustomDomain.id == domain_id))
    await db.commit()
    return {"ok": True}


async def _update_caddy(domain: str, target_type: str, target_id: int | None) -> None:
    upstream = "localhost:3000"
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "http://localhost:2019/config/apps/http/servers/srv0/routes",
                json={
                    "match": [{"host": [domain]}],
                    "handle": [{"handler": "reverse_proxy", "upstreams": [{"dial": upstream}]}],
                },
                timeout=5,
            )
    except Exception:
        pass


async def _remove_caddy(domain: str) -> None:
    try:
        proc = await asyncio.create_subprocess_exec(
            "rm", "-f", f"/etc/caddy/conf.d/lex-{domain.replace('.', '-')}.caddy",
        )
        await proc.wait()
    except Exception:
        pass

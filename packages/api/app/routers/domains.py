import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.domains import DomainCreate
from app.services import domain_manager

router = APIRouter(prefix="/api/domains", tags=["domains"])


@router.post("/")
async def add_domain(body: DomainCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.target_type not in ("site", "space", "service"):
        raise HTTPException(status_code=400, detail="target_type must be site, space, or service")
    try:
        domain = await domain_manager.create_domain(
            db, user.id, domain=body.domain.lower().strip(),
            target_type=body.target_type, target_id=body.target_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {
        "domain": domain,
        "dns_instructions": {
            "cname": {"type": "CNAME", "name": body.domain, "value": "your-lex-server.example.com"},
            "txt": {"type": "TXT", "name": f"_lex-verification.{body.domain}", "value": domain.verification_token},
        },
    }


@router.get("/")
async def list_domains(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await domain_manager.list_domains(db, user.id)


@router.post("/{domain_id}/verify")
async def verify_domain(domain_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    domain = await domain_manager.verify_domain(db, user.id, domain_id)
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    if domain.verified:
        await _update_caddy(domain.domain, domain.target_type, domain.target_id)
        return {"verified": True, "domain": domain}
    return {
        "verified": False,
        "expected_record": {
            "type": "TXT",
            "name": f"_lex-verification.{domain.domain}",
            "value": domain.verification_token,
        },
    }


@router.delete("/{domain_id}")
async def delete_domain(domain_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dom = await domain_manager.get_domain(db, user.id, domain_id)
    if dom:
        await _remove_caddy(dom.domain)
    deleted = await domain_manager.delete_domain(db, user.id, domain_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Domain not found")
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

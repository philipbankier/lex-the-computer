import logging
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import CustomDomain

logger = logging.getLogger(__name__)


async def list_domains(db: AsyncSession, user_id: int) -> list[CustomDomain]:
    result = await db.execute(
        select(CustomDomain).where(CustomDomain.user_id == user_id).order_by(CustomDomain.created_at.desc())
    )
    return list(result.scalars().all())


async def get_domain(db: AsyncSession, user_id: int, domain_id: int) -> CustomDomain | None:
    result = await db.execute(
        select(CustomDomain).where(CustomDomain.id == domain_id, CustomDomain.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_domain(
    db: AsyncSession,
    user_id: int,
    *,
    domain: str,
    target_type: str,
    target_id: int | None = None,
) -> CustomDomain:
    existing = await db.execute(
        select(CustomDomain).where(CustomDomain.domain == domain)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Domain {domain} already registered")

    token = secrets.token_hex(16)
    cd = CustomDomain(
        user_id=user_id,
        domain=domain,
        target_type=target_type,
        target_id=target_id,
        verification_token=token,
    )
    db.add(cd)
    await db.commit()
    await db.refresh(cd)
    return cd


async def verify_domain(db: AsyncSession, user_id: int, domain_id: int) -> CustomDomain | None:
    cd = await get_domain(db, user_id, domain_id)
    if cd is None:
        return None

    verified = await _check_dns(cd.domain, cd.verification_token)
    if verified:
        cd.verified = True
        cd.ssl_status = "active"
        await db.commit()
        await db.refresh(cd)

    return cd


async def delete_domain(db: AsyncSession, user_id: int, domain_id: int) -> bool:
    cd = await get_domain(db, user_id, domain_id)
    if cd is None:
        return False
    await db.delete(cd)
    await db.commit()
    return True


async def _check_dns(domain: str, expected_token: str) -> bool:
    import asyncio
    try:
        result = await asyncio.to_thread(_dns_lookup, domain, expected_token)
        return result
    except Exception as e:
        logger.warning("DNS check failed for %s: %s", domain, e)
        return False


def _dns_lookup(domain: str, expected_token: str) -> bool:
    try:
        import dns.resolver
        answers = dns.resolver.resolve(f"_lex-verify.{domain}", "TXT")
        for rdata in answers:
            if expected_token in str(rdata):
                return True
    except Exception:
        pass
    return False

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.commerce import (
    StripeAccount,
    StripeOrder,
    StripePaymentLink,
    StripePrice,
    StripeProduct,
)

logger = logging.getLogger(__name__)


def _stripe():
    import stripe
    stripe.api_key = settings.stripe_secret_key
    return stripe


async def get_account(db: AsyncSession, user_id: int) -> StripeAccount | None:
    result = await db.execute(
        select(StripeAccount).where(StripeAccount.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_account(db: AsyncSession, user_id: int, country: str = "US") -> StripeAccount:
    stripe = _stripe()
    acct = stripe.Account.create(type="express", country=country)
    sa = StripeAccount(
        user_id=user_id,
        stripe_account_id=acct.id,
        country=country,
    )
    db.add(sa)
    await db.commit()
    await db.refresh(sa)
    return sa


async def create_account_link(db: AsyncSession, user_id: int) -> str:
    stripe = _stripe()
    acct = await get_account(db, user_id)
    if acct is None:
        raise ValueError("No Stripe account found")
    link = stripe.AccountLink.create(
        account=acct.stripe_account_id,
        refresh_url=f"{settings.base_url}/sell/onboarding",
        return_url=f"{settings.base_url}/sell/dashboard",
        type="account_onboarding",
    )
    return link.url


async def get_account_status(db: AsyncSession, user_id: int) -> dict:
    stripe = _stripe()
    acct = await get_account(db, user_id)
    if acct is None:
        return {"connected": False}
    remote = stripe.Account.retrieve(acct.stripe_account_id)
    acct.charges_enabled = remote.charges_enabled
    acct.payouts_enabled = remote.payouts_enabled
    acct.onboarding_complete = remote.details_submitted
    await db.commit()
    return {
        "connected": True,
        "charges_enabled": remote.charges_enabled,
        "payouts_enabled": remote.payouts_enabled,
        "onboarding_complete": remote.details_submitted,
    }


async def list_products(db: AsyncSession, user_id: int) -> list[StripeProduct]:
    result = await db.execute(
        select(StripeProduct).where(StripeProduct.user_id == user_id).order_by(StripeProduct.created_at.desc())
    )
    return list(result.scalars().all())


async def create_product(
    db: AsyncSession, user_id: int, *, name: str, description: str | None = None
) -> StripeProduct:
    stripe = _stripe()
    acct = await get_account(db, user_id)
    if acct is None:
        raise ValueError("No Stripe account found")
    sp = stripe.Product.create(name=name, description=description or "", stripe_account=acct.stripe_account_id)
    product = StripeProduct(
        user_id=user_id,
        stripe_product_id=sp.id,
        name=name,
        description=description,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def create_price(
    db: AsyncSession,
    user_id: int,
    product_id: int,
    *,
    amount: int,
    currency: str = "usd",
    type: str = "one_time",
    interval: str | None = None,
) -> StripePrice:
    stripe = _stripe()
    acct = await get_account(db, user_id)
    if acct is None:
        raise ValueError("No Stripe account found")
    result = await db.execute(
        select(StripeProduct).where(StripeProduct.id == product_id, StripeProduct.user_id == user_id)
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise ValueError("Product not found")

    price_data: dict = {
        "unit_amount": amount,
        "currency": currency,
        "product": product.stripe_product_id,
        "stripe_account": acct.stripe_account_id,
    }
    if type == "recurring" and interval:
        price_data["recurring"] = {"interval": interval}

    sp = stripe.Price.create(**price_data)
    price = StripePrice(
        product_id=product_id,
        stripe_price_id=sp.id,
        amount=amount,
        currency=currency,
        type=type,
        interval=interval,
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    return price


async def create_payment_link(db: AsyncSession, user_id: int, price_id: int) -> StripePaymentLink:
    stripe = _stripe()
    acct = await get_account(db, user_id)
    if acct is None:
        raise ValueError("No Stripe account found")
    result = await db.execute(
        select(StripePrice).where(StripePrice.id == price_id)
    )
    price = result.scalar_one_or_none()
    if price is None:
        raise ValueError("Price not found")

    link = stripe.PaymentLink.create(
        line_items=[{"price": price.stripe_price_id, "quantity": 1}],
        stripe_account=acct.stripe_account_id,
    )
    pl = StripePaymentLink(
        price_id=price_id,
        stripe_payment_link_id=link.id,
        url=link.url,
    )
    db.add(pl)
    await db.commit()
    await db.refresh(pl)
    return pl


async def list_orders(db: AsyncSession, user_id: int) -> list[StripeOrder]:
    result = await db.execute(
        select(StripeOrder).where(StripeOrder.user_id == user_id).order_by(StripeOrder.created_at.desc())
    )
    return list(result.scalars().all())


async def fulfill_order(db: AsyncSession, user_id: int, order_id: int) -> StripeOrder | None:
    result = await db.execute(
        select(StripeOrder).where(StripeOrder.id == order_id, StripeOrder.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        return None
    order.fulfillment_status = "fulfilled"
    order.fulfilled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    return order


async def handle_webhook(db: AsyncSession, payload: bytes, sig_header: str) -> dict:
    stripe = _stripe()
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except Exception as e:
        raise ValueError(f"Webhook verification failed: {e}")

    if event.type == "checkout.session.completed":
        session = event.data.object
        acct = await db.execute(
            select(StripeAccount).where(
                StripeAccount.stripe_account_id == event.account
            )
        )
        sa = acct.scalar_one_or_none()
        if sa:
            order = StripeOrder(
                user_id=sa.user_id,
                stripe_session_id=session.id,
                product_name=session.get("metadata", {}).get("product_name", ""),
                amount=session.amount_total,
                currency=session.currency,
                customer_email=session.customer_details.email if session.customer_details else None,
                payment_status="paid",
                paid_at=datetime.now(timezone.utc),
            )
            db.add(order)
            await db.commit()

    return {"received": True}

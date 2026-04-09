from datetime import datetime, timezone

import stripe as stripe_lib
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.commerce import (
    StripeAccount, StripeProduct, StripePrice, StripePaymentLink, StripeOrder,
)

router = APIRouter(prefix="/api/sell", tags=["sell"])


def get_stripe() -> stripe_lib.StripeClient:
    return stripe_lib.StripeClient(settings.stripe_secret_key)


def stripe_configured() -> bool:
    return bool(settings.stripe_secret_key)


# ── Stripe Connect account ───────────────────────────────────────────


@router.post("/connect")
async def connect_stripe(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503
    client = get_stripe()
    account = client.accounts.create({"type": "express"})

    acct = StripeAccount(
        user_id=user.id, stripe_account_id=account.id,
        country=account.country or None,
    )
    db.add(acct)
    await db.commit()

    link = client.account_links.create({
        "account": account.id,
        "refresh_url": f"{settings.base_url}/api/sell/connect/callback?refresh=true",
        "return_url": f"{settings.base_url}/api/sell/connect/callback?success=true",
        "type": "account_onboarding",
    })
    return {"url": link.url, "accountId": account.id}


@router.get("/connect/callback")
async def connect_callback(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503

    result = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = result.scalar_one_or_none()
    if not acct:
        return RedirectResponse("/sell")

    client = get_stripe()
    sa = client.accounts.retrieve(acct.stripe_account_id)
    acct.onboarding_complete = sa.details_submitted or False
    acct.charges_enabled = sa.charges_enabled or False
    acct.payouts_enabled = sa.payouts_enabled or False
    acct.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return RedirectResponse("http://localhost:3000/sell")


@router.get("/account")
async def get_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"configured": False}

    result = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = result.scalar_one_or_none()
    if not acct:
        return {"connected": False, "configured": True}

    client = get_stripe()
    try:
        sa = client.accounts.retrieve(acct.stripe_account_id)
        acct.onboarding_complete = sa.details_submitted or False
        acct.charges_enabled = sa.charges_enabled or False
        acct.payouts_enabled = sa.payouts_enabled or False
        acct.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {
            "connected": True, "configured": True,
            "accountId": acct.stripe_account_id,
            "onboardingComplete": sa.details_submitted,
            "chargesEnabled": sa.charges_enabled,
            "payoutsEnabled": sa.payouts_enabled,
            "country": sa.country,
        }
    except Exception:
        return {"connected": True, "configured": True}


@router.post("/account/dashboard")
async def account_dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503
    result = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = result.scalar_one_or_none()
    if not acct:
        return {"error": "No Stripe account"}, 404
    client = get_stripe()
    link = client.accounts.create_login_link(acct.stripe_account_id)
    return {"url": link.url}


# ── Products ─────────────────────────────────────────────────────────


class ProductCreate(BaseModel):
    name: str
    description: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


@router.post("/products")
async def create_product(body: ProductCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503
    result = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = result.scalar_one_or_none()
    if not acct:
        return {"error": "Connect Stripe first"}, 400

    client = get_stripe()
    product = client.products.create(
        {"name": body.name, "description": body.description or ""},
        {"stripe_account": acct.stripe_account_id},
    )
    sp = StripeProduct(user_id=user.id, stripe_product_id=product.id, name=body.name, description=body.description)
    db.add(sp)
    await db.commit()
    await db.refresh(sp)
    return sp


@router.get("/products")
async def list_products(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    products = (await db.execute(
        select(StripeProduct).where(StripeProduct.user_id == user.id).order_by(StripeProduct.created_at.desc())
    )).scalars().all()

    result = []
    for p in products:
        prices = (await db.execute(select(StripePrice).where(StripePrice.product_id == p.id))).scalars().all()
        links = []
        for pr in prices:
            pls = (await db.execute(select(StripePaymentLink).where(StripePaymentLink.price_id == pr.id))).scalars().all()
            links.extend(pls)
        result.append({**p.__dict__, "prices": prices, "paymentLinks": links})
    return result


@router.put("/products/{product_id}")
async def update_product(product_id: int, body: ProductUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503
    result = await db.execute(select(StripeProduct).where(StripeProduct.id == product_id, StripeProduct.user_id == user.id).limit(1))
    product = result.scalar_one_or_none()
    if not product:
        return {"error": "Not found"}, 404
    acct_r = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = acct_r.scalar_one_or_none()
    if not acct:
        return {"error": "No Stripe account"}, 400

    client = get_stripe()
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
        product.name = body.name
    if body.description is not None:
        updates["description"] = body.description
        product.description = body.description
    if updates:
        client.products.update(product.stripe_product_id, updates, {"stripe_account": acct.stripe_account_id})
    await db.commit()
    return {"ok": True}


# ── Prices ───────────────────────────────────────────────────────────


class PriceCreate(BaseModel):
    amount: int
    currency: str = "usd"
    type: str = "one_time"
    interval: str | None = None


@router.post("/products/{product_id}/prices")
async def create_price(product_id: int, body: PriceCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503
    prod_r = await db.execute(select(StripeProduct).where(StripeProduct.id == product_id, StripeProduct.user_id == user.id).limit(1))
    product = prod_r.scalar_one_or_none()
    if not product:
        return {"error": "Product not found"}, 404
    acct_r = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = acct_r.scalar_one_or_none()
    if not acct:
        return {"error": "Connect Stripe first"}, 400

    client = get_stripe()
    params: dict = {"product": product.stripe_product_id, "unit_amount": body.amount, "currency": body.currency}
    if body.type == "recurring":
        params["recurring"] = {"interval": body.interval or "month"}

    sp = client.prices.create(params, {"stripe_account": acct.stripe_account_id})
    price = StripePrice(
        product_id=product_id, stripe_price_id=sp.id, amount=body.amount,
        currency=body.currency, type=body.type, interval=body.interval if body.type == "recurring" else None,
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    return price


# ── Payment Links ────────────────────────────────────────────────────


@router.post("/prices/{price_id}/payment-link")
async def create_payment_link(price_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503
    pr_r = await db.execute(select(StripePrice).where(StripePrice.id == price_id).limit(1))
    price = pr_r.scalar_one_or_none()
    if not price:
        return {"error": "Price not found"}, 404
    acct_r = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = acct_r.scalar_one_or_none()
    if not acct:
        return {"error": "Connect Stripe first"}, 400

    client = get_stripe()
    pl = client.payment_links.create(
        {"line_items": [{"price": price.stripe_price_id, "quantity": 1}], "application_fee_amount": 0},
        {"stripe_account": acct.stripe_account_id},
    )
    link = StripePaymentLink(price_id=price_id, stripe_payment_link_id=pl.id, url=pl.url)
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


@router.get("/payment-links")
async def list_payment_links(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    products = (await db.execute(select(StripeProduct).where(StripeProduct.user_id == user.id))).scalars().all()
    links = []
    for p in products:
        prices = (await db.execute(select(StripePrice).where(StripePrice.product_id == p.id))).scalars().all()
        for pr in prices:
            pls = (await db.execute(select(StripePaymentLink).where(StripePaymentLink.price_id == pr.id))).scalars().all()
            links.extend({"productName": p.name, "amount": pr.amount, "currency": pr.currency, **pl.__dict__} for pl in pls)
    return links


class LinkUpdate(BaseModel):
    active: bool


@router.put("/payment-links/{link_id}")
async def update_payment_link(link_id: int, body: LinkUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503
    result = await db.execute(select(StripePaymentLink).where(StripePaymentLink.id == link_id).limit(1))
    link = result.scalar_one_or_none()
    if not link:
        return {"error": "Not found"}, 404
    acct_r = await db.execute(select(StripeAccount).where(StripeAccount.user_id == user.id).limit(1))
    acct = acct_r.scalar_one_or_none()
    if not acct:
        return {"error": "No Stripe account"}, 400
    client = get_stripe()
    client.payment_links.update(link.stripe_payment_link_id, {"active": body.active}, {"stripe_account": acct.stripe_account_id})
    link.active = body.active
    await db.commit()
    return {"ok": True}


# ── Orders ───────────────────────────────────────────────────────────


@router.get("/orders")
async def list_orders(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db), status: str | None = None, limit: int = 100):
    result = await db.execute(
        select(StripeOrder).where(StripeOrder.user_id == user.id).order_by(StripeOrder.created_at.desc()).limit(limit)
    )
    orders = result.scalars().all()
    if status:
        orders = [o for o in orders if o.payment_status == status or o.fulfillment_status == status]
    return orders


@router.put("/orders/{order_id}/fulfill")
async def fulfill_order(order_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(StripeOrder).where(StripeOrder.id == order_id).values(
            fulfillment_status="fulfilled", fulfilled_at=datetime.now(timezone.utc)
        )
    )
    await db.commit()
    return {"ok": True}


@router.get("/orders/export")
async def export_orders(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StripeOrder).where(StripeOrder.user_id == user.id).order_by(StripeOrder.created_at.desc())
    )
    orders = result.scalars().all()
    header = "id,product_name,amount,currency,customer_email,payment_status,fulfillment_status,paid_at,created_at"
    rows = [
        f'{o.id},"{o.product_name or ""}",{o.amount or 0},{o.currency or "usd"},"{o.customer_email or ""}",{o.payment_status},{o.fulfillment_status},{o.paid_at or ""},{o.created_at}'
        for o in orders
    ]
    csv = "\n".join([header, *rows])
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="orders.csv"'})


# ── Stripe Webhook ───────────────────────────────────────────────────


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    if not stripe_configured():
        return {"error": "Stripe not configured"}, 503

    raw_body = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        if settings.stripe_webhook_secret and sig:
            event = stripe_lib.Webhook.construct_event(raw_body, sig, settings.stripe_webhook_secret)
        else:
            import json
            event = json.loads(raw_body)
    except Exception as e:
        return {"error": f"Webhook Error: {e}"}, 400

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        acct_id = event.get("account")
        user_id = 1
        if acct_id:
            r = await db.execute(select(StripeAccount).where(StripeAccount.stripe_account_id == acct_id).limit(1))
            acct = r.scalar_one_or_none()
            if acct:
                user_id = acct.user_id

        order = StripeOrder(
            user_id=user_id, stripe_session_id=session.get("id"),
            product_name=session.get("metadata", {}).get("product_name"),
            amount=session.get("amount_total"), currency=session.get("currency"),
            customer_email=session.get("customer_details", {}).get("email") or session.get("customer_email"),
            payment_status="paid", paid_at=datetime.now(timezone.utc),
        )
        db.add(order)
        await db.commit()

    if event.get("type") in ("checkout.session.expired", "payment_intent.payment_failed"):
        session = event["data"]["object"]
        await db.execute(
            update(StripeOrder).where(StripeOrder.stripe_session_id == session.get("id")).values(payment_status="failed")
        )
        await db.commit()

    return {"received": True}

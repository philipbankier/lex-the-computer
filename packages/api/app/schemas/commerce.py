from datetime import datetime

from pydantic import BaseModel


class AccountCreate(BaseModel):
    country: str = "US"


class AccountResponse(BaseModel):
    id: int
    stripe_account_id: str
    country: str | None = None
    onboarding_complete: bool
    charges_enabled: bool
    payouts_enabled: bool
    created_at: datetime


class ProductCreate(BaseModel):
    name: str
    description: str | None = None


class ProductResponse(BaseModel):
    id: int
    stripe_product_id: str
    name: str
    description: str | None = None
    active: bool
    created_at: datetime


class PriceCreate(BaseModel):
    amount: int
    currency: str = "usd"
    type: str = "one_time"
    interval: str | None = None


class PriceResponse(BaseModel):
    id: int
    product_id: int
    stripe_price_id: str
    amount: int
    currency: str
    type: str
    interval: str | None = None
    created_at: datetime


class PaymentLinkCreate(BaseModel):
    pass


class PaymentLinkResponse(BaseModel):
    id: int
    price_id: int
    stripe_payment_link_id: str
    url: str
    active: bool
    created_at: datetime


class OrderResponse(BaseModel):
    id: int
    stripe_session_id: str
    product_name: str | None = None
    amount: int | None = None
    currency: str | None = None
    customer_email: str | None = None
    payment_status: str
    fulfillment_status: str
    paid_at: datetime | None = None
    fulfilled_at: datetime | None = None
    created_at: datetime


class FulfillRequest(BaseModel):
    notes: str | None = None

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class StripeAccount(Base):
    __tablename__ = "stripe_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    stripe_account_id = Column(Text, nullable=False)
    country = Column(String(8))
    onboarding_complete = Column(Boolean, default=False, nullable=False)
    charges_enabled = Column(Boolean, default=False, nullable=False)
    payouts_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StripeProduct(Base):
    __tablename__ = "stripe_products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    stripe_product_id = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StripePrice(Base):
    __tablename__ = "stripe_prices"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, nullable=False, index=True)
    stripe_price_id = Column(Text, nullable=False)
    amount = Column(Integer, nullable=False)  # cents
    currency = Column(String(8), default="usd", nullable=False)
    type = Column(String(16), default="one_time", nullable=False)  # 'one_time' | 'recurring'
    interval = Column(String(16))  # 'month' | 'year' for recurring
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StripePaymentLink(Base):
    __tablename__ = "stripe_payment_links"

    id = Column(Integer, primary_key=True, index=True)
    price_id = Column(Integer, nullable=False, index=True)
    stripe_payment_link_id = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StripeOrder(Base):
    __tablename__ = "stripe_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    stripe_session_id = Column(Text)
    product_name = Column(Text)
    amount = Column(Integer)
    currency = Column(String(8))
    customer_email = Column(Text)
    payment_status = Column(String(32))
    fulfillment_status = Column(String(32))
    paid_at = Column(DateTime(timezone=True))
    fulfilled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

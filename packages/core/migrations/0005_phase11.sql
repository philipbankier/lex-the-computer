-- Phase 11: Commerce & Multi-User

-- Add admin role and disabled flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(16) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

-- Stripe Connect accounts
CREATE TABLE IF NOT EXISTS stripe_accounts (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  stripe_account_id text NOT NULL,
  country varchar(8),
  onboarding_complete boolean NOT NULL DEFAULT false,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Stripe products
CREATE TABLE IF NOT EXISTS stripe_products (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  stripe_product_id text NOT NULL,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stripe prices
CREATE TABLE IF NOT EXISTS stripe_prices (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  stripe_price_id text NOT NULL,
  amount integer NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'usd',
  type varchar(16) NOT NULL DEFAULT 'one_time',
  interval varchar(16),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stripe payment links
CREATE TABLE IF NOT EXISTS stripe_payment_links (
  id serial PRIMARY KEY,
  price_id integer NOT NULL,
  stripe_payment_link_id text NOT NULL,
  url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stripe orders
CREATE TABLE IF NOT EXISTS stripe_orders (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  stripe_session_id text NOT NULL,
  product_name text,
  amount integer,
  currency varchar(8),
  customer_email text,
  payment_status varchar(16) NOT NULL DEFAULT 'pending',
  fulfillment_status varchar(16) NOT NULL DEFAULT 'unfulfilled',
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User containers (multi-user mode)
CREATE TABLE IF NOT EXISTS user_containers (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  container_id text,
  status varchar(16) NOT NULL DEFAULT 'creating',
  hostname text,
  cpu_limit varchar(8) NOT NULL DEFAULT '1',
  memory_limit varchar(8) NOT NULL DEFAULT '2g',
  storage_limit varchar(8) NOT NULL DEFAULT '10g',
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Usage metering
CREATE TABLE IF NOT EXISTS usage_records (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  type varchar(32) NOT NULL,
  amount bigint NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user ON stripe_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_products_user ON stripe_products(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_user ON stripe_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_status ON stripe_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_user_containers_user ON user_containers(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_user ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_type ON usage_records(type);
CREATE INDEX IF NOT EXISTS idx_usage_records_created ON usage_records(created_at);

import type { ToolDefinition } from './types.js';
import { getDb, schema } from '../lib/db.js';
import { getStripe, isStripeConfigured } from '../services/stripe.js';
import { eq, desc, and, inArray } from 'drizzle-orm';

const userIdFromCtx = () => 1;

export const createStripeProductTool: ToolDefinition<{ name: string; description?: string }> = {
  name: 'create_stripe_product',
  description: 'Create a new product on your Stripe Connect account',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Product name' },
      description: { type: 'string', description: 'Product description' },
    },
    required: ['name'],
  },
  async execute({ name, description }) {
    if (!isStripeConfigured()) return { error: 'Stripe not configured' };
    const userId = userIdFromCtx();
    const db = await getDb();
    const stripe = getStripe();

    const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
    const acct = acctRows[0];
    if (!acct) return { error: 'Connect Stripe first via Settings → Sell' };

    const product = await stripe.products.create(
      { name, description: description || undefined },
      { stripeAccount: acct.stripe_account_id },
    );

    const [row] = await db.insert(schema.stripe_products).values({
      user_id: userId,
      stripe_product_id: product.id,
      name,
      description: description || null,
    }).returning();

    return { product: row };
  },
};

export const createStripePriceTool: ToolDefinition<{ productId: number; amount: number; currency?: string; type?: string; interval?: string }> = {
  name: 'create_stripe_price',
  description: 'Create a price for a product (amount in cents)',
  parameters: {
    type: 'object',
    properties: {
      productId: { type: 'number', description: 'Local product ID' },
      amount: { type: 'number', description: 'Price in cents (e.g. 999 = $9.99)' },
      currency: { type: 'string', description: 'Currency code (default: usd)' },
      type: { type: 'string', enum: ['one_time', 'recurring'], description: 'Price type' },
      interval: { type: 'string', enum: ['month', 'year'], description: 'Billing interval for recurring' },
    },
    required: ['productId', 'amount'],
  },
  async execute({ productId, amount, currency, type, interval }) {
    if (!isStripeConfigured()) return { error: 'Stripe not configured' };
    const userId = userIdFromCtx();
    const db = await getDb();
    const stripe = getStripe();

    const prodRows = await db.select().from(schema.stripe_products)
      .where(and(eq(schema.stripe_products.id, productId), eq(schema.stripe_products.user_id, userId)));
    const product = prodRows[0];
    if (!product) return { error: 'Product not found' };

    const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
    const acct = acctRows[0];
    if (!acct) return { error: 'Connect Stripe first' };

    const priceType = type === 'recurring' ? 'recurring' : 'one_time';
    const params: any = { product: product.stripe_product_id, unit_amount: amount, currency: currency || 'usd' };
    if (priceType === 'recurring') params.recurring = { interval: interval || 'month' };

    const stripePrice = await stripe.prices.create(params, { stripeAccount: acct.stripe_account_id });

    const [row] = await db.insert(schema.stripe_prices).values({
      product_id: productId,
      stripe_price_id: stripePrice.id,
      amount,
      currency: currency || 'usd',
      type: priceType,
      interval: priceType === 'recurring' ? (interval || 'month') : null,
    }).returning();

    return { price: row };
  },
};

export const createStripePaymentLinkTool: ToolDefinition<{ priceId: number }> = {
  name: 'create_stripe_payment_link',
  description: 'Create a payment link for a price',
  parameters: {
    type: 'object',
    properties: {
      priceId: { type: 'number', description: 'Local price ID' },
    },
    required: ['priceId'],
  },
  async execute({ priceId }) {
    if (!isStripeConfigured()) return { error: 'Stripe not configured' };
    const userId = userIdFromCtx();
    const db = await getDb();
    const stripe = getStripe();

    const priceRows = await db.select().from(schema.stripe_prices).where(eq(schema.stripe_prices.id, priceId));
    const price = priceRows[0];
    if (!price) return { error: 'Price not found' };

    const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
    const acct = acctRows[0];
    if (!acct) return { error: 'Connect Stripe first' };

    const paymentLink = await stripe.paymentLinks.create(
      { line_items: [{ price: price.stripe_price_id, quantity: 1 }], application_fee_amount: 0 },
      { stripeAccount: acct.stripe_account_id },
    );

    const [row] = await db.insert(schema.stripe_payment_links).values({
      price_id: priceId,
      stripe_payment_link_id: paymentLink.id,
      url: paymentLink.url,
    }).returning();

    return { paymentLink: row };
  },
};

export const updateStripePaymentLinkTool: ToolDefinition<{ paymentLinkId: number; active: boolean }> = {
  name: 'update_stripe_payment_link',
  description: 'Activate or deactivate a payment link',
  parameters: {
    type: 'object',
    properties: {
      paymentLinkId: { type: 'number', description: 'Local payment link ID' },
      active: { type: 'boolean', description: 'Whether the link should be active' },
    },
    required: ['paymentLinkId', 'active'],
  },
  async execute({ paymentLinkId, active }) {
    if (!isStripeConfigured()) return { error: 'Stripe not configured' };
    const userId = userIdFromCtx();
    const db = await getDb();
    const stripe = getStripe();

    const rows = await db.select().from(schema.stripe_payment_links).where(eq(schema.stripe_payment_links.id, paymentLinkId));
    const link = rows[0];
    if (!link) return { error: 'Payment link not found' };

    const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
    const acct = acctRows[0];
    if (!acct) return { error: 'No Stripe account' };

    await stripe.paymentLinks.update(link.stripe_payment_link_id, { active }, { stripeAccount: acct.stripe_account_id });
    await db.update(schema.stripe_payment_links).set({ active }).where(eq(schema.stripe_payment_links.id, paymentLinkId));

    return { ok: true, active };
  },
};

export const updateStripeProductTool: ToolDefinition<{ productId: number; name?: string; description?: string }> = {
  name: 'update_stripe_product',
  description: 'Update a product name or description',
  parameters: {
    type: 'object',
    properties: {
      productId: { type: 'number', description: 'Local product ID' },
      name: { type: 'string', description: 'New product name' },
      description: { type: 'string', description: 'New product description' },
    },
    required: ['productId'],
  },
  async execute({ productId, name, description }) {
    if (!isStripeConfigured()) return { error: 'Stripe not configured' };
    const userId = userIdFromCtx();
    const db = await getDb();
    const stripe = getStripe();

    const prodRows = await db.select().from(schema.stripe_products)
      .where(and(eq(schema.stripe_products.id, productId), eq(schema.stripe_products.user_id, userId)));
    const product = prodRows[0];
    if (!product) return { error: 'Product not found' };

    const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
    const acct = acctRows[0];
    if (!acct) return { error: 'No Stripe account' };

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      await stripe.products.update(product.stripe_product_id, updates, { stripeAccount: acct.stripe_account_id });
      await db.update(schema.stripe_products).set(updates).where(eq(schema.stripe_products.id, productId));
    }

    return { ok: true };
  },
};

export const listStripePaymentLinksTool: ToolDefinition<Record<string, never>> = {
  name: 'list_stripe_payment_links',
  description: 'List all your payment links with product names and amounts',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const userId = userIdFromCtx();
    const db = await getDb();

    const products = await db.select().from(schema.stripe_products)
      .where(eq(schema.stripe_products.user_id, userId));

    const links = [];
    for (const p of products) {
      const prices = await db.select().from(schema.stripe_prices).where(eq(schema.stripe_prices.product_id, p.id));
      for (const pr of prices) {
        const pls = await db.select().from(schema.stripe_payment_links).where(eq(schema.stripe_payment_links.price_id, pr.id));
        links.push(...pls.map((l) => ({ ...l, productName: p.name, amount: pr.amount, currency: pr.currency })));
      }
    }

    return { paymentLinks: links };
  },
};

export const listStripeOrdersTool: ToolDefinition<{ status?: string; limit?: number }> = {
  name: 'list_stripe_orders',
  description: 'List recent orders from your Stripe Connect account',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by payment or fulfillment status' },
      limit: { type: 'number', description: 'Max orders to return (default 50)' },
    },
  },
  async execute({ status, limit }) {
    const userId = userIdFromCtx();
    const db = await getDb();

    const orders = await db.select().from(schema.stripe_orders)
      .where(eq(schema.stripe_orders.user_id, userId))
      .orderBy(desc(schema.stripe_orders.created_at))
      .limit(limit || 50);

    const filtered = status
      ? orders.filter((o) => o.payment_status === status || o.fulfillment_status === status)
      : orders;

    return { orders: filtered };
  },
};

export const updateStripeOrdersTool: ToolDefinition<{ orderIds: number[]; fulfillmentStatus: string }> = {
  name: 'update_stripe_orders',
  description: 'Update fulfillment status for one or more orders',
  parameters: {
    type: 'object',
    properties: {
      orderIds: { type: 'array', items: { type: 'number' }, description: 'Order IDs to update' },
      fulfillmentStatus: { type: 'string', enum: ['unfulfilled', 'fulfilled'], description: 'New fulfillment status' },
    },
    required: ['orderIds', 'fulfillmentStatus'],
  },
  async execute({ orderIds, fulfillmentStatus }) {
    const db = await getDb();
    const now = fulfillmentStatus === 'fulfilled' ? new Date() : null;

    for (const id of orderIds) {
      await db.update(schema.stripe_orders)
        .set({ fulfillment_status: fulfillmentStatus, fulfilled_at: now })
        .where(eq(schema.stripe_orders.id, id));
    }

    return { ok: true, updated: orderIds.length };
  },
};

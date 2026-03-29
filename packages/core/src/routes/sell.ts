import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { env } from '../lib/env.js';
import { getStripe, isStripeConfigured } from '../services/stripe.js';
import { eq, desc, and } from 'drizzle-orm';

const userIdFromCtx = () => 1; // TODO: real auth

export const sellRouter = new Hono();

// ── Stripe Connect account ───────────────────────────────────────────

sellRouter.post('/connect', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const userId = userIdFromCtx();
  const stripe = getStripe();

  const account = await stripe.accounts.create({ type: 'express' });
  const db = await getDb();

  await db.insert(schema.stripe_accounts).values({
    user_id: userId,
    stripe_account_id: account.id,
    country: account.country ?? null,
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${env.BASE_URL}/api/sell/connect/callback?refresh=true`,
    return_url: `${env.BASE_URL}/api/sell/connect/callback?success=true`,
    type: 'account_onboarding',
  });

  return c.json({ url: accountLink.url, accountId: account.id });
});

sellRouter.get('/connect/callback', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const userId = userIdFromCtx();
  const db = await getDb();
  const stripe = getStripe();

  const rows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = rows[0];
  if (!acct) return c.redirect('/sell');

  const stripeAccount = await stripe.accounts.retrieve(acct.stripe_account_id);
  await db.update(schema.stripe_accounts)
    .set({
      onboarding_complete: stripeAccount.details_submitted ?? false,
      charges_enabled: stripeAccount.charges_enabled ?? false,
      payouts_enabled: stripeAccount.payouts_enabled ?? false,
      updated_at: new Date(),
    })
    .where(eq(schema.stripe_accounts.id, acct.id));

  // Redirect to frontend sell page
  const webUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return c.redirect(`${webUrl}/sell`);
});

sellRouter.get('/account', async (c) => {
  if (!isStripeConfigured()) return c.json({ configured: false });
  const userId = userIdFromCtx();
  const db = await getDb();

  const rows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = rows[0];
  if (!acct) return c.json({ connected: false, configured: true });

  // Refresh status from Stripe
  const stripe = getStripe();
  try {
    const stripeAccount = await stripe.accounts.retrieve(acct.stripe_account_id);
    await db.update(schema.stripe_accounts)
      .set({
        onboarding_complete: stripeAccount.details_submitted ?? false,
        charges_enabled: stripeAccount.charges_enabled ?? false,
        payouts_enabled: stripeAccount.payouts_enabled ?? false,
        updated_at: new Date(),
      })
      .where(eq(schema.stripe_accounts.id, acct.id));

    return c.json({
      connected: true,
      configured: true,
      accountId: acct.stripe_account_id,
      onboardingComplete: stripeAccount.details_submitted,
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
      country: stripeAccount.country,
    });
  } catch {
    return c.json({ connected: true, configured: true, ...acct });
  }
});

sellRouter.post('/account/dashboard', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const userId = userIdFromCtx();
  const db = await getDb();
  const stripe = getStripe();

  const rows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = rows[0];
  if (!acct) return c.json({ error: 'No Stripe account' }, 404);

  const loginLink = await stripe.accounts.createLoginLink(acct.stripe_account_id);
  return c.json({ url: loginLink.url });
});

// ── Products ─────────────────────────────────────────────────────────

sellRouter.post('/products', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const userId = userIdFromCtx();
  const body = await c.req.json();
  const { name, description } = body;
  if (!name) return c.json({ error: 'Name required' }, 400);

  const db = await getDb();
  const stripe = getStripe();

  const rows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = rows[0];
  if (!acct) return c.json({ error: 'Connect Stripe first' }, 400);

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

  return c.json(row);
});

sellRouter.get('/products', async (c) => {
  const userId = userIdFromCtx();
  const db = await getDb();
  const products = await db.select().from(schema.stripe_products)
    .where(eq(schema.stripe_products.user_id, userId))
    .orderBy(desc(schema.stripe_products.created_at));

  // Attach prices and payment links for each product
  const result = [];
  for (const p of products) {
    const prices = await db.select().from(schema.stripe_prices)
      .where(eq(schema.stripe_prices.product_id, p.id));
    const links = [];
    for (const pr of prices) {
      const pls = await db.select().from(schema.stripe_payment_links)
        .where(eq(schema.stripe_payment_links.price_id, pr.id));
      links.push(...pls);
    }
    result.push({ ...p, prices, paymentLinks: links });
  }

  return c.json(result);
});

sellRouter.put('/products/:id', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const id = Number.parseInt(c.req.param('id'), 10);
  const userId = userIdFromCtx();
  const body = await c.req.json();
  const db = await getDb();
  const stripe = getStripe();

  const rows = await db.select().from(schema.stripe_products)
    .where(and(eq(schema.stripe_products.id, id), eq(schema.stripe_products.user_id, userId)));
  const product = rows[0];
  if (!product) return c.json({ error: 'Not found' }, 404);

  const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = acctRows[0];
  if (!acct) return c.json({ error: 'No Stripe account' }, 400);

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  if (Object.keys(updates).length > 0) {
    await stripe.products.update(product.stripe_product_id, updates, { stripeAccount: acct.stripe_account_id });
    await db.update(schema.stripe_products).set(updates).where(eq(schema.stripe_products.id, id));
  }

  return c.json({ ok: true });
});

// ── Prices ───────────────────────────────────────────────────────────

sellRouter.post('/products/:id/prices', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const productId = Number.parseInt(c.req.param('id'), 10);
  const userId = userIdFromCtx();
  const body = await c.req.json();
  const { amount, currency, type, interval } = body;

  if (!amount || amount <= 0) return c.json({ error: 'Amount required (cents)' }, 400);

  const db = await getDb();
  const stripe = getStripe();

  const prodRows = await db.select().from(schema.stripe_products)
    .where(and(eq(schema.stripe_products.id, productId), eq(schema.stripe_products.user_id, userId)));
  const product = prodRows[0];
  if (!product) return c.json({ error: 'Product not found' }, 404);

  const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = acctRows[0];
  if (!acct) return c.json({ error: 'Connect Stripe first' }, 400);

  const priceType = type === 'recurring' ? 'recurring' : 'one_time';
  const priceParams: any = {
    product: product.stripe_product_id,
    unit_amount: amount,
    currency: currency || 'usd',
  };
  if (priceType === 'recurring') {
    priceParams.recurring = { interval: interval || 'month' };
  }

  const stripePrice = await stripe.prices.create(priceParams, { stripeAccount: acct.stripe_account_id });

  const [row] = await db.insert(schema.stripe_prices).values({
    product_id: productId,
    stripe_price_id: stripePrice.id,
    amount,
    currency: currency || 'usd',
    type: priceType,
    interval: priceType === 'recurring' ? (interval || 'month') : null,
  }).returning();

  return c.json(row);
});

// ── Payment Links ────────────────────────────────────────────────────

sellRouter.post('/prices/:id/payment-link', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const priceId = Number.parseInt(c.req.param('id'), 10);
  const userId = userIdFromCtx();
  const db = await getDb();
  const stripe = getStripe();

  const priceRows = await db.select().from(schema.stripe_prices)
    .where(eq(schema.stripe_prices.id, priceId));
  const price = priceRows[0];
  if (!price) return c.json({ error: 'Price not found' }, 404);

  const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = acctRows[0];
  if (!acct) return c.json({ error: 'Connect Stripe first' }, 400);

  const paymentLink = await stripe.paymentLinks.create(
    {
      line_items: [{ price: price.stripe_price_id, quantity: 1 }],
      application_fee_amount: 0, // 0% platform fee
    },
    { stripeAccount: acct.stripe_account_id },
  );

  const [row] = await db.insert(schema.stripe_payment_links).values({
    price_id: priceId,
    stripe_payment_link_id: paymentLink.id,
    url: paymentLink.url,
  }).returning();

  return c.json(row);
});

sellRouter.get('/payment-links', async (c) => {
  const userId = userIdFromCtx();
  const db = await getDb();

  // Join through prices → products to filter by user
  const products = await db.select().from(schema.stripe_products)
    .where(eq(schema.stripe_products.user_id, userId));

  const links = [];
  for (const p of products) {
    const prices = await db.select().from(schema.stripe_prices)
      .where(eq(schema.stripe_prices.product_id, p.id));
    for (const pr of prices) {
      const pls = await db.select().from(schema.stripe_payment_links)
        .where(eq(schema.stripe_payment_links.price_id, pr.id));
      links.push(...pls.map((l) => ({ ...l, productName: p.name, amount: pr.amount, currency: pr.currency })));
    }
  }

  return c.json(links);
});

sellRouter.put('/payment-links/:id', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const id = Number.parseInt(c.req.param('id'), 10);
  const userId = userIdFromCtx();
  const body = await c.req.json();
  const db = await getDb();
  const stripe = getStripe();

  const rows = await db.select().from(schema.stripe_payment_links)
    .where(eq(schema.stripe_payment_links.id, id));
  const link = rows[0];
  if (!link) return c.json({ error: 'Not found' }, 404);

  const acctRows = await db.select().from(schema.stripe_accounts).where(eq(schema.stripe_accounts.user_id, userId));
  const acct = acctRows[0];
  if (!acct) return c.json({ error: 'No Stripe account' }, 400);

  if (body.active !== undefined) {
    await stripe.paymentLinks.update(link.stripe_payment_link_id, { active: body.active }, { stripeAccount: acct.stripe_account_id });
    await db.update(schema.stripe_payment_links).set({ active: body.active }).where(eq(schema.stripe_payment_links.id, id));
  }

  return c.json({ ok: true });
});

// ── Orders ───────────────────────────────────────────────────────────

sellRouter.get('/orders', async (c) => {
  const userId = userIdFromCtx();
  const db = await getDb();
  const status = c.req.query('status');
  const limit = Number(c.req.query('limit') || '100');

  let query = db.select().from(schema.stripe_orders)
    .where(eq(schema.stripe_orders.user_id, userId))
    .orderBy(desc(schema.stripe_orders.created_at))
    .limit(limit);

  const orders = await query;
  const filtered = status ? orders.filter((o) => o.payment_status === status || o.fulfillment_status === status) : orders;

  return c.json(filtered);
});

sellRouter.put('/orders/:id/fulfill', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const db = await getDb();

  await db.update(schema.stripe_orders)
    .set({ fulfillment_status: 'fulfilled', fulfilled_at: new Date() })
    .where(eq(schema.stripe_orders.id, id));

  return c.json({ ok: true });
});

sellRouter.get('/orders/export', async (c) => {
  const userId = userIdFromCtx();
  const db = await getDb();

  const orders = await db.select().from(schema.stripe_orders)
    .where(eq(schema.stripe_orders.user_id, userId))
    .orderBy(desc(schema.stripe_orders.created_at));

  const header = 'id,product_name,amount,currency,customer_email,payment_status,fulfillment_status,paid_at,created_at';
  const rows = orders.map((o) =>
    `${o.id},"${o.product_name || ''}",${o.amount || 0},${o.currency || 'usd'},"${o.customer_email || ''}",${o.payment_status},${o.fulfillment_status},${o.paid_at || ''},${o.created_at}`
  );
  const csv = [header, ...rows].join('\n');

  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', 'attachment; filename="orders.csv"');
  return c.body(csv);
});

// ── Stripe Webhook ───────────────────────────────────────────────────

sellRouter.post('/webhook', async (c) => {
  if (!isStripeConfigured()) return c.json({ error: 'Stripe not configured' }, 503);
  const stripe = getStripe();
  const sig = c.req.header('stripe-signature');
  const rawBody = await c.req.text();

  let event;
  try {
    if (env.STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(rawBody);
    }
  } catch (err: any) {
    return c.json({ error: `Webhook Error: ${err.message}` }, 400);
  }

  const db = await getDb();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // Find the user by Stripe account
    const acctId = event.account;
    let userId = 1;
    if (acctId) {
      const acctRows = await db.select().from(schema.stripe_accounts)
        .where(eq(schema.stripe_accounts.stripe_account_id, acctId));
      if (acctRows[0]) userId = acctRows[0].user_id;
    }

    await db.insert(schema.stripe_orders).values({
      user_id: userId,
      stripe_session_id: session.id,
      product_name: session.metadata?.product_name || null,
      amount: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email || session.customer_email || null,
      payment_status: 'paid',
      paid_at: new Date(),
    });
  }

  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const session = event.data.object;
    // Try to update if exists
    await db.update(schema.stripe_orders)
      .set({ payment_status: 'failed' })
      .where(eq(schema.stripe_orders.stripe_session_id, session.id));
  }

  return c.json({ received: true });
});

"use client";
import { useEffect, useState } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type StripeAccount = {
  connected: boolean;
  configured: boolean;
  accountId?: string;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  country?: string;
};

type Price = { id: number; stripe_price_id: string; amount: number; currency: string; type: string; interval?: string };
type PaymentLink = { id: number; url: string; active: boolean; stripe_payment_link_id: string };
type Product = {
  id: number; name: string; description?: string; active: boolean; stripe_product_id: string;
  prices: Price[]; paymentLinks: PaymentLink[];
};

type Order = {
  id: number; product_name?: string; amount?: number; currency?: string;
  customer_email?: string; payment_status: string; fulfillment_status: string;
  paid_at?: string; created_at: string;
};

export default function SellPage() {
  const [tab, setTab] = useState<'account' | 'products' | 'orders'>('account');
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', amount: '', type: 'one_time', interval: 'month' });
  const [loading, setLoading] = useState(true);

  async function loadAccount() {
    const r = await fetch(`${CORE_URL}/api/sell/account`);
    setAccount(await r.json());
    setLoading(false);
  }

  async function loadProducts() {
    const r = await fetch(`${CORE_URL}/api/sell/products`);
    setProducts(await r.json());
  }

  async function loadOrders() {
    const r = await fetch(`${CORE_URL}/api/sell/orders`);
    setOrders(await r.json());
  }

  useEffect(() => {
    void loadAccount();
    void loadProducts();
    void loadOrders();
  }, []);

  async function connectStripe() {
    const r = await fetch(`${CORE_URL}/api/sell/connect`, { method: 'POST' });
    const { url } = await r.json();
    if (url) window.location.href = url;
  }

  async function openDashboard() {
    const r = await fetch(`${CORE_URL}/api/sell/account/dashboard`, { method: 'POST' });
    const { url } = await r.json();
    if (url) window.open(url, '_blank');
  }

  async function createProduct() {
    if (!form.name || !form.amount) return;
    // 1. Create product
    const pr = await fetch(`${CORE_URL}/api/sell/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description }),
    });
    const product = await pr.json();

    // 2. Create price
    const amountCents = Math.round(parseFloat(form.amount) * 100);
    const priceR = await fetch(`${CORE_URL}/api/sell/products/${product.id}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountCents, currency: 'usd', type: form.type, interval: form.type === 'recurring' ? form.interval : undefined }),
    });
    const price = await priceR.json();

    // 3. Create payment link
    await fetch(`${CORE_URL}/api/sell/prices/${price.id}/payment-link`, { method: 'POST' });

    setShowCreate(false);
    setForm({ name: '', description: '', amount: '', type: 'one_time', interval: 'month' });
    await loadProducts();
  }

  async function toggleLink(linkId: number, active: boolean) {
    await fetch(`${CORE_URL}/api/sell/payment-links/${linkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    await loadProducts();
  }

  async function fulfillOrder(orderId: number) {
    await fetch(`${CORE_URL}/api/sell/orders/${orderId}/fulfill`, { method: 'PUT' });
    await loadOrders();
  }

  async function exportCSV() {
    window.open(`${CORE_URL}/api/sell/orders/export`, '_blank');
  }

  const tabs = ['account', 'products', 'orders'] as const;

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-semibold">Sell</div>
      <div className="text-sm opacity-60">Accept payments with Stripe Connect — 0% platform fee</div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t}
            className={`px-3 py-1.5 text-sm rounded-t capitalize ${tab === t ? 'bg-white/10 font-medium' : 'hover:bg-white/5'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {tab === 'account' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-sm opacity-60">Loading...</div>
          ) : !account?.configured ? (
            <div className="rounded border border-white/10 p-4 space-y-2">
              <div className="font-medium">Stripe Not Configured</div>
              <div className="text-sm opacity-60">Set STRIPE_SECRET_KEY and STRIPE_CONNECT_CLIENT_ID in your environment.</div>
            </div>
          ) : !account?.connected ? (
            <div className="rounded border border-white/10 p-4 space-y-3">
              <div className="font-medium">Connect Your Stripe Account</div>
              <div className="text-sm opacity-60">Start accepting payments by connecting to Stripe. 0% platform fee — you keep 100%.</div>
              <button onClick={connectStripe} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium">
                Connect Stripe
              </button>
            </div>
          ) : (
            <div className="rounded border border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="font-medium">Stripe Connected</div>
                <span className={`text-xs px-2 py-0.5 rounded ${account.chargesEnabled ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                  {account.chargesEnabled ? 'Active' : 'Pending'}
                </span>
              </div>
              <div className="text-sm space-y-1 opacity-80">
                <div>Account: {account.accountId}</div>
                <div>Country: {account.country || 'N/A'}</div>
                <div>Onboarding: {account.onboardingComplete ? 'Complete' : 'Incomplete'}</div>
                <div>Charges: {account.chargesEnabled ? 'Enabled' : 'Disabled'}</div>
                <div>Payouts: {account.payoutsEnabled ? 'Enabled' : 'Disabled'}</div>
              </div>
              <button onClick={openDashboard} className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-sm">
                Open Stripe Dashboard
              </button>
            </div>
          )}
        </div>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-sm opacity-60">{products.length} product{products.length !== 1 ? 's' : ''}</div>
            <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium">
              Create Product
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {products.map((p) => (
              <div key={p.id} className="rounded border border-white/10 p-3 space-y-2 bg-black/20">
                <div className="font-medium">{p.name}</div>
                {p.description && <div className="text-sm opacity-60">{p.description}</div>}
                {p.prices.map((pr) => (
                  <div key={pr.id} className="text-sm">
                    ${(pr.amount / 100).toFixed(2)} {pr.currency.toUpperCase()}
                    {pr.type === 'recurring' && ` / ${pr.interval}`}
                  </div>
                ))}
                {p.paymentLinks.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <input
                      readOnly
                      value={l.url}
                      className="flex-1 text-xs px-2 py-1 bg-black/30 border border-white/10 rounded truncate"
                      onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(l.url); }}
                    />
                    <button
                      onClick={() => toggleLink(l.id, l.active)}
                      className={`text-xs px-2 py-1 rounded ${l.active ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                    >
                      {l.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {products.length === 0 && (
            <div className="text-center py-8 opacity-40">No products yet. Create one to start selling.</div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-sm opacity-60">{orders.length} order{orders.length !== 1 ? 's' : ''}</div>
            <button onClick={exportCSV} className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-sm">
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left opacity-60">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">Fulfillment</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-white/5">
                    <td className="py-2 pr-3">{o.product_name || '—'}</td>
                    <td className="py-2 pr-3">{o.amount ? `$${(o.amount / 100).toFixed(2)}` : '—'}</td>
                    <td className="py-2 pr-3 truncate max-w-[150px]">{o.customer_email || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${o.payment_status === 'paid' ? 'bg-green-500/20' : o.payment_status === 'failed' ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                        {o.payment_status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${o.fulfillment_status === 'fulfilled' ? 'bg-green-500/20' : 'bg-white/10'}`}>
                        {o.fulfillment_status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs opacity-60">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-2">
                      {o.fulfillment_status === 'unfulfilled' && o.payment_status === 'paid' && (
                        <button onClick={() => fulfillOrder(o.id)} className="text-xs px-2 py-1 bg-white/10 hover:bg-white/15 rounded">
                          Fulfill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {orders.length === 0 && (
            <div className="text-center py-8 opacity-40">No orders yet.</div>
          )}
        </div>
      )}

      {/* Create Product Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-black border border-white/10 rounded-lg p-5 space-y-4">
            <div className="text-lg font-semibold">Create Product</div>

            <div className="space-y-1">
              <div className="text-sm opacity-80">Name</div>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-sm"
                placeholder="Product name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm opacity-80">Description</div>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-sm"
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm opacity-80">Price (USD)</div>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-sm"
                placeholder="9.99"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm opacity-80">Type</div>
              <div className="flex gap-2">
                {['one_time', 'recurring'].map((t) => (
                  <button
                    key={t}
                    className={`px-3 py-1.5 text-sm rounded ${form.type === t ? 'bg-white/15 font-medium' : 'bg-white/5 hover:bg-white/10'}`}
                    onClick={() => setForm({ ...form, type: t })}
                  >
                    {t === 'one_time' ? 'One-time' : 'Recurring'}
                  </button>
                ))}
              </div>
            </div>

            {form.type === 'recurring' && (
              <div className="space-y-1">
                <div className="text-sm opacity-80">Interval</div>
                <div className="flex gap-2">
                  {['month', 'year'].map((i) => (
                    <button
                      key={i}
                      className={`px-3 py-1.5 text-sm rounded capitalize ${form.interval === i ? 'bg-white/15 font-medium' : 'bg-white/5 hover:bg-white/10'}`}
                      onClick={() => setForm({ ...form, interval: i })}
                    >
                      {i}ly
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-sm">
                Cancel
              </button>
              <button onClick={createProduct} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

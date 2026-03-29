import Stripe from 'stripe';
import { env } from '../lib/env.js';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

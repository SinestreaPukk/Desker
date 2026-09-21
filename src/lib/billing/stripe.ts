/**
 * Stripe, behind one small surface. Plans map to Stripe Prices through
 * environment variables; the subscription's state is mirrored onto the
 * Organization by the webhook and read from there - a request never asks
 * Stripe what plan someone is on.
 */
import "server-only";
import Stripe from "stripe";
import type { PlanId } from "./plans";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  client ??= new Stripe(key);
  return client;
}

/** The Stripe Price id for a paid plan, or null if not configured. */
export function priceIdFor(plan: PlanId): string | null {
  const id =
    plan === "starter"
      ? process.env.STRIPE_PRICE_STARTER
      : plan === "growth"
        ? process.env.STRIPE_PRICE_GROWTH
        : null;
  return id?.trim() || null;
}

/** Reverse lookup, for the webhook: which plan does this price belong to? */
export function planForPrice(priceId: string): PlanId | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER?.trim()) return "starter";
  if (priceId === process.env.STRIPE_PRICE_GROWTH?.trim()) return "growth";
  return null;
}

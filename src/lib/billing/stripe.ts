/**
 * Stripe, behind one small surface. Plans map to Stripe Prices through
 * environment variables; the subscription's state is mirrored onto the
 * Organization by the webhook and read from there - a request never asks
 * Stripe what plan someone is on.
 */
import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
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

/** Bump when the settings below change, so a new portal setup replaces the old one. */
const PORTAL_VERSION = "2026-09-27";

let portalConfigurationId: string | null = null;

/**
 * The customer portal Desker opens, set up by Desker rather than left to the
 * Stripe dashboard: cancelling online must always be possible (the Terms
 * promise it, and auto-renewal law requires it), so it is switched on here.
 * Cancellation takes effect at the end of the paid month, as the Terms say.
 * Found by its metadata on later calls, created once otherwise.
 */
export async function portalConfiguration(
  client: Pick<Stripe, "billingPortal"> = stripe(),
  appUrl: string = env.appUrl,
): Promise<string> {
  if (portalConfigurationId) return portalConfigurationId;
  const existing = await client.billingPortal.configurations.list({ active: true, limit: 100 });
  const found = existing.data.find((config) => config.metadata?.desker === PORTAL_VERSION);
  if (found) return (portalConfigurationId = found.id);

  const created = await client.billingPortal.configurations.create({
    business_profile: {
      headline: "Manage or cancel your Desker plan",
      ...(appUrl ? { privacy_policy_url: `${appUrl}/privacy`, terms_of_service_url: `${appUrl}/terms` } : {}),
    },
    features: {
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
        },
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
    },
    metadata: { desker: PORTAL_VERSION },
  });
  return (portalConfigurationId = created.id);
}

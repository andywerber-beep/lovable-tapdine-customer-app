/**
 * Stripe Checkout for TapDine offers.
 *
 * Uses the Stripe REST API over fetch (worker-safe, no Node-only SDK).
 * Payments are destination charges: the restaurant's connected Stripe account
 * receives the money and TapDine keeps its commission as the application fee.
 * Apple Pay, Google Pay, Link and cards are all offered by Stripe Checkout.
 */

import { createClient } from "@supabase/supabase-js";

const STRIPE_API = "https://api.stripe.com/v1";
const DEFAULT_COMMISSION_RATE = 0.1;

export interface PartnerPayoutAccount {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  commissionRate: number;
}

function supabase() {
  const rawUrl = process.env["TAPDINE_SUPABASE_URL"];
  const key = process.env["TAPDINE_SUPABASE_PUBLISHABLE_KEY"];
  if (!rawUrl || !key) throw new Error("TapDine database credentials are not configured.");
  const url = rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Reads the partner's Stripe Connect details; tolerates the columns not existing yet. */
export async function fetchPartnerPayoutAccount(
  venueId: string,
): Promise<PartnerPayoutAccount | null> {
  try {
    const { data, error } = await supabase()
      .from("partners")
      .select("stripe_account_id,stripe_charges_enabled,commission_rate")
      .eq("id", venueId)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const row = data[0] as Record<string, unknown>;
    const rate = Number(row["commission_rate"]);
    return {
      stripeAccountId: typeof row["stripe_account_id"] === "string" ? row["stripe_account_id"] : null,
      chargesEnabled: row["stripe_charges_enabled"] === true,
      commissionRate: Number.isFinite(rate) && rate > 0 ? (rate > 1 ? rate / 100 : rate) : DEFAULT_COMMISSION_RATE,
    };
  } catch {
    return null;
  }
}

function form(params: Record<string, string | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) body.set(key, value);
  }
  return body;
}

export interface CheckoutRequest {
  venueId: string;
  venueName: string;
  offerId: string;
  offerTitle: string;
  offerImage: string | null;
  amountPence: number;
  successUrl: string;
  cancelUrl: string;
}

/** Creates a Stripe Checkout Session and returns its hosted payment URL. */
export async function createCheckoutSession(request: CheckoutRequest): Promise<string> {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) throw new Error("Stripe is not connected yet.");

  const partner = await fetchPartnerPayoutAccount(request.venueId);
  const params: Record<string, string | undefined> = {
    mode: "payment",
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(request.amountPence),
    "line_items[0][price_data][product_data][name]": request.offerTitle,
    "line_items[0][price_data][product_data][description]": `TapDine offer at ${request.venueName}`,
    "metadata[venue_id]": request.venueId,
    "metadata[offer_id]": request.offerId,
  };

  if (request.offerImage && /^https?:\/\//.test(request.offerImage)) {
    params["line_items[0][price_data][product_data][images][0]"] = request.offerImage;
  }

  // Split the payment when the restaurant has finished Stripe onboarding.
  if (partner?.stripeAccountId && partner.chargesEnabled) {
    const fee = Math.max(1, Math.round(request.amountPence * partner.commissionRate));
    params["payment_intent_data[application_fee_amount]"] = String(fee);
    params["payment_intent_data[transfer_data][destination]"] = partner.stripeAccountId;
  }

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(params),
  });

  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message ?? "Stripe could not start this payment.");
  }
  return payload.url;
}

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
  claimCode: string;
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
    "metadata[offer_title]": request.offerTitle.slice(0, 450),
    "metadata[claim_code]": request.claimCode,
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

/* ---------------- Transaction logging (no personal data) ---------------- */

function adminDb() {
  const rawUrl = process.env["TAPDINE_SUPABASE_URL"];
  const key = process.env["TAPDINE_SUPABASE_SERVICE_ROLE_KEY"];
  if (!rawUrl || !key) return null;
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

interface StripeSession {
  id: string;
  payment_status?: string;
  amount_total?: number | null;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
}

/** Verifies a Checkout Session with Stripe and logs the paid claim once. */
export async function recordPaidClaim(sessionId: string, code: string): Promise<boolean> {
  const secret = process.env["STRIPE_SECRET_KEY"];
  const db = adminDb();
  if (!secret || !db) return false;

  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return false;
  const session = (await res.json()) as StripeSession;
  const meta = session.metadata ?? {};
  if (session.payment_status !== "paid" || meta["claim_code"] !== code) return false;

  const amountPence = session.amount_total ?? 0;
  const partner = await fetchPartnerPayoutAccount(meta["venue_id"] ?? "");
  const rate = partner?.commissionRate ?? DEFAULT_COMMISSION_RATE;

  // The live table's partner_id column is a UUID type; venue IDs are numeric,
  // so claims are keyed by venue_id (bigint) instead.
  const venueId = Number(meta["venue_id"]);
  const { error } = await db.from("transactions").upsert(
    {
      venue_id: Number.isFinite(venueId) ? venueId : null,
      offer_id: meta["offer_id"],
      offer_title: meta["offer_title"] ?? null,
      claim_code: code,
      amount: amountPence / 100,
      total_amount: amountPence / 100,
      commission_amount: Math.round(amountPence * rate) / 100,
      partner_payout: (amountPence - Math.round(amountPence * rate)) / 100,
      stripe_charge_id: session.payment_intent ?? null,
      currency: "gbp",
      status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent ?? null,
      paid_at: new Date().toISOString(),
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (error) console.error("TapDine transaction log failed:", error.message);
  return !error;
}

/** Seconds after payment during which a customer may cancel for a full refund. */
export const CANCEL_WINDOW_SECONDS = 120;

/** Refunds a paid claim if still inside the 2-minute window (checked against Stripe's own payment time). */
export async function refundPaidClaim(
  sessionId: string,
  code: string,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) return { ok: false, reason: "Card payments are not switched on." };
  const auth = { Authorization: `Bearer ${secret}` };

  const res = await fetch(
    `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`,
    { headers: auth },
  );
  if (!res.ok) return { ok: false, reason: "Payment not found." };
  const session = (await res.json()) as {
    payment_status?: string;
    metadata?: Record<string, string>;
    payment_intent?: { id: string; created: number; transfer_data?: unknown } | null;
  };
  if (session.metadata?.["claim_code"] !== code || session.payment_status !== "paid" || !session.payment_intent) {
    return { ok: false, reason: "This pass can't be cancelled." };
  }
  const pi = session.payment_intent;
  // Small grace for network delay.
  if (Date.now() / 1000 - pi.created > CANCEL_WINDOW_SECONDS + 15) {
    return { ok: false, reason: "The 2-minute cancellation window has closed." };
  }

  const params: Record<string, string> = { payment_intent: pi.id };
  if (pi.transfer_data) {
    params["reverse_transfer"] = "true";
    params["refund_application_fee"] = "true";
  }
  const refund = await fetch(`${STRIPE_API}/refunds`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: form(params),
  });
  if (!refund.ok) {
    const payload = (await refund.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, reason: payload.error?.message ?? "Refund could not be processed." };
  }

  const db = adminDb();
  if (db) {
    const { error } = await db
      .from("transactions")
      .update({ status: "refunded" })
      .eq("stripe_session_id", sessionId);
    if (error) console.error("TapDine refund log failed:", error.message);
  }
  return { ok: true };
}

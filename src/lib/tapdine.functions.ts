import { createServerFn } from "@tanstack/react-start";

import { DEMO_VENUES, getDemoVenue } from "./demo-venues";
import { activeOffers, type Venue } from "./tapdine-types";

export const getMapConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { mapsApiKey: process.env["GOOGLE_MAPS_API_KEY"] ?? "" };
});

export const listVenues = createServerFn({ method: "GET" }).handler(async (): Promise<Venue[]> => {
  try {
    const { fetchVenues } = await import("./tapdine.server");
    const venues = await fetchVenues();
    return venues.some((venue) => activeOffers(venue).length > 0) ? venues : DEMO_VENUES;
  } catch (error) {
    console.warn("TapDine live venues unavailable; showing removable demo fixtures.", error);
    return DEMO_VENUES;
  }
});

export const getVenue = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data }): Promise<Venue | null> => {
    const demoVenue = getDemoVenue(data.id);
    if (demoVenue) return demoVenue;
    const { fetchVenue } = await import("./tapdine.server");
    return fetchVenue(data.id);
  });

export type CheckoutStart =
  | { mode: "stripe"; url: string }
  | { mode: "demo"; reason: string };

/**
 * Starts payment for one offer. Falls back to a test claim (no card charged)
 * for demo venues or while Stripe is not connected yet.
 */
export const startOfferCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: { venueId: string; offerId: string; code: string; origin: string }) => ({
    venueId: String(input.venueId),
    offerId: String(input.offerId),
    code: String(input.code),
    origin: String(input.origin),
  }))
  .handler(async ({ data }): Promise<CheckoutStart> => {
    const demoVenue = getDemoVenue(data.venueId);
    if (demoVenue) return { mode: "demo", reason: "This is a demo venue, so no card is charged." };

    if (!process.env["STRIPE_SECRET_KEY"]) {
      return { mode: "demo", reason: "Card payments are not switched on yet." };
    }

    const { fetchVenue } = await import("./tapdine.server");
    const venue = await fetchVenue(data.venueId);
    const offer = venue?.offers.find((item) => String(item.id) === data.offerId);
    if (!venue || !offer) throw new Error("This offer is no longer available.");

    const price = Number(offer.discount_price);
    if (!Number.isFinite(price) || price <= 0) {
      return { mode: "demo", reason: "This offer has no price set, so nothing is charged." };
    }

    const { createCheckoutSession } = await import("./checkout.server");
    const url = await createCheckoutSession({
      venueId: venue.id,
      venueName: venue.name,
      offerId: String(offer.id),
      offerTitle: offer.title,
      offerImage: offer.image_url,
      amountPence: Math.round(price * 100),
      claimCode: data.code,
      successUrl: `${data.origin}/venue/${venue.id}?pass=${encodeURIComponent(data.code)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${data.origin}/venue/${venue.id}`,
    });
    return { mode: "stripe", url };
  });

/** Called when the customer returns from Stripe: verifies payment and logs the claim. */
export const confirmPaidClaim = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; code: string }) => ({
    sessionId: String(input.sessionId).slice(0, 200),
    code: String(input.code).slice(0, 40),
  }))
  .handler(async ({ data }) => {
    if (!data.sessionId.startsWith("cs_")) return { logged: false };
    const { recordPaidClaim } = await import("./checkout.server");
    return { logged: await recordPaidClaim(data.sessionId, data.code) };
  });

/** Cancels a paid claim within 2 minutes of payment and refunds it in full. */
export const cancelPaidClaim = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; code: string }) => ({
    sessionId: String(input.sessionId).slice(0, 200),
    code: String(input.code).slice(0, 40),
  }))
  .handler(async ({ data }) => {
    if (!data.sessionId.startsWith("cs_")) return { ok: false, reason: "Invalid payment." };
    const { refundPaidClaim } = await import("./checkout.server");
    return refundPaidClaim(data.sessionId, data.code);
  });

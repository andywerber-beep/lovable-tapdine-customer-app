export interface Offer {
  id: string | number;
  title: string;
  description: string | null;
  discount_type: string | null;
  discount_price: number | null;
  image_url: string | null;
  is_active: boolean | null;
  proximity_ping: boolean | null;
  expires_at: string | null;
  created_at: string | null;
}

export interface Venue {
  id: string;
  name: string;
  cuisine_type: string | null;
  status: string | null;
  town: string | null;
  postcode: string | null;
  address1: string | null;
  address2: string | null;
  tel_number: string | null;
  website_url: string | null;
  proximity_ping_enabled: boolean | null;
  latitude: number | null;
  longitude: number | null;
  /** Raw FSA value: "0".."5" (FHRS) or "Pass"/"Improvement Required" (FHIS, Scotland). */
  fsa_rating: string | null;
  fsa_rating_date: string | null;
  offers: Offer[];
}

export interface HygieneRating {
  /** Numeric 0-5 rating, or null on the Scottish pass/fail scheme. */
  score: number | null;
  /** Short display label, e.g. "5" or "Pass". */
  label: string;
  /** Meets TapDine's minimum standard (>= 3, or "Pass"). */
  passes: boolean;
  /** Plain-English meaning of the score. */
  meaning: string;
  inspectedOn: string | null;
}

const FHRS_MEANING: Record<number, string> = {
  0: "Urgent improvement necessary",
  1: "Major improvement necessary",
  2: "Improvement necessary",
  3: "Generally satisfactory",
  4: "Good",
  5: "Very good",
};

/** Interprets the stored FSA value against TapDine's minimum standard. */
export function hygieneRating(venue: Venue): HygieneRating | null {
  const raw = venue.fsa_rating?.trim();
  if (!raw) return null;

  const inspectedOn = venue.fsa_rating_date ?? null;

  if (/^[0-5]$/.test(raw)) {
    const score = Number(raw);
    return {
      score,
      label: raw,
      passes: score >= 3,
      meaning: FHRS_MEANING[score] ?? "",
      inspectedOn,
    };
  }

  if (raw.toLowerCase() === "pass") {
    return { score: null, label: "Pass", passes: true, meaning: "Meets hygiene standards", inspectedOn };
  }

  return { score: null, label: raw, passes: false, meaning: raw, inspectedOn };
}


/** Offers that are switched on and not past their expiry. */
export function activeOffers(venue: Venue): Offer[] {
  const now = Date.now();
  return venue.offers.filter((offer) => {
    if (offer.is_active !== true) return false;
    if (!offer.expires_at) return true;
    const expiry = Date.parse(offer.expires_at);
    return Number.isNaN(expiry) || expiry > now;
  });
}

export function venueAddress(venue: Venue): string {
  return [venue.address1, venue.address2, venue.town, venue.postcode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function formatPrice(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

/** Haversine-lite distance in km (equirectangular approximation). */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const ky = 40000 / 360;
  const kx = Math.cos((Math.PI * a.latitude) / 180) * ky;
  const dx = Math.abs(b.longitude - a.longitude) * kx;
  const dy = Math.abs(b.latitude - a.latitude) * ky;
  return Math.sqrt(dx * dx + dy * dy);
}

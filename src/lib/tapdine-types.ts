export interface Offer {
  id: number;
  title: string;
  description: string | null;
  discount_price: number | null;
  image_url: string | null;
  proximity_ping: boolean | null;
  is_active: boolean | null;
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
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
  offers: Offer[];
}

export function activeOffers(venue: Venue): Offer[] {
  return venue.offers.filter((offer) => offer.is_active !== false);
}

export function bestPrice(venue: Venue): number | null {
  const prices = activeOffers(venue)
    .map((o) => o.discount_price)
    .filter((p): p is number => typeof p === "number");
  return prices.length ? Math.min(...prices) : null;
}

export function formatPrice(pence: number): string {
  return `£${pence.toFixed(2)}`;
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

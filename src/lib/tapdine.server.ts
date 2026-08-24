import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Offer, Venue } from "./tapdine-types";
import { venueAddress } from "./tapdine-types";

const VENUE_COLUMNS = `
  id,
  name,
  cuisine_type,
  status,
  town,
  postcode,
  address1,
  address2,
  tel_number,
  website_url,
  proximity_ping_enabled,
  latitude,
  longitude
`;

const OFFER_COLUMNS = `
  id,
  title,
  description,
  discount_type,
  discount_price,
  image_url,
  is_active,
  proximity_ping,
  expires_at,
  created_at,
  venue_id
`;

function client(): SupabaseClient {
  const rawUrl = process.env["TAPDINE_SUPABASE_URL"];
  const key = process.env["TAPDINE_SUPABASE_PUBLISHABLE_KEY"];
  if (!rawUrl || !key) {
    throw new Error("TapDine database credentials are not configured.");
  }

  // Accept values pasted with a trailing /rest/v1 path.
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

type VenueRow = Omit<Venue, "offers">;
type OfferRow = Offer & { venue_id: string };

/** Address -> coordinates fallback for partners with no stored lat/lng. */
const geocodeCache = new Map<string, { latitude: number; longitude: number } | null>();

async function geocode(address: string) {
  if (!address) return null;
  if (geocodeCache.has(address)) return geocodeCache.get(address) ?? null;

  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("region", "uk");
    url.searchParams.set("key", key);

    const res = await fetch(url);
    const json = (await res.json()) as {
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    const loc = json.results?.[0]?.geometry?.location;
    const coords = loc ? { latitude: loc.lat, longitude: loc.lng } : null;
    geocodeCache.set(address, coords);
    return coords;
  } catch {
    geocodeCache.set(address, null);
    return null;
  }
}

async function withCoords(row: VenueRow, offers: Offer[]): Promise<Venue> {
  const base: Venue = { ...row, offers };
  if (base.latitude != null && base.longitude != null) return base;
  const coords = await geocode(venueAddress(base));
  return coords ? { ...base, ...coords } : base;
}

function splitOffers(rows: OfferRow[]) {
  const byVenue = new Map<string, Offer[]>();
  for (const row of rows) {
    const { venue_id, ...offer } = row;
    const list = byVenue.get(venue_id) ?? [];
    list.push(offer);
    byVenue.set(venue_id, list);
  }
  return byVenue;
}

export async function fetchVenues(): Promise<Venue[]> {
  const supabase = client();

  const [{ data: venueRows, error }, { data: offerRows, error: offerError }] = await Promise.all([
    supabase
      .from("partners")
      .select(VENUE_COLUMNS)
      .in("status", ["active", "Active", "ACTIVE"])
      .order("name"),
    supabase.from("offers").select(OFFER_COLUMNS),
  ]);

  if (error) throw new Error(error.message);
  if (offerError) throw new Error(offerError.message);

  const byVenue = splitOffers((offerRows ?? []) as unknown as OfferRow[]);

  return Promise.all(
    ((venueRows ?? []) as unknown as VenueRow[]).map((row) =>
      withCoords(row, byVenue.get(row.id) ?? []),
    ),
  );
}

export async function fetchVenue(id: string): Promise<Venue | null> {
  const supabase = client();

  const { data, error } = await supabase
    .from("partners")
    .select(VENUE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: offerRows, error: offerError } = await supabase
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("venue_id", id)
    .order("created_at", { ascending: false });

  if (offerError) throw new Error(offerError.message);

  const offers = ((offerRows ?? []) as unknown as OfferRow[]).map(
    ({ venue_id: _v, ...rest }) => rest,
  );
  return withCoords(data as unknown as VenueRow, offers);
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Offer, Venue } from "./tapdine-types";

const VENUE_COLUMNS = `
  id,
  name,
  cuisine_type,
  status,
  town,
  postcode,
  address1,
  website_url,
  latitude,
  longitude
`;

const OFFER_COLUMNS = `
  id,
  title,
  description,
  discount_price,
  image_url,
  proximity_ping,
  is_active,
  created_at
`;

function client(): SupabaseClient {
  const url = process.env["TAPDINE_SUPABASE_URL"];
  const key = process.env["TAPDINE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("TapDine database credentials are not configured.");
  }

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

function normalizeOffers(raw: unknown): Offer[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean) as Offer[];
}

function normalizeVenue(row: Record<string, unknown>): Venue {
  const { offers, ...rest } = row as unknown as Venue & { offers?: unknown };
  return { ...(rest as Omit<Venue, "offers">), offers: normalizeOffers(offers) };
}

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await client()
    .from("partners")
    .select(`${VENUE_COLUMNS}, offers (${OFFER_COLUMNS})`)
    .in("status", ["active", "Active", "ACTIVE"]);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeVenue(row as Record<string, unknown>));
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
    .eq("venue_id", id);

  if (offerError) throw new Error(offerError.message);

  return normalizeVenue({ ...(data as Record<string, unknown>), offers: offerRows });
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Offer, Venue } from "./tapdine-types";
import { venueAddress } from "./tapdine-types";

const INITIAL_VENUE_COLUMNS = [
  "id",
  "name",
  "cuisine_type",
  "status",
  "town",
  "postcode",
  "address1",
  "address2",
  "tel_number",
  "website_url",
  "proximity_ping_enabled",
  "latitude",
  "longitude",
  "coords",
  "fsa_rating",
  "fsa_rating_date",
];

const INITIAL_OFFER_COLUMNS = [
  "id",
  "title",
  "description",
  "discount_type",
  "discount_price",
  "image_url",
  "is_active",
  "proximity_ping",
  "expires_at",
  "created_at",
  "venue_id",
];

const REQUIRED_VENUE_COLUMNS = new Set(["id", "name", "status"]);
const REQUIRED_OFFER_COLUMNS = new Set(["id", "title", "venue_id"]);

let venueColumnCache = [...INITIAL_VENUE_COLUMNS];
let offerColumnCache = [...INITIAL_OFFER_COLUMNS];

type DbError = { code?: string; message?: string; details?: string; hint?: string } | null;
type DbResult = { data: unknown[] | null; error: DbError };

function errorText(error: DbError) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
}

/** Postgres/PostgREST error for an unknown column, so optional fields can be retried safely. */
function isMissingColumn(error: DbError) {
  const text = errorText(error);
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /column .* does not exist/i.test(text) ||
    /could not find .* column .* schema cache/i.test(text)
  );
}

function missingColumn(error: DbError, columns: string[]) {
  const text = errorText(error).toLowerCase();
  return columns.find((column) => text.includes(column.toLowerCase())) ?? null;
}

async function selectWithColumnFallback(
  cachedColumns: string[],
  requiredColumns: Set<string>,
  setCache: (columns: string[]) => void,
  run: (columns: string) => Promise<DbResult>,
) {
  let columns = [...cachedColumns];

  while (columns.length > 0) {
    const result = await run(columns.join(","));
    if (!isMissingColumn(result.error)) return result;

    const column = missingColumn(result.error, columns);
    if (!column || requiredColumns.has(column)) return result;

    columns = columns.filter((item) => item !== column);
    setCache(columns);
  }

  return run(cachedColumns.join(","));
}

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

type Row = Record<string, unknown>;

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

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}

function parseEwkbPoint(hex: string) {
  const clean = hex.replace(/^\\x/i, "");
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length < 42) return null;

  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = view.getUint8(0) === 1;
  const type = view.getUint32(1, littleEndian);
  const hasSrid = Boolean(type & 0x20000000);
  const pointType = type & 0xff;
  if (pointType !== 1) return null;

  const offset = hasSrid ? 9 : 5;
  if (bytes.length < offset + 16) return null;

  const longitude = view.getFloat64(offset, littleEndian);
  const latitude = view.getFloat64(offset + 8, littleEndian);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function parseCoords(value: unknown) {
  if (!value) return null;

  if (typeof value === "object") {
    const object = value as { coordinates?: unknown; lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
    if (Array.isArray(object.coordinates) && object.coordinates.length >= 2) {
      const longitude = nullableNumber(object.coordinates[0]);
      const latitude = nullableNumber(object.coordinates[1]);
      if (latitude != null && longitude != null) return { latitude, longitude };
    }

    const latitude = nullableNumber(object.latitude ?? object.lat);
    const longitude = nullableNumber(object.longitude ?? object.lng);
    if (latitude != null && longitude != null) return { latitude, longitude };
  }

  if (typeof value === "string") {
    const point = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(value);
    if (point) {
      const longitude = nullableNumber(point[1]);
      const latitude = nullableNumber(point[2]);
      if (latitude != null && longitude != null) return { latitude, longitude };
    }
    return parseEwkbPoint(value);
  }

  return null;
}

function normalizeOffer(row: Row): Offer {
  return {
    id: nullableString(row["id"]) ?? "offer",
    title: nullableString(row["title"]) ?? "Offer",
    description: nullableString(row["description"]),
    discount_type: nullableString(row["discount_type"]),
    discount_price: nullableNumber(row["discount_price"]),
    image_url: nullableString(row["image_url"]),
    is_active: nullableBoolean(row["is_active"]),
    proximity_ping: nullableBoolean(row["proximity_ping"]),
    expires_at: nullableString(row["expires_at"]),
    created_at: nullableString(row["created_at"]),
  };
}

function normalizeVenue(row: Row, offers: Offer[]): Venue {
  const parsedCoords = parseCoords(row["coords"]);
  return {
    id: String(row["id"]),
    name: nullableString(row["name"]) ?? "TapDine partner",
    cuisine_type: nullableString(row["cuisine_type"]),
    status: nullableString(row["status"]),
    town: nullableString(row["town"]),
    postcode: nullableString(row["postcode"]),
    address1: nullableString(row["address1"]),
    address2: nullableString(row["address2"]),
    tel_number: nullableString(row["tel_number"]),
    website_url: nullableString(row["website_url"]),
    proximity_ping_enabled: nullableBoolean(row["proximity_ping_enabled"]),
    latitude: nullableNumber(row["latitude"]) ?? parsedCoords?.latitude ?? null,
    longitude: nullableNumber(row["longitude"]) ?? parsedCoords?.longitude ?? null,
    fsa_rating: nullableString(row["fsa_rating"]),
    fsa_rating_date: nullableString(row["fsa_rating_date"]),
    offers,
  };
}

async function withCoords(venue: Venue): Promise<Venue> {
  const base = venue;
  if (base.latitude != null && base.longitude != null) return base;
  const coords = await geocode(venueAddress(base));
  return coords ? { ...base, ...coords } : base;
}

function splitOffers(rows: Row[]) {
  const byVenue = new Map<string, Offer[]>();
  for (const row of rows) {
    const venueId = nullableString(row["venue_id"]);
    if (!venueId) continue;
    const list = byVenue.get(venueId) ?? [];
    list.push(normalizeOffer(row));
    byVenue.set(venueId, list);
  }
  return byVenue;
}

function selectVenues(supabase: SupabaseClient) {
  return selectWithColumnFallback(
    venueColumnCache,
    REQUIRED_VENUE_COLUMNS,
    (columns) => {
      venueColumnCache = columns;
    },
    (columns) =>
      supabase
        .from("partners")
        .select(columns)
        .in("status", ["active", "Active", "ACTIVE"])
        .order("name") as unknown as Promise<DbResult>,
  );
}

function selectOffers(supabase: SupabaseClient, venueId?: string) {
  return selectWithColumnFallback(
    offerColumnCache,
    REQUIRED_OFFER_COLUMNS,
    (columns) => {
      offerColumnCache = columns;
    },
    (columns) => {
      let query = supabase.from("offers").select(columns);
      if (venueId) query = query.eq("venue_id", venueId);
      return query as unknown as Promise<DbResult>;
    },
  );
}

export async function fetchVenues(): Promise<Venue[]> {
  const supabase = client();

  const [{ data: venueRows, error }, { data: offerRows, error: offerError }] = await Promise.all([
    selectVenues(supabase),
    selectOffers(supabase),
  ]);

  if (error) throw new Error(error.message);
  if (offerError) console.warn(`TapDine offers unavailable: ${offerError.message}`);

  const byVenue = splitOffers((offerRows ?? []) as Row[]);

  return Promise.all(
    ((venueRows ?? []) as Row[]).map((row) =>
      withCoords(normalizeVenue(row, byVenue.get(String(row["id"])) ?? [])),
    ),
  );
}

export async function fetchVenue(id: string): Promise<Venue | null> {
  const supabase = client();

  const { data, error } = await selectWithColumnFallback(
    venueColumnCache,
    REQUIRED_VENUE_COLUMNS,
    (columns) => {
      venueColumnCache = columns;
    },
    (columns) =>
      supabase.from("partners").select(columns).eq("id", id).limit(1) as unknown as Promise<DbResult>,
  );

  if (error) throw new Error(error.message);
  const row = data?.[0] as Row | undefined;
  if (!row) return null;


  const { data: offerRows, error: offerError } = await selectOffers(supabase, id);

  if (offerError) console.warn(`TapDine offers unavailable for venue ${id}: ${offerError.message}`);

  const offers = ((offerRows ?? []) as Row[])
    .map(normalizeOffer)
    .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
  return withCoords(normalizeVenue(row, offers));
}

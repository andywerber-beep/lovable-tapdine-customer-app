import { createServerFn } from "@tanstack/react-start";

import type { Venue } from "./tapdine-types";

export const getMapConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { mapsApiKey: process.env["GOOGLE_MAPS_API_KEY"] ?? "" };
});

export const listVenues = createServerFn({ method: "GET" }).handler(async (): Promise<Venue[]> => {
  const { fetchVenues } = await import("./tapdine.server");
  return fetchVenues();
});

export const getVenue = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data }): Promise<Venue | null> => {
    const { fetchVenue } = await import("./tapdine.server");
    return fetchVenue(data.id);
  });

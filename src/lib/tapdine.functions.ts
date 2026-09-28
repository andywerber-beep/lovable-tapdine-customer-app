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

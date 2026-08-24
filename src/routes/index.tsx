import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Compass, Loader2, MapPinned, Search } from "lucide-react";
import { Suspense, lazy, useMemo, useState } from "react";

import { ProximityBanner } from "@/components/tapdine/ProximityBanner";
import { VenueSheet } from "@/components/tapdine/VenueSheet";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getMapConfig, listVenues } from "@/lib/tapdine.functions";
import { activeOffers, type Venue } from "@/lib/tapdine-types";

const MapRadar = lazy(() => import("@/components/tapdine/MapRadar"));

const radarQuery = queryOptions({
  queryKey: ["tapdine", "radar"],
  queryFn: async () => {
    const [venues, config] = await Promise.all([listVenues(), getMapConfig()]);
    return { venues, mapsApiKey: config.mapsApiKey };
  },
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(radarQuery),
  head: () => ({
    meta: [
      { title: "TapDine — Live Restaurant Offers On Your Doorstep" },
      {
        name: "description",
        content:
          "TapDine is a live radar of nearby restaurants and bars with flash offers. Walk past, get pinged, tap to unlock the deal.",
      },
      { property: "og:title", content: "TapDine — Live Restaurant Offers On Your Doorstep" },
      {
        property: "og:description",
        content:
          "A live map of local venues running flash offers right now. Proximity pings unlock exclusive deals as you walk.",
      },
    ],
  }),
  component: RadarPage,
  errorComponent: RadarError,
});

function RadarError({ error }: { error: Error }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-ember">Radar offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </main>
  );
}

function MapSkeleton({ label }: { label: string }) {
  return (
    <div className="grid size-full place-items-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-ember" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</span>
      </div>
    </div>
  );
}

function RadarPage() {
  const { data } = useSuspenseQuery(radarQuery);
  const [query, setQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const { userLocation, denied, proximityVenue, clearProximityAlert } = useGeolocation(data.venues);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.venues;
    return data.venues.filter((venue) =>
      [venue.name, venue.cuisine_type, venue.town].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [data.venues, query]);

  const liveCount = data.venues.filter((venue) => activeOffers(venue).length > 0).length;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        {data.mapsApiKey ? (
          <ClientOnly fallback={<MapSkeleton label="Warming up the radar" />}>
            <Suspense fallback={<MapSkeleton label="Warming up the radar" />}>
              <MapRadar
                apiKey={data.mapsApiKey}
                venues={filtered}
                userLocation={userLocation}
                selectedVenue={selectedVenue}
                onSelect={setSelectedVenue}
              />
            </Suspense>
          </ClientOnly>
        ) : (
          <MapSkeleton label="Map key missing" />
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ backgroundImage: "var(--gradient-veil)", transform: "rotate(180deg)" }}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {proximityVenue ? (
          <ProximityBanner
            venue={proximityVenue}
            onClose={clearProximityAlert}
            onOpen={(venue) => {
              setSelectedVenue(venue);
              clearProximityAlert();
            }}
          />
        ) : (
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-3 backdrop-blur-xl">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search venues, cuisine, town"
                aria-label="Search venues"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface/90 backdrop-blur-xl">
              <Compass className="size-5 text-ember" />
            </span>
          </div>
        )}
      </header>

      {!selectedVenue && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4 rounded-3xl border border-border bg-surface/90 px-5 py-4 backdrop-blur-xl">
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold">
                <span className="text-gradient-ember">{liveCount}</span> venues live now
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {denied
                  ? "Enable location to get proximity pings"
                  : userLocation
                    ? "Tap a marker to open its lookbook"
                    : "Finding you on the map…"}
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ember/15 text-ember">
              <MapPinned className="size-5" />
            </span>
          </div>
        </div>
      )}

      {selectedVenue && (
        <VenueSheet
          venue={selectedVenue}
          userLocation={userLocation}
          onClose={() => setSelectedVenue(null)}
        />
      )}
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Compass, Loader2, Search } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";

import { InstallButton } from "@/components/tapdine/InstallButton";
import { TapDineBrand } from "@/components/tapdine/TapDineBrand";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [fitTrigger, setFitTrigger] = useState(0);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { userLocation, denied } = useGeolocation(data.venues);

  const filtered = useMemo(() => {
    // Only venues with at least one live offer appear on the radar.
    const live = data.venues.filter((venue) => activeOffers(venue).length > 0);
    const q = query.trim().toLowerCase();
    if (!q) return live;
    return live.filter((venue) =>
      [venue.name, venue.cuisine_type, venue.town].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [data.venues, query]);

  const liveCount = filtered.length;
  const showingDemo = data.venues.some((venue) => venue.id.startsWith("demo-"));

  // Pan the map to fit search matches as the user types / submits.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (query.trim() && filtered.length > 0) {
      setFitTrigger((n) => n + 1);
    } else if (!query.trim()) {
      setRecenterTrigger((n) => n + 1);
    }
  }, [query, filtered.length]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (filtered.length > 0) setFitTrigger((n) => n + 1);
    searchInputRef.current?.blur();
  };

  const handleRecenter = () => {
    setQuery("");
    setRecenterTrigger((n) => n + 1);
    searchInputRef.current?.blur();
  };

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
                fitTrigger={fitTrigger}
                recenterTrigger={recenterTrigger}
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
        <div className="pointer-events-auto mx-auto max-w-xl space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface/95 px-4 py-2 shadow-sm backdrop-blur-xl">
              <TapDineBrand />
              {showingDemo && <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold text-gold-foreground">DEMO MAP</span>}
            </div>
            <form className="flex items-center gap-3" onSubmit={handleSearchSubmit}>
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-primary/20 bg-surface/95 px-4 py-3 shadow-sm backdrop-blur-xl">
                <Search className="size-4 shrink-0 text-primary" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search venues, cuisine, town"
                  aria-label="Search venues"
                  enterKeyHint="search"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="button"
                onClick={handleRecenter}
                aria-label="Re-center map on my location"
                title="Re-center on my location"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95"
              >
                <Compass className="size-5" />
              </button>
            </form>
        </div>
      </header>

      {!selectedVenue && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4 rounded-3xl border border-primary/15 bg-surface/95 px-5 py-4 shadow-lg backdrop-blur-xl">
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold">
                <span className="text-primary">{liveCount}</span> deals live now
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {denied
                  ? "Enable location to get proximity pings"
                  : userLocation
                    ? "Tap a golden marker to see the deal"
                    : "Finding you on the map…"}
              </p>
            </div>
            <InstallButton />
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

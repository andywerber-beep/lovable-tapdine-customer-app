import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

import { activeOffers, type Venue } from "@/lib/tapdine-types";
import type { Coords } from "@/hooks/useGeolocation";

const MAP_ID = "DEMO_MAP_ID";

const FALLBACK_CENTER = { lat: 51.5074, lng: -0.1278 };

interface MapRadarProps {
  apiKey: string;
  venues: Venue[];
  userLocation: Coords | null;
  selectedVenue: Venue | null;
  onSelect: (venue: Venue) => void;
}

function Recenter({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (map && center) map.panTo(center);
  }, [map, center]);

  return null;
}

export default function MapRadar({
  apiKey,
  venues,
  userLocation,
  selectedVenue,
  onSelect,
}: MapRadarProps) {
  const center = userLocation
    ? { lat: userLocation.latitude, lng: userLocation.longitude }
    : FALLBACK_CENTER;

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        className="size-full"
        defaultCenter={center}
        defaultZoom={15}
        mapId={MAP_ID}
        colorScheme="LIGHT"
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
      >
        <Recenter center={userLocation ? center : null} />

        {userLocation && (
          <AdvancedMarker position={center} title="You" zIndex={5}>
            <span className="relative grid place-items-center">
              <span className="absolute size-10 animate-ping rounded-full bg-gold/30" />
              <span className="size-4 rounded-full border-2 border-background bg-gold" />
            </span>
          </AdvancedMarker>
        )}

        {venues.map((venue) => {
          if (venue.latitude == null || venue.longitude == null) return null;
          const offers = activeOffers(venue);
          const live = offers.length > 0;
          const headline = offers[0]?.title ?? null;
          const isSelected = selectedVenue?.id === venue.id;

          return (
            <AdvancedMarker
              key={venue.id}
              position={{ lat: venue.latitude, lng: venue.longitude }}
              title={venue.name}
              zIndex={isSelected ? 4 : live ? 3 : 2}
              onClick={() => onSelect(venue)}
            >
              <button
                type="button"
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 backdrop-blur-md transition-transform duration-200 ${
                  isSelected ? "scale-110" : "hover:scale-105"
                } ${
                  live
                    ? "border-live/50 bg-surface/95"
                    : "border-border bg-surface/80 opacity-80"
                }`}
                style={isSelected ? { boxShadow: "var(--shadow-ember)" } : undefined}
              >
                <span
                  className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${
                    live ? "bg-live text-live-foreground" : "bg-ember text-ember-foreground"
                  }`}
                >
                  {live ? offers.length : "•"}
                </span>
                <span className="max-w-[9rem] truncate text-[11px] font-semibold text-foreground">
                  {venue.name}
                </span>
                {headline && (
                  <span className="max-w-[8rem] truncate text-[11px] font-semibold text-gold">
                    {headline}
                  </span>
                )}

              </button>
            </AdvancedMarker>
          );
        })}
      </Map>
    </APIProvider>
  );
}

import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";

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
  fitTrigger: number;
  recenterTrigger: number;
}

function Recenter({
  center,
  trigger,
}: {
  center: { lat: number; lng: number } | null;
  trigger: number;
}) {
  const map = useMap();
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (!map || !center) return;
    map.panTo(center);
    if (trigger !== lastTrigger.current) {
      lastTrigger.current = trigger;
      map.setZoom(15);
    }
  }, [map, center, trigger]);

  return null;
}

function FitToVenues({ venues, trigger }: { venues: Venue[]; trigger: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map || trigger === 0) return;
    const points = venues.filter((v) => v.latitude != null && v.longitude != null);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.panTo({ lat: points[0].latitude!, lng: points[0].longitude! });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((v) => bounds.extend({ lat: v.latitude!, lng: v.longitude! }));
    map.fitBounds(bounds, 80);
  }, [map, venues, trigger]);

  return null;
}

export default function MapRadar({
  apiKey,
  venues,
  userLocation,
  selectedVenue,
  onSelect,
  fitTrigger,
  recenterTrigger,
}: MapRadarProps) {
  const firstMappedVenue = venues.find((venue) => venue.latitude != null && venue.longitude != null);
  const center = userLocation
    ? { lat: userLocation.latitude, lng: userLocation.longitude }
    : firstMappedVenue?.latitude != null && firstMappedVenue.longitude != null
      ? { lat: firstMappedVenue.latitude, lng: firstMappedVenue.longitude }
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
        <Recenter center={userLocation ? center : null} trigger={recenterTrigger} />
        <FitToVenues venues={venues} trigger={fitTrigger} />

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
          const price = offers[0]?.discount_price;
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
                aria-label={`Open ${venue.name}`}
                className={`group flex min-h-11 items-center gap-2 rounded-full border-2 border-surface bg-gold py-1 pl-1 pr-3 text-gold-foreground transition-transform duration-200 ${isSelected ? "scale-110" : "hover:scale-105"}`}
                style={isSelected ? { boxShadow: "var(--shadow-ember)" } : undefined}
              >
                <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                  {live ? offers.length : "•"}
                </span>
                <span className="max-w-[9rem] truncate text-xs font-bold">
                  {venue.name}
                </span>
                {price != null && <span className="text-xs font-extrabold">£{price.toFixed(2)}</span>}
              </button>
            </AdvancedMarker>
          );
        })}
      </Map>
    </APIProvider>
  );
}

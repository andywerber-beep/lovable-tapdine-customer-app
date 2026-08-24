import { useCallback, useEffect, useState } from "react";

import { distanceKm, type Venue } from "@/lib/tapdine-types";

export interface Coords {
  latitude: number;
  longitude: number;
}

const PROXIMITY_RADIUS_KM = 0.5;

export function useGeolocation(venues: Venue[]) {
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);
  const [proximityVenue, setProximityVenue] = useState<Venue | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDenied(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(coords);
        setDenied(false);
      },
      () => setDenied(true),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!userLocation) return;

    const nearby = venues.find((venue) => {
      if (venue.latitude == null || venue.longitude == null) return false;
      if (dismissedIds.includes(venue.id)) return false;
      if (!venue.offers.some((offer) => offer.is_active !== false)) return false;
      return (
        distanceKm(userLocation, {
          latitude: venue.latitude,
          longitude: venue.longitude,
        }) <= PROXIMITY_RADIUS_KM
      );
    });

    setProximityVenue(nearby ?? null);
  }, [userLocation, venues, dismissedIds]);

  const clearProximityAlert = useCallback(() => {
    setProximityVenue((current) => {
      if (current) setDismissedIds((ids) => [...ids, current.id]);
      return null;
    });
  }, []);

  return { userLocation, denied, proximityVenue, clearProximityAlert };
}

import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Utensils, X } from "lucide-react";

import { HygieneBadge } from "@/components/tapdine/HygieneBadge";
import { activeOffers, distanceKm, venueAddress, type Venue } from "@/lib/tapdine-types";

import type { Coords } from "@/hooks/useGeolocation";

interface VenueSheetProps {
  venue: Venue;
  userLocation: Coords | null;
  onClose: () => void;
}

export function VenueSheet({ venue, userLocation, onClose }: VenueSheetProps) {
  const offers = activeOffers(venue);
  const away =
    userLocation && venue.latitude != null && venue.longitude != null
      ? distanceKm(userLocation, { latitude: venue.latitude, longitude: venue.longitude })
      : null;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 animate-in slide-in-from-bottom-8 duration-500">
      <div
        className="rounded-t-[2rem] border-t border-border bg-surface/95 backdrop-blur-xl"
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        <div className="flex justify-center pt-3">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="mx-auto max-w-xl">
          <div className="flex items-start gap-3 px-5 pt-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Utensils className="size-3" />
                <span className="truncate">{venue.cuisine_type ?? "Restaurant"}</span>
                {away != null && <span className="text-gold">· {away.toFixed(1)} km away</span>}
              </div>
              <h2 className="mt-1 truncate font-display text-2xl font-semibold">{venue.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                {venueAddress(venue) || "Address coming soon"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close venue"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 px-5">
            {offers.length > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-live/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-live">
                <span className="size-1.5 rounded-full bg-live" />
                {offers.length} live {offers.length === 1 ? "offer" : "offers"}
              </span>
            ) : (
              <span className="rounded-full bg-surface-raised px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                No live offers
              </span>
            )}
            <HygieneBadge venue={venue} />
          </div>


          <div className="mt-5 grid grid-cols-1 gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:grid-cols-2">
            <Link
              to="/venue/$id"
              params={{ id: venue.id }}
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundImage: "var(--gradient-ember)" }}
            >
              View lookbook
            </Link>
            {venue.tel_number ? (
              <a
                href={`tel:${venue.tel_number.replace(/\s+/g, "")}`}
                className="flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3.5 font-semibold text-foreground transition-colors hover:bg-surface-raised"
              >
                <Phone className="size-4" /> Call venue
              </a>
            ) : (
              <span className="flex items-center justify-center rounded-2xl border border-border px-4 py-3.5 font-semibold text-muted-foreground">
                No phone listed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

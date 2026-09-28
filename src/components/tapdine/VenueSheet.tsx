import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Sparkles, X } from "lucide-react";

import { HygieneBadge } from "@/components/tapdine/HygieneBadge";
import { activeOffers, distanceKm, formatPrice, type Venue } from "@/lib/tapdine-types";

import type { Coords } from "@/hooks/useGeolocation";

interface VenueSheetProps {
  venue: Venue;
  userLocation: Coords | null;
  onClose: () => void;
}

export function VenueSheet({ venue, userLocation, onClose }: VenueSheetProps) {
  const offers = activeOffers(venue);
  const offer = offers[0];
  const away =
    userLocation && venue.latitude != null && venue.longitude != null
      ? distanceKm(userLocation, { latitude: venue.latitude, longitude: venue.longitude })
      : null;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 animate-in slide-in-from-bottom-8 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] duration-500">
      <div
        className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-border bg-surface/95 backdrop-blur-xl"
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        {offer?.image_url && (
          <div className="relative h-36 overflow-hidden sm:h-44">
            <img src={offer.image_url} alt={offer.title} width={1200} height={720} className="size-full object-cover" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-gold-foreground shadow-sm">
              <Sparkles className="size-3.5" /> {offer.discount_type || "Live deal"}
            </span>
            <button type="button" onClick={onClose} aria-label="Close venue" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-surface/95 text-foreground shadow-sm">
              <X className="size-4" />
            </button>
          </div>
        )}

        <div>
          <div className="flex items-start gap-3 px-5 pt-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="truncate">{venue.cuisine_type ?? "Restaurant"}</span>
                {away != null && <span>· {away.toFixed(1)} km away</span>}
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{venue.name}</h2>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-muted-foreground">{offer?.title ?? "Live offer"}</p>
            </div>
            {formatPrice(offer?.discount_price ?? null) && <span className="shrink-0 font-display text-2xl font-extrabold text-primary">{formatPrice(offer?.discount_price ?? null)}</span>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 px-5">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5 text-primary" /> {venue.town ?? "Nearby"}</span>
            <HygieneBadge venue={venue} />
          </div>

          <div className="mt-4 px-5 pb-5">
            <Link
              to="/venue/$id"
              params={{ id: venue.id }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-transform hover:scale-[1.01]"
            >
              {offers.length > 0 ? "Claim offer" : "View details"} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

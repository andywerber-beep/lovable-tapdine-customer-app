import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, MapPin, Sparkles, Wallet, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ClaimPassCard } from "@/components/tapdine/ClaimPassCard";
import { HygieneBadge } from "@/components/tapdine/HygieneBadge";
import { makeClaimCode, savePass, type ClaimPass } from "@/lib/claim-pass";
import { startOfferCheckout } from "@/lib/tapdine.functions";
import { activeOffers, distanceKm, formatPrice, type Offer, type Venue } from "@/lib/tapdine-types";

import type { Coords } from "@/hooks/useGeolocation";

interface VenueSheetProps {
  venue: Venue;
  userLocation: Coords | null;
  onClose: () => void;
}

export function VenueSheet({ venue, userLocation, onClose }: VenueSheetProps) {
  const offers = activeOffers(venue);
  const [activeCard, setActiveCard] = useState(0);
  const [pendingOffer, setPendingOffer] = useState<string | null>(null);
  const [pass, setPass] = useState<ClaimPass | null>(null);
  const railRef = useRef<HTMLUListElement>(null);
  const goTo = (index: number) => {
    const el = railRef.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 20, behavior: "smooth" });
    setActiveCard(index);
  };
  const away =
    userLocation && venue.latitude != null && venue.longitude != null
      ? distanceKm(userLocation, { latitude: venue.latitude, longitude: venue.longitude })
      : null;

  const claimOffer = async (offer: Offer) => {
    setPendingOffer(String(offer.id));
    const code = makeClaimCode(venue.name);
    const draft: ClaimPass = {
      code,
      venueId: venue.id,
      venueName: venue.name,
      offerId: String(offer.id),
      offerTitle: offer.title,
      price: offer.discount_price,
      paidAt: Date.now(),
      demo: false,
    };
    try {
      const result = await startOfferCheckout({
        data: { venueId: venue.id, offerId: String(offer.id), code, origin: window.location.origin },
      });
      if (result.mode === "stripe") {
        savePass(draft);
        window.location.href = result.url;
        return;
      }
      const demoPass = { ...draft, demo: true, paidAt: Date.now() };
      savePass(demoPass);
      setPass(demoPass);
      toast.info(result.reason);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment could not be started.");
    } finally {
      setPendingOffer(null);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 animate-in slide-in-from-bottom-8 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] duration-500">
      <div
        className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-border bg-surface/95 backdrop-blur-xl"
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        <div className="flex items-start gap-3 px-5 pt-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="truncate">{venue.cuisine_type ?? "Restaurant"}</span>
              {away != null && <span>· {away.toFixed(1)} km away</span>}
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{venue.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 text-primary" /> {venue.town ?? "Nearby"}
              </span>
              <HygieneBadge venue={venue} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close venue"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {offers.length > 0 && (
          <div className="relative">
          <ul
            ref={railRef}
            onScroll={(event) => {
              const el = event.currentTarget;
              const first = el.firstElementChild as HTMLElement | null;
              const step = (first?.offsetWidth ?? el.clientWidth) + 12;
              setActiveCard(Math.min(Math.round(el.scrollLeft / step), offers.length - 1));
            }}
            className="mt-3 flex snap-x snap-mandatory gap-3 touch-pan-x overflow-x-auto overscroll-x-contain scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {offers.map((offer) => {
              const price = formatPrice(offer.discount_price);
              return (
                <li
                  key={offer.id}
                  className={`${offers.length > 1 ? "w-[82%]" : "w-full"} shrink-0 snap-center overflow-hidden rounded-2xl border border-primary/15 bg-surface`}
                >
                  {offer.image_url && (
                    <div className="relative">
                      <img
                        src={offer.image_url}
                        alt={offer.title}
                        width={1200}
                        height={720}
                        className="aspect-[16/8] w-full object-cover"
                      />
                      <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[11px] font-extrabold text-gold-foreground shadow-sm">
                        <Sparkles className="size-3" /> {offer.discount_type || "Live deal"}
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug">{offer.title}</h3>
                      {price && <span className="shrink-0 font-display text-lg font-extrabold text-primary">{price}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void claimOffer(offer)}
                      disabled={pendingOffer !== null}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {pendingOffer === String(offer.id) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Wallet className="size-4" />
                      )}
                      {price ? `Tap & pay ${price}` : "Claim this deal"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {offers.length > 1 && activeCard > 0 && (
            <button type="button" aria-label="Previous deal" onClick={() => goTo(activeCard - 1)} className="absolute left-1.5 top-[30%] grid size-9 place-items-center rounded-full bg-surface/95 text-foreground shadow-md">
              <ChevronLeft className="size-5" />
            </button>
          )}
          {offers.length > 1 && activeCard < offers.length - 1 && (
            <button type="button" aria-label="Next deal" onClick={() => goTo(activeCard + 1)} className="absolute right-1.5 top-[30%] grid size-9 place-items-center rounded-full bg-surface/95 text-foreground shadow-md">
              <ChevronRight className="size-5" />
            </button>
          )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-3">
          {offers.length > 1 ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {offers.map((offer, index) => (
                  <button
                    type="button"
                    aria-label={`Show deal ${index + 1}`}
                    onClick={() => goTo(index)}
                    key={offer.id}
                    className={`h-2 rounded-full transition-all ${index === activeCard ? "w-5 bg-primary" : "w-2 bg-primary/25"}`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                Swipe · {activeCard + 1} of {offers.length}
              </span>
            </div>
          ) : (
            <span />
          )}
          <Link
            to="/venue/$id"
            params={{ id: venue.id }}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary"
          >
            Venue details <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {pass && <ClaimPassCard pass={pass} onClose={() => setPass(null)} onChange={setPass} />}
    </div>
  );
}

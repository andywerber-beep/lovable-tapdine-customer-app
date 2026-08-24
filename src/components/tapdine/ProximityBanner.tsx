import { X, Zap } from "lucide-react";

import { activeOffers, type Venue } from "@/lib/tapdine-types";

interface ProximityBannerProps {
  venue: Venue;
  onClose: () => void;
  onOpen: (venue: Venue) => void;
}

export function ProximityBanner({ venue, onClose, onOpen }: ProximityBannerProps) {
  const offers = activeOffers(venue);

  return (
    <div className="pointer-events-auto animate-in slide-in-from-top-4 duration-500">
      <div
        className="mx-auto flex max-w-xl items-center gap-3 rounded-3xl border border-ember/40 bg-surface/95 p-3 backdrop-blur-xl"
        style={{ boxShadow: "var(--shadow-ember)" }}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ember/15 text-ember">
          <Zap className="size-5" />
        </span>
        <button type="button" onClick={() => onOpen(venue)} className="min-w-0 flex-1 text-left">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
            Ember ping · you're close
          </span>
          <span className="block truncate font-display text-base font-semibold">{venue.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {offers.length > 0
              ? `${offers.length} live ${offers.length === 1 ? "offer" : "offers"} waiting`
              : "Tap to see the lookbook"}
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss nearby alert"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

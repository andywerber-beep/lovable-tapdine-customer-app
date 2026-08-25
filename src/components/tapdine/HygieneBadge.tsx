import { ShieldCheck } from "lucide-react";

import { hygieneRating, type Venue } from "@/lib/tapdine-types";

/** FSA food hygiene rating, shown as a customer trust signal. */
export function HygieneBadge({ venue, size = "sm" }: { venue: Venue; size?: "sm" | "lg" }) {
  const rating = hygieneRating(venue);
  if (!rating) return null;

  const inspected = rating.inspectedOn
    ? new Date(rating.inspectedOn).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    : null;

  if (size === "sm") {
    return (
      <span
        title={`FSA food hygiene rating: ${rating.label} — ${rating.meaning}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        <ShieldCheck className="size-3 text-gold" />
        Hygiene {rating.label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/15 font-display text-xl font-semibold text-gold">
        {rating.label === "Pass" ? <ShieldCheck className="size-5" /> : rating.label}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Food hygiene rating
        </p>
        <p className="truncate text-sm font-semibold">{rating.meaning}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Food Standards Agency{inspected ? ` · inspected ${inspected}` : ""}
        </p>
      </div>
    </div>
  );
}

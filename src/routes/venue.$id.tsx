import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock3, MapPin, Phone, Utensils } from "lucide-react";
import type { ReactNode } from "react";

import { HygieneBadge } from "@/components/tapdine/HygieneBadge";
import { getVenue } from "@/lib/tapdine.functions";
import { activeOffers, formatPrice, venueAddress, type Venue } from "@/lib/tapdine-types";



const venueQuery = (id: string) =>
  queryOptions({
    queryKey: ["tapdine", "venue", id],
    queryFn: async () => {
      const venue = await getVenue({ data: { id } });
      if (!venue) throw notFound();
      return venue;
    },
  });

export const Route = createFileRoute("/venue/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(venueQuery(params.id)),
  head: ({ loaderData }) => {
    const venue = loaderData as Venue | undefined;
    if (!venue) {
      return {
        meta: [{ title: "Venue unavailable — TapDine" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${venue.name} — Live Offers on TapDine`;
    const description = `See tonight's flash offers, signature plates and prices at ${venue.name}${
      venue.town ? ` in ${venue.town}` : ""
    }.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: VenuePage,
  errorComponent: VenueError,
  notFoundComponent: VenueMissing,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl">{children}</div>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Radar
    </Link>
  );
}

function VenueError({ error }: { error: Error }) {
  return (
    <Shell>
      <BackLink />
      <h1 className="mt-8 font-display text-2xl font-semibold text-ember">Lookbook unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </Shell>
  );
}

function VenueMissing() {
  return (
    <Shell>
      <BackLink />
      <h1 className="mt-8 font-display text-2xl font-semibold">Venue not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This partner is no longer listed on the radar.
      </p>
    </Shell>
  );
}

function VenuePage() {
  const { id } = Route.useParams();
  const { data: venue } = useSuspenseQuery(venueQuery(id));
  const offers = activeOffers(venue);

  return (
    <Shell>
      <BackLink />

      <header className="mt-6">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
          <Utensils className="size-3" />
          {venue.cuisine_type ?? "Restaurant"}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05]">{venue.name}</h1>
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {venueAddress(venue) || "Address coming soon"}
        </p>
      </header>

      <div className="mt-5">
        <HygieneBadge venue={venue} size="lg" />
      </div>



      {venue.tel_number && (
        <a
          href={`tel:${venue.tel_number.replace(/\s+/g, "")}`}
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-raised"
        >
          <span className="font-semibold">Call to book · {venue.tel_number}</span>
          <Phone className="size-4 text-ember" />
        </a>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Tonight's lookbook</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {offers.length} live
          </span>
        </div>

        {offers.length === 0 ? (
          <p className="mt-6 rounded-3xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            No flash offers posted yet. Keep this venue on your radar.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="overflow-hidden rounded-3xl border border-border bg-surface"
                style={{ boxShadow: "var(--shadow-lift)" }}
              >
                {offer.image_url && (
                  <img
                    src={offer.image_url}
                    alt={offer.title}
                    loading="lazy"
                    className="h-44 w-full object-cover"
                  />
                )}
                <div className="p-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-live">
                    <Clock3 className="size-3" /> {offer.discount_type || "Live now"}
                  </span>
                  <div className="mt-3 flex items-start justify-between gap-4">
                    <h3 className="font-display text-xl font-semibold">{offer.title}</h3>
                    {formatPrice(offer.discount_price) && (
                      <span className="shrink-0 font-display text-xl font-semibold text-gradient-ember">
                        {formatPrice(offer.discount_price)}
                      </span>
                    )}
                  </div>
                  {offer.description && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {offer.description}
                    </p>
                  )}
                </div>
              </li>
            ))}

          </ul>
        )}
      </section>
    </Shell>
  );
}

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock3, Loader2, MapPin, Phone, Utensils, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ClaimPassCard } from "@/components/tapdine/ClaimPassCard";
import { HygieneBadge } from "@/components/tapdine/HygieneBadge";
import { findPass, makeClaimCode, savePass, type ClaimPass } from "@/lib/claim-pass";
import { confirmPaidClaim, getVenue, startOfferCheckout } from "@/lib/tapdine.functions";
import { activeOffers, formatPrice, venueAddress, type Offer, type Venue } from "@/lib/tapdine-types";






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
      className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface px-4 py-2 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-accent"
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
  const [pass, setPass] = useState<ClaimPass | null>(null);
  const [pendingOffer, setPendingOffer] = useState<string | null>(null);

  // Returning from the Stripe payment page: reopen the pass that was paid for.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("pass");
    if (!code) return;
    const saved = findPass(code);
    if (saved) setPass(saved);
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (sessionId) void confirmPaidClaim({ data: { sessionId, code } }).catch(() => undefined);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

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
    <Shell>
      <BackLink />

      <header className="mt-6">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <Utensils className="size-3" />
          {venue.cuisine_type ?? "Restaurant"}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05]">{venue.name}</h1>
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
          <h2 className="font-display text-xl font-bold">Deals to make you smile</h2>
          <span className="rounded-full bg-gold px-3 py-1 text-xs font-extrabold text-gold-foreground">
            {offers.length} live
          </span>
        </div>

        {offers.length === 0 ? (
          <p className="mt-6 rounded-3xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            No flash offers posted yet. Keep this venue on your radar.
          </p>
        ) : (
          <>
            <ul
              onScroll={(event) => {
                const el = event.currentTarget;
                const index = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
                setActiveCard(Math.min(index, offers.length - 1));
              }}
              className="-mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {offers.map((offer) => (
                <li
                  key={offer.id}
                  className="w-[85%] shrink-0 snap-center overflow-hidden rounded-3xl border border-primary/15 bg-surface sm:w-[88%]"
                  style={{ boxShadow: "var(--shadow-lift)" }}
                >
                  {offer.image_url && (
                    <img
                      src={offer.image_url}
                      alt={offer.title}
                      loading="lazy"
                      width={1200}
                      height={720}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  )}
                  <div className="p-5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-gold-foreground">
                      <Clock3 className="size-3" /> {offer.discount_type || "Live now"}
                    </span>
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <h3 className="font-display text-xl font-bold">{offer.title}</h3>
                      {formatPrice(offer.discount_price) && (
                        <span className="shrink-0 font-display text-xl font-extrabold text-primary">
                          {formatPrice(offer.discount_price)}
                        </span>
                      )}
                    </div>
                    {offer.description && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {offer.description}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => void claimOffer(offer)}
                      disabled={pendingOffer !== null}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-display text-base font-extrabold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {pendingOffer === String(offer.id) ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <Wallet className="size-5" />
                      )}
                      {formatPrice(offer.discount_price)
                        ? `Tap & pay ${formatPrice(offer.discount_price)}`
                        : "Claim this deal"}
                    </button>
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Pay with Apple Pay, Google Pay or card, then show your pass to staff.
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {offers.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <div className="flex items-center gap-1.5">
                  {offers.map((offer, index) => (
                    <span
                      key={offer.id}
                      className={`h-2 rounded-full transition-all ${
                        index === activeCard ? "w-5 bg-primary" : "w-2 bg-primary/25"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  Swipe · {activeCard + 1} of {offers.length}
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {pass && <ClaimPassCard pass={pass} onClose={() => setPass(null)} />}
    </Shell>
  );
}

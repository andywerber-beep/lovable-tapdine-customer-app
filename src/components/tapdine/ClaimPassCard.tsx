import { BadgeCheck, Clock3, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CLAIM_WINDOW_MINUTES, expiresAt, type ClaimPass } from "@/lib/claim-pass";
import { formatPrice } from "@/lib/tapdine-types";

function useCountdown(target: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);
  return remaining;
}

export function ClaimPassCard({ pass, onClose }: { pass: ClaimPass; onClose: () => void }) {
  const remaining = useCountdown(expiresAt(pass));
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const expired = remaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-label="Your TapDine claim pass"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-primary/20 bg-surface"
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        <div className="flex items-center justify-between gap-3 bg-primary px-5 py-4 text-primary-foreground">
          <span className="inline-flex items-center gap-2 text-sm font-extrabold">
            <BadgeCheck className="size-5" /> {expired ? "Pass expired" : "Paid · Pass live"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pass"
            className="rounded-full p-1.5 transition-colors hover:bg-primary-foreground/15"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 py-7 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Show this code to staff
          </p>
          <p className="mt-2 font-display text-5xl font-extrabold tracking-tight text-primary">
            {pass.code}
          </p>

          <div
            className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold ${
              expired ? "bg-muted text-muted-foreground" : "bg-gold text-gold-foreground"
            }`}
          >
            <Clock3 className="size-4" />
            {expired
              ? "No longer valid"
              : `${minutes}:${String(seconds).padStart(2, "0")} left to redeem`}
          </div>

          <div className="mt-7 space-y-1 border-t border-border pt-5 text-left">
            <p className="font-display text-xl font-bold">{pass.offerTitle}</p>
            <p className="text-sm text-muted-foreground">{pass.venueName}</p>
            {formatPrice(pass.price) && (
              <p className="pt-2 text-sm font-bold">
                Paid {formatPrice(pass.price)}
                {pass.demo && " · test run, no money taken"}
              </p>
            )}
          </div>

          <p className="mt-5 rounded-2xl bg-accent px-4 py-3 text-left text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Staff:</strong> check the code and countdown above,
            then apply this deal to the bill. Valid for {CLAIM_WINDOW_MINUTES} minutes from purchase.
          </p>
        </div>
      </div>
    </div>
  );
}

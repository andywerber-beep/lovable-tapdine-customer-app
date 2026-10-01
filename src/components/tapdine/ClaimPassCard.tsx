import { BadgeCheck, Clock3, Loader2, Lock, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { toast } from "sonner";

import {
  CANCEL_WINDOW_SECONDS,
  CLAIM_WINDOW_MINUTES,
  expiresAt,
  savePass,
  type ClaimPass,
} from "@/lib/claim-pass";
import { cancelPaidClaim, getClaimStatus } from "@/lib/tapdine.functions";
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

export function ClaimPassCard({
  pass,
  onClose,
  onChange,
}: {
  pass: ClaimPass;
  onClose: () => void;
  onChange?: (pass: ClaimPass) => void;
}) {
  const remaining = useCountdown(expiresAt(pass));
  const cancelLeft = useCountdown(pass.paidAt + CANCEL_WINDOW_SECONDS * 1000);
  const [cancelling, setCancelling] = useState(false);
  const served = !!pass.servedAt;
  const canCancel = !pass.cancelled && !served && cancelLeft > 0;

  // Poll the venue's ticket board status so the phone reacts the moment staff mark it served.
  useEffect(() => {
    if (pass.demo || !pass.sessionId || pass.cancelled || served) return;
    let stopped = false;
    const check = async () => {
      try {
        const status = await getClaimStatus({ data: { sessionId: pass.sessionId!, code: pass.code } });
        if (stopped) return;
        if (status.redeemed) {
          const next = { ...pass, servedAt: status.redeemedAt ? Date.parse(status.redeemedAt) : Date.now() };
          savePass(next);
          onChange?.(next);
          toast.success("Order served — enjoy!");
        } else if (status.refunded) {
          const next = { ...pass, cancelled: true };
          savePass(next);
          onChange?.(next);
        }
      } catch {
        /* try again next tick */
      }
    };
    void check();
    const id = window.setInterval(check, 5000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [pass, served, onChange]);
  const cancelSecs = Math.ceil(cancelLeft / 1000);

  const cancel = async () => {
    setCancelling(true);
    try {
      if (!pass.demo) {
        if (!pass.sessionId) throw new Error("This pass can't be cancelled from this device.");
        const result = await cancelPaidClaim({ data: { sessionId: pass.sessionId, code: pass.code } });
        if (!result.ok) throw new Error(result.reason ?? "Refund could not be processed.");
      }
      const next = { ...pass, cancelled: true };
      savePass(next);
      onChange?.(next);
      toast.success(pass.demo ? "Test pass cancelled." : "Cancelled — full refund on its way.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refund could not be processed.");
    } finally {
      setCancelling(false);
    }
  };

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const expired = !served && (remaining <= 0 || !!pass.cancelled);

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
            <BadgeCheck className="size-5" /> {served ? "Order served" : pass.cancelled ? "Pass cancelled" : expired ? "Pass expired" : "Paid · Pass live"}
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
              served ? "bg-success text-success-foreground" : expired ? "bg-muted text-muted-foreground" : "bg-gold text-gold-foreground"
            }`}
          >
            <Clock3 className="size-4" />
            {served
              ? `Served at ${new Date(pass.servedAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : pass.cancelled
              ? "Cancelled · refunded"
              : expired
              ? "No longer valid"
              : `${minutes}:${String(seconds).padStart(2, "0")} left to redeem`}
          </div>

          {canCancel ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Accidental tap?{" "}
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={cancelling}
                className="inline-flex items-center gap-1 font-semibold text-destructive underline underline-offset-2 transition-opacity hover:opacity-80 disabled:opacity-60"
              >
                {cancelling ? <Loader2 className="size-3 animate-spin" /> : <Undo2 className="size-3" />}
                Cancel for a full refund
              </button>{" "}
              within {cancelSecs}s.
            </p>
          ) : (
            !pass.cancelled && !served && (
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Lock className="size-3.5" /> Order confirmed with venue · Non-refundable
              </p>
            )
          )}

          <div className="mt-7 space-y-1 border-t border-border pt-5 text-left">
            <p className="font-display text-xl font-bold">{pass.offerTitle}</p>
            <p className="text-sm text-muted-foreground">{pass.venueName}</p>
            {formatPrice(pass.price) && (
              <p className="pt-2 text-sm font-bold">
                {pass.cancelled ? "Refunded" : "Paid"} {formatPrice(pass.price)}
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

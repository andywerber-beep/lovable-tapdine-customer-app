/** Digital claim pass helpers — code generation and short-lived local storage. */

export interface ClaimPass {
  code: string;
  venueId: string;
  venueName: string;
  offerId: string;
  offerTitle: string;
  price: number | null;
  paidAt: number;
  /** Test run (no real card charged) — shown clearly on the pass. */
  demo: boolean;
  /** Stripe Checkout session, needed to cancel within the 2-minute window. */
  sessionId?: string;
  /** Set once the customer cancels and is refunded. */
  cancelled?: boolean;
  /** Set once venue staff mark the order served (epoch ms). */
  servedAt?: number;
}

/** Seconds after payment during which an accidental tap can be cancelled. */
export const CANCEL_WINDOW_SECONDS = 60;

/** Minutes the pass stays valid for staff redemption. */
export const CLAIM_WINDOW_MINUTES = 30;

const STORAGE_KEY = "tapdine.claim-passes";

function initials(name: string) {
  const letters = name
    .replace(/^demo\s*·\s*/i, "")
    .replace(/[^a-z\s]/gi, "")
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
  return (letters || "TAP").slice(0, 4);
}

export function makeClaimCode(venueName: string) {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${initials(venueName)}-${digits}`;
}

export function expiresAt(pass: ClaimPass) {
  return pass.paidAt + CLAIM_WINDOW_MINUTES * 60_000;
}

export function isLive(pass: ClaimPass) {
  return Date.now() < expiresAt(pass);
}

function readAll(): ClaimPass[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ClaimPass[]) : [];
  } catch {
    return [];
  }
}

export function savePass(pass: ClaimPass) {
  if (typeof window === "undefined") return;
  const next = [pass, ...readAll().filter((item) => item.code !== pass.code)]
    .filter(isLive)
    .slice(0, 20);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — the pass still shows for this session */
  }
}

export function findPass(code: string): ClaimPass | null {
  return readAll().find((pass) => pass.code === code) ?? null;
}

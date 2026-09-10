export function TapDineBrand() {
  return (
    <div className="flex items-center gap-2" aria-label="TapDine">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-mark text-gold">
        <svg viewBox="0 0 40 40" className="size-8" fill="none" aria-hidden="true">
          <circle cx="20" cy="18" r="14" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
          <circle cx="20" cy="18" r="9" stroke="currentColor" strokeWidth="1.4" opacity="0.8" />
          <path d="M20 4v5M6 18h5M29 18h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
          <path d="M19 15v20M16 15v7c0 2 1.3 3.2 3 3.2s3-1.2 3-3.2v-7M25.5 15c0 3.5-1 6-3.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M23 15.5l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="30.5" cy="8" r="1.6" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-lg font-semibold text-foreground">
        Tap<span className="text-gradient-gold">Dine</span>
      </span>
    </div>
  );
}
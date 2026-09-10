import { RadioTower } from "lucide-react";

export function TapDineBrand() {
  return (
    <div className="flex items-center gap-2" aria-label="TapDine">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/45 bg-surface/80 text-gold backdrop-blur-xl">
        <RadioTower className="size-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="font-display text-lg font-semibold text-foreground">
        Tap<span className="text-gradient-gold">Dine</span>
      </span>
    </div>
  );
}
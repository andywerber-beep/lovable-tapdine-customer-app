import { Download, Share } from "lucide-react";
import { useEffect, useState } from "react";

import { useInstallPrompt } from "@/hooks/useInstallPrompt";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Install entry point for the radar footer.
 * - Android/desktop Chrome: fires the native beforeinstallprompt prompt.
 * - iPhone/iPad: no programmatic install exists, so we show
 *   "Share → Add to Home Screen" instructions in a small popover.
 * Hidden entirely once the app is already installed.
 */
export function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    setStandalone(isInStandaloneMode());
  }, []);

  if (standalone) return null;

  if (canInstall) {
    return (
      <button
        type="button"
        onClick={promptInstall}
        aria-label="Install the TapDine app"
        className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ember text-ember-foreground transition-transform hover:scale-105"
        style={{ boxShadow: "var(--shadow-ember)" }}
      >
        <Download className="size-5" />
      </button>
    );
  }

  if (isIOS()) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setShowIosHelp((open) => !open)}
          aria-label="How to install TapDine on iPhone"
          aria-expanded={showIosHelp}
          className="grid size-10 place-items-center rounded-2xl bg-ember text-ember-foreground transition-transform hover:scale-105"
          style={{ boxShadow: "var(--shadow-ember)" }}
        >
          <Download className="size-5" />
        </button>
        {showIosHelp && (
          <div className="absolute bottom-12 right-0 w-64 rounded-2xl border border-border bg-surface p-4 text-left shadow-xl">
            <p className="font-display text-sm font-semibold text-foreground">
              Install TapDine
            </p>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span>1.</span>
                <span className="flex items-center gap-1">
                  Tap <Share className="inline size-3.5 text-ember" /> Share in Safari
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span>2.</span>
                <span>Scroll down and tap “Add to Home Screen”</span>
              </li>
              <li className="flex items-start gap-2">
                <span>3.</span>
                <span>Tap “Add” — TapDine opens like an app</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return null;
}

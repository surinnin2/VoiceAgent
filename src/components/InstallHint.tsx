"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "va.installHintDismissed";

type BIPEvent = Event & { prompt: () => void; userChoice: Promise<unknown> };

// Prompts the user to install the PWA. iOS Safari shows no automatic prompt, so we render a
// "Share → Add to Home Screen" tip; Android Chrome fires beforeinstallprompt, which we defer
// behind an Install button. Hidden once installed (standalone) or dismissed.
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"ios" | "android">("ios");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      setMode("ios");
      setShow(true);
      return;
    }

    function onBIP(e: Event) {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setMode("android");
      setShow(true);
    }
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="install-hint">
      {mode === "ios" ? (
        <span>
          Install: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Open it from
          the home-screen icon so the mic works.
        </span>
      ) : (
        <button className="primary" onClick={() => void install()}>
          Install app
        </button>
      )}
      <button className="install-x" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

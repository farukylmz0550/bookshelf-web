// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user has dismissed before
      const wasDismissed = localStorage.getItem("install-prompt-dismissed");
      if (!wasDismissed) {
        setShowPrompt(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("install-prompt-dismissed", "true");
  }

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 inset-x-4 z-40 mx-auto max-w-md rounded-xl border border-border bg-card p-3 shadow-lg md:bottom-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 rounded-lg bg-primary/10 p-2">
          <Download size={18} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{"Install Book Shelf"}</p>
          <p className="text-xs text-muted-foreground">Add to home screen, use offline</p>
        </div>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Install
        </button>
        <button onClick={handleDismiss} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

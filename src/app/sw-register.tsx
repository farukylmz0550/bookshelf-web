// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output.buffer;
}

async function subscribeToPush(reg: ServiceWorkerRegistration, vapidPublicKey: string): Promise<void> {
  try {
    let existing = await reg.pushManager.getSubscription();
    // A subscription is bound to the VAPID application server key. If the
    // deployment rotates keys, reusing the old browser subscription makes all
    // scheduled sends fail with an invalid VAPID signature.
    const storageKey = "bookshelf-vapid-public-key";
    const previousKey = window.localStorage.getItem(storageKey);
    if (existing && previousKey && previousKey !== vapidPublicKey) {
      await existing.unsubscribe();
      existing = null;
    }
    const subscription =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    window.localStorage.setItem(storageKey, vapidPublicKey);

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch {
    // Subscription is optional — scheduled notifications are server-driven
  }
}

export function SWRegister({ vapidPublicKey }: { vapidPublicKey?: string }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const swUrl = vapidPublicKey ? `/sw.js?vapid=${encodeURIComponent(vapidPublicKey)}` : "/sw.js";

      navigator.serviceWorker.register(swUrl).then((reg) => {
        // Notify when a new service worker version is installed & waiting
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              toast.info("New version available — refresh the page to update", {
                duration: Infinity,
                action: { label: "Refresh", onClick: () => window.location.reload() },
              });
            }
          });
        });

        // Request notification permission; push subscription feeds the
        // server-side scheduler (docker-compose cron → /api/push/streak-remind).
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted" && vapidPublicKey) void subscribeToPush(reg, vapidPublicKey);
          });
        } else if (Notification.permission === "granted" && vapidPublicKey) {
          void subscribeToPush(reg, vapidPublicKey);
        }
      });
    }
  }, [vapidPublicKey]);

  return null;
}

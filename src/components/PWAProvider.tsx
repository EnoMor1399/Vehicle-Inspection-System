"use client";

import { useEffect, useSyncExternalStore } from "react";

function getNetworkSnapshot(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getServerNetworkSnapshot(): boolean {
  return true;
}

function subscribeToNetworkStatus(onStoreChange: () => void) {
  const refresh = () => onStoreChange();

  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", refresh);

  const intervalId = window.setInterval(refresh, 15_000);

  return () => {
    window.removeEventListener("online", refresh);
    window.removeEventListener("offline", refresh);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pageshow", refresh);
    document.removeEventListener("visibilitychange", refresh);
    window.clearInterval(intervalId);
  };
}

export function PWAProvider() {
  const isOnline = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkSnapshot,
    getServerNetworkSnapshot
  );

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      window.__vimsInstallPrompt = installEvent;
      window.dispatchEvent(new Event("vims:install-available"));
    };

    const onAppInstalled = () => {
      window.__vimsInstallPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    let updateTimer: number | undefined;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          // Check for a newer shell periodically without caching protected data.
          updateTimer = window.setInterval(() => {
            registration.update().catch(() => undefined);
          }, 60 * 60 * 1000);
        })
        .catch(() => {
          // The web application remains usable if service-worker registration fails.
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      if (updateTimer !== undefined) window.clearInterval(updateTimer);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex max-w-sm items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm text-white shadow-lg"
    >
      <div className="h-2 w-2 shrink-0 rounded-full bg-white" />
      Offline — network access is required for protected records and transactions.
    </div>
  );
}

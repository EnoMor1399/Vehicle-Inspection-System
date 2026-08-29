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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The web application remains usable if service-worker registration fails.
      });
    }
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

"use client";

import { useCallback, useEffect, useState } from "react";

export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingSync, setPendingSync] = useState(0);

  const updatePendingCount = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction("pendingInspections", "readonly");
      const store = tx.objectStore("pendingInspections");
      const countReq = store.count();
      await new Promise<void>((resolve) => {
        countReq.onsuccess = () => {
          setPendingSync(countReq.result as number);
          resolve();
        };
      });
    } catch {
      setPendingSync(0);
    }
  }, []);

  const syncPendingInspections = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const db = await openOfflineDB();
      const tx = db.transaction("pendingInspections", "readwrite");
      const store = tx.objectStore("pendingInspections");
      const allReq = store.getAll();
      const all: any[] = await new Promise((resolve, reject) => {
        allReq.onsuccess = () => resolve(allReq.result);
        allReq.onerror = () => reject(allReq.error);
      });
      for (const item of all) {
        try {
          const res = await fetch("/api/v1/inspections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.data),
          });
          if (res.ok) {
            await store.delete(item.id);
          }
        } catch {
          // Will retry later
        }
      }
      updatePendingCount();
    } catch {
      // DB not available
    }
  }, [updatePendingCount]);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => console.warn("SW registration failed:", err));

      // Listen for sync messages
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_PENDING_INSPECTIONS") {
          syncPendingInspections();
        }
      });
    }

    // Install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Installed check
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };
    checkInstalled();

    // Online/offline
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingInspections();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Count pending offline inspections (defer to avoid synchronous setState in effect)
    const timeout = setTimeout(() => updatePendingCount(), 0);
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [syncPendingInspections, updatePendingCount]);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  }

  return (
    <>
      {/* Online/Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-pulse">
          <div className="h-2 w-2 rounded-full bg-white" />
          You are offline — changes will sync when reconnected
        </div>
      )}

      {/* Pending sync indicator */}
      {pendingSync > 0 && isOnline && (
        <div className="fixed bottom-4 left-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Syncing {pendingSync} offline inspection{pendingSync === 1 ? "" : "s"}...
        </div>
      )}

      {/* Install button */}
      {installPrompt && !isInstalled && (
        <button
          onClick={handleInstall}
          className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Install App
        </button>
      )}
    </>
  );
}

export async function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rsl-vims-offline", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("pendingInspections")) {
        db.createObjectStore("pendingInspections", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cachedVehicles")) {
        db.createObjectStore("cachedVehicles", { keyPath: "id" });
      }
    };
  });
}

export async function saveInspectionOffline(data: any): Promise<number> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pendingInspections", "readwrite");
    const store = tx.objectStore("pendingInspections");
    const request = store.add({ data, savedAt: new Date().toISOString() });
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

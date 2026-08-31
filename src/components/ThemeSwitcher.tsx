"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Check, Cloud, CloudOff, Monitor, Moon, Sun } from "lucide-react";
import { saveThemePreferenceAction } from "@/app/theme-actions";

export type ThemeMode = "light" | "dark" | "system";
type SyncState = "idle" | "syncing" | "synced" | "local";

const STORAGE_KEY = "vims-theme";
const MODES: { value: ThemeMode; label: string; description: string; icon: typeof Sun; preview: string }[] = [
  {
    value: "light",
    label: "Day",
    description: "Bright, crisp workspace for daylight",
    icon: Sun,
    preview: "bg-gradient-to-br from-white via-slate-50 to-emerald-50",
  },
  {
    value: "dark",
    label: "Night",
    description: "Low-glare ink and navy for low light",
    icon: Moon,
    preview: "bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950",
  },
  {
    value: "system",
    label: "Auto",
    description: "Match the appearance of this device",
    icon: Monitor,
    preview: "bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#0f172a_49%,#07111f_100%)]",
  },
];

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function resolveDark(mode: ThemeMode) {
  return mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function applyTheme(mode: ThemeMode, animate = false) {
  const root = document.documentElement;
  const dark = resolveDark(mode);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (animate && !reduceMotion) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 240);
  }

  root.classList.toggle("dark", dark);
  root.dataset.theme = mode;
  root.style.colorScheme = dark ? "dark" : "light";

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const brand = getComputedStyle(root).getPropertyValue("--brand-color").trim() || "#039703";
    themeMeta.setAttribute("content", dark ? "#07101c" : brand);
  }
}

export function ThemeSwitcher({
  accountMode = null,
  authenticated = false,
}: {
  accountMode?: ThemeMode | null;
  authenticated?: boolean;
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<ThemeMode>(accountMode || "system");
  const [open, setOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(authenticated && accountMode ? "synced" : "idle");
  const [, startSync] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const embeddedInShell = pathname !== "/login";

  const syncPreference = (next: ThemeMode) => {
    if (!authenticated) return;
    setSyncState("syncing");
    startSync(() => {
      void saveThemePreferenceAction(next).then((result) => {
        setSyncState(result.ok ? "synced" : "local");
      });
    });
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = accountMode || (isThemeMode(stored) ? stored : "system");
    window.localStorage.setItem(STORAGE_KEY, initial);
    applyTheme(initial);

    // Defer React-state synchronization until after the effect has completed.
    // The DOM theme is applied immediately, so there is no visual flash, while
    // avoiding a synchronous effect -> setState render cascade.
    const timer = window.setTimeout(() => {
      setMode(initial);
      if (authenticated && !accountMode && isThemeMode(stored)) {
        syncPreference(stored);
      } else if (authenticated && !accountMode) {
        syncPreference("system");
      }
    }, 0);

    return () => window.clearTimeout(timer);
    // Initial synchronization is intentionally driven only by server props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountMode, authenticated]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") applyTheme("system", true);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (pathname.startsWith("/certificate") || pathname.startsWith("/verify")) return null;

  const choose = (next: ThemeMode) => {
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next, true);
    setOpen(false);
    syncPreference(next);
  };

  const ActiveIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const activeLabel = MODES.find((item) => item.value === mode)?.label || "Auto";
  const SyncIcon = !authenticated ? Monitor : syncState === "local" ? CloudOff : Cloud;
  const syncLabel = !authenticated
    ? "Saved on this device"
    : syncState === "syncing"
      ? "Syncing preference"
      : syncState === "synced"
        ? "Synced to your account"
        : syncState === "local"
          ? "Account sync unavailable · saved locally"
          : "Saved on this device";

  return (
    <div
      ref={containerRef}
      className={`theme-switcher no-print z-[80] ${
        embeddedInShell ? "relative shrink-0" : "fixed right-3 top-3 sm:right-5 sm:top-5"
      }`}
    >
      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className="absolute right-0 top-[calc(100%+10px)] w-[290px] overflow-hidden rounded-[22px] border border-slate-200/90 bg-white/95 p-2.5 shadow-2xl shadow-slate-950/15 backdrop-blur-xl dark:border-slate-700/80 dark:bg-[#0d1b2c]/95 dark:shadow-black/45"
        >
          <div className="px-2 pb-2.5 pt-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Appearance</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Choose the lighting mode that is easiest on your eyes.</p>
              </div>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-300 dark:ring-emerald-900">
                <ActiveIcon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              syncState === "local" ? "text-amber-600 dark:text-amber-300" : "text-slate-400 dark:text-slate-500"
            }`}>
              <SyncIcon className="h-3 w-3" />
              {syncLabel}
            </div>
          </div>

          <div className="space-y-1.5">
            {MODES.map((item) => {
              const Icon = item.icon;
              const active = item.value === mode;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => choose(item.value)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100"
                      : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"
                  }`}
                >
                  <span className={`relative h-11 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-inner dark:border-slate-700 ${item.preview}`}>
                    <span className="absolute bottom-1.5 left-1.5 h-2 w-7 rounded-full bg-emerald-500/80" />
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md bg-white/85 text-slate-600 shadow-sm dark:bg-slate-950/75 dark:text-slate-300">
                      <Icon className="h-3 w-3" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {item.label}
                      {active && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Active</span>}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{item.description}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Appearance: ${activeLabel}`}
        title={`Appearance: ${activeLabel}`}
        className="group flex h-10 items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-2.5 text-xs font-semibold text-slate-700 shadow-md shadow-slate-950/10 backdrop-blur-xl transition hover:border-emerald-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 dark:border-slate-700/80 dark:bg-[#0d1b2c]/95 dark:text-slate-100 dark:shadow-black/35 dark:hover:border-emerald-700 dark:focus-visible:ring-offset-slate-950 sm:px-3"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
          <ActiveIcon className="h-3.5 w-3.5" />
        </span>
        <span className="hidden sm:inline">{activeLabel}</span>
      </button>
    </div>
  );
}

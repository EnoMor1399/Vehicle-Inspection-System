"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Monitor, Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "vims-theme";
const MODES: { value: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
  { value: "light", label: "Day", description: "Bright, high-clarity workspace", icon: Sun },
  { value: "dark", label: "Night", description: "Low-glare navy workspace", icon: Moon },
  { value: "system", label: "Auto", description: "Follow this device", icon: Monitor },
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

  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 240);
  }

  root.classList.toggle("dark", dark);
  root.dataset.theme = mode;
  root.style.colorScheme = dark ? "dark" : "light";

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const brand = getComputedStyle(root).getPropertyValue("--brand-color").trim() || "#039703";
    themeMeta.setAttribute("content", dark ? "#07111f" : brand);
  }
}

export function ThemeSwitcher() {
  const pathname = usePathname();
  const [mode, setMode] = useState<ThemeMode>("system");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = isThemeMode(stored)
      ? stored
      : isThemeMode(document.documentElement.dataset.theme || null)
        ? (document.documentElement.dataset.theme as ThemeMode)
        : "system";
    setMode(initial);
    applyTheme(initial);
  }, []);

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
  };

  const ActiveIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const activeLabel = MODES.find((item) => item.value === mode)?.label || "Auto";

  return (
    <div ref={containerRef} className="no-print fixed bottom-4 right-4 z-[80] sm:bottom-5 sm:right-5">
      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className="absolute bottom-[calc(100%+10px)] right-0 w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          <div className="px-2 pb-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Appearance</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Choose a comfortable workspace for your lighting conditions.</p>
          </div>
          <div className="space-y-1">
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
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-200"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{item.description}</span>
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
        className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/35 dark:hover:border-slate-600 dark:focus-visible:ring-offset-slate-950 sm:h-12"
      >
        <ActiveIcon className="h-4.5 w-4.5 text-[var(--brand-color)] dark:text-emerald-400" />
        <span className="hidden sm:inline">{activeLabel}</span>
      </button>
    </div>
  );
}

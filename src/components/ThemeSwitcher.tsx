"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Monitor, Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

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
    themeMeta.setAttribute("content", dark ? "#07101c" : brand);
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
    <div ref={containerRef} className="theme-switcher no-print fixed bottom-4 right-4 z-[80] sm:bottom-5 sm:right-5">
      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className="absolute bottom-[calc(100%+12px)] right-0 w-[290px] overflow-hidden rounded-[22px] border border-slate-200/90 bg-white/95 p-2.5 shadow-2xl shadow-slate-950/15 backdrop-blur-xl dark:border-slate-700/80 dark:bg-[#0d1b2c]/95 dark:shadow-black/45"
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
        className="group flex h-12 items-center gap-2.5 rounded-full border border-slate-200/90 bg-white/95 px-3.5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-950/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 dark:border-slate-700/80 dark:bg-[#0d1b2c]/95 dark:text-slate-100 dark:shadow-black/35 dark:hover:border-emerald-700 dark:focus-visible:ring-offset-slate-950"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
          <ActiveIcon className="h-4 w-4" />
        </span>
        <span>{activeLabel}</span>
      </button>
    </div>
  );
}

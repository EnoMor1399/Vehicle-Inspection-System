"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Laptop,
  MonitorSmartphone,
  MoreVertical,
  Share2,
  Smartphone,
  SquarePlus,
} from "lucide-react";
import {
  detectInstallBrowser,
  detectInstallPlatform,
  installBrowserLabel,
  installPlatformLabel,
  type InstallBrowser,
  type InstallPlatform,
} from "@/lib/pwa-platform";

type InstallState = "checking" | "installed" | "prompt-ready" | "instructions";

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function getInstructions(platform: InstallPlatform, browser: InstallBrowser) {
  if (platform === "ios") {
    return {
      title: "Install on iPhone or iPad",
      summary: browser === "safari"
        ? "Safari can add VIMS to your Home Screen as an app."
        : "For the most reliable iPhone/iPad installation, open VIMS in Safari first.",
      steps: [
        "Open VIMS in Safari.",
        "Tap the Share button in the Safari toolbar.",
        "Scroll and choose Add to Home Screen.",
        "Confirm the name “RSL VIMS”, then tap Add.",
        "Launch VIMS from the new Home Screen icon and sign in normally.",
      ],
    };
  }

  if (platform === "android") {
    return {
      title: "Install on Android",
      summary: "Chrome and supported Chromium browsers can install VIMS directly from the site.",
      steps: [
        "Open VIMS in Chrome or another supported Chromium browser.",
        "Use the Install VIMS button above when it is available.",
        "If no button appears, open the browser menu (⋮).",
        "Choose Install app or Add to Home screen.",
        "Confirm Install, then launch VIMS from the app icon.",
      ],
    };
  }

  if (platform === "windows") {
    return {
      title: "Install on Windows",
      summary: "Microsoft Edge and Google Chrome provide the best desktop PWA installation experience.",
      steps: browser === "edge"
        ? [
            "Open VIMS in Microsoft Edge.",
            "Use the Install VIMS button above when it is available.",
            "Alternatively open Settings and more (⋯) → Apps → Install this site as an app.",
            "Confirm the app name and choose Install.",
            "Optionally pin VIMS to Start or the taskbar when Windows offers the choices.",
          ]
        : [
            "Open VIMS in Google Chrome or Microsoft Edge.",
            "Use the Install VIMS button above when it is available.",
            "Alternatively choose the install icon in the address bar or browser menu → Install VIMS.",
            "Confirm Install.",
            "Launch VIMS from the Start menu, desktop shortcut, or taskbar.",
          ],
    };
  }

  if (platform === "macos") {
    return {
      title: "Install on macOS",
      summary: "Safari and Chromium browsers can provide an app-like VIMS window on supported macOS versions.",
      steps: browser === "safari"
        ? [
            "Open VIMS in Safari.",
            "Choose File → Add to Dock.",
            "Confirm the VIMS name and icon.",
            "Open VIMS from the Dock, Launchpad, or Applications.",
          ]
        : [
            "Open VIMS in Google Chrome or Microsoft Edge.",
            "Use the Install VIMS button above when it is available.",
            "Alternatively choose the install icon in the address bar or browser menu → Install VIMS.",
            "Confirm Install and launch VIMS from your Applications or browser app launcher.",
          ],
    };
  }

  if (platform === "linux") {
    return {
      title: "Install on Linux",
      summary: "Use Chrome, Chromium, or another browser that supports installable web apps.",
      steps: [
        "Open VIMS in a supported Chromium-based browser.",
        "Use the Install VIMS button above when it is available.",
        "Alternatively use the browser menu and choose Install VIMS or Install app.",
        "Confirm the installation.",
        "Launch VIMS from your desktop application menu.",
      ],
    };
  }

  return {
    title: "Install on this device",
    summary: "Use a modern browser with Progressive Web App support.",
    steps: [
      "Open VIMS in a current browser.",
      "Look for Install app, Add to Home Screen, or an install icon in the address bar.",
      "Follow the browser confirmation steps.",
      "Launch VIMS from the installed app icon.",
    ],
  };
}

export function PWAInstallCentre() {
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [browser, setBrowser] = useState<InstallBrowser>("other");
  const [state, setState] = useState<InstallState>("checking");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState("Checking installation support…");

  useEffect(() => {
    const detectedPlatform = detectInstallPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
    const detectedBrowser = detectInstallBrowser(navigator.userAgent);
    setPlatform(detectedPlatform);
    setBrowser(detectedBrowser);

    const installed = isStandaloneMode();
    if (installed) {
      setState("installed");
      setMessage("VIMS is already installed on this device.");
      return;
    }

    const existingPrompt = window.__vimsInstallPrompt || null;
    if (existingPrompt) {
      setPrompt(existingPrompt);
      setState("prompt-ready");
      setMessage("This browser is ready to install VIMS.");
    } else {
      setState("instructions");
      setMessage("Use the installation steps for this device.");
    }

    const onInstallAvailable = () => {
      const nextPrompt = window.__vimsInstallPrompt || null;
      if (nextPrompt) {
        setPrompt(nextPrompt);
        setState("prompt-ready");
        setMessage("This browser is ready to install VIMS.");
      }
    };

    const onInstalled = () => {
      window.__vimsInstallPrompt = null;
      setPrompt(null);
      setState("installed");
      setMessage("VIMS was installed successfully.");
    };

    const displayMode = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => {
      if (isStandaloneMode()) onInstalled();
    };

    window.addEventListener("vims:install-available", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener?.("change", onDisplayChange);

    return () => {
      window.removeEventListener("vims:install-available", onInstallAvailable);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode.removeEventListener?.("change", onDisplayChange);
    };
  }, []);

  const instructions = useMemo(() => getInstructions(platform, browser), [platform, browser]);
  const detectedLabel = `${installPlatformLabel(platform)} · ${installBrowserLabel(browser)}`;

  async function handleInstall() {
    if (!prompt) {
      document.getElementById("installation-instructions")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setMessage("Follow the browser-specific installation steps below.");
      return;
    }

    setMessage("Opening the browser installation prompt…");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      window.__vimsInstallPrompt = null;
      setPrompt(null);

      if (choice.outcome === "accepted") {
        setMessage("Installation accepted. VIMS will appear with your installed apps.");
      } else {
        setState("instructions");
        setMessage("Installation was dismissed. You can install later using the steps below.");
      }
    } catch {
      setState("instructions");
      setMessage("The browser could not open the install prompt. Use the manual steps below.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 shadow-sm">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-7">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                <MonitorSmartphone className="h-4 w-4 text-emerald-700" />
                {detectedLabel}
              </span>
              {state === "installed" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4" />
                  Installed
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Install VIMS on this device</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Install the secure VIMS web app for a dedicated window, faster launch, Home Screen or desktop access, and a layout that adapts automatically to phones, tablets, laptops, and desktop monitors.
            </p>
            <p className="mt-3 text-xs font-medium text-slate-500" aria-live="polite">{message}</p>
          </div>

          <button
            type="button"
            onClick={handleInstall}
            disabled={state === "installed" || state === "checking"}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-default disabled:bg-slate-300 lg:w-auto"
          >
            {state === "installed" ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            {state === "installed" ? "VIMS Installed" : state === "prompt-ready" ? "Install VIMS" : "View Install Steps"}
          </button>
        </div>
      </section>

      <section id="installation-instructions" className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
              {platform === "ios" || platform === "android" ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
            </span>
            <div>
              <h3 className="font-semibold text-slate-950">{instructions.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{instructions.summary}</p>
            </div>
          </div>

          <ol className="mt-5 space-y-3">
            {instructions.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-6 text-slate-700">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">Common browser controls</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p><strong className="text-slate-800">iPhone/iPad:</strong> Safari Share → Add to Home Screen.</p>
              </div>
              <div className="flex items-start gap-3">
                <MoreVertical className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <p><strong className="text-slate-800">Android/desktop:</strong> Browser menu → Install app.</p>
              </div>
              <div className="flex items-start gap-3">
                <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p><strong className="text-slate-800">macOS Safari:</strong> File → Add to Dock.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-semibold text-amber-950">Connectivity remains required</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900/80">
              Installation does not turn VIMS into an offline database. Protected records, inspection submissions, approvals, uploads, and other authenticated transactions continue to require a live connection.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

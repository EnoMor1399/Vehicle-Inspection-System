import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-system.css";
import { AppShell } from "@/components/AppShell";
import { PWAProvider } from "@/components/PWAProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { getSettings } from "@/lib/settings";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { getUserThemePreference, type ThemeMode } from "@/lib/theme-preferences";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RSL — Vehicle Inspection Management System",
  description: "Road Safety Limited — secure vehicle inspection, compliance, reporting, and fleet operations management.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RSL VIMS",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#039703",
  },
};

export const viewport: Viewport = {
  themeColor: "#039703",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

const SHELL_RESOURCES = [
  "vehicles",
  "transporters",
  "inspections",
  "reports",
  "users",
  "documents",
  "locations",
  "import",
  "notifications",
  "audit",
  "settings",
] as const;

function buildThemeBootstrap(accountMode: ThemeMode | null) {
  const account = accountMode ? JSON.stringify(accountMode) : "null";
  return `
(() => {
  try {
    const accountMode = ${account};
    const stored = localStorage.getItem("vims-theme");
    const storedIsValid = stored === "light" || stored === "dark" || stored === "system";
    const mode = accountMode || (storedIsValid ? stored : "system");
    if (accountMode) localStorage.setItem("vims-theme", accountMode);
    const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.theme = mode;
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (_) {}
})();`;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  let shellUser: { role: string; name: string; allowedResources: string[] } | null = null;
  let accountTheme: ThemeMode | null = null;

  try {
    const user = await getCurrentUser();
    accountTheme = await getUserThemePreference(user.id);
    shellUser = {
      role: user.role,
      name: user.name,
      allowedResources: SHELL_RESOURCES.filter((resource) => hasPermission(user, resource)),
    };
  } catch {
    // Public and login routes intentionally render without an authenticated shell identity.
  }

  const themeBootstrap = buildThemeBootstrap(accountTheme);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href={settings.logoDataUrl || "/icons/icon-192.png"} />
        <meta name="theme-color" content={settings.themeColor} />
        <style>{`:root { --brand-color: ${settings.themeColor}; --brand-accent: ${settings.accentColor}; }`}</style>
      </head>
      <body className="antialiased">
        <ErrorBoundary>
          <AppShell
            branding={{
              logoUrl: settings.logoDataUrl,
              companyName: settings.companyName,
              tagline: settings.tagline || "",
              footerText: settings.footerText || "",
              themeColor: settings.themeColor,
              accentColor: settings.accentColor,
            }}
            userRole={shellUser?.role}
            userName={shellUser?.name}
            allowedResources={shellUser?.allowedResources || []}
          >
            {children}
          </AppShell>
          <ThemeSwitcher accountMode={accountTheme} authenticated={Boolean(shellUser)} />
          <PWAProvider />
        </ErrorBoundary>
      </body>
    </html>
  );
}

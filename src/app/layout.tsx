import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-system.css";
import { AppShell } from "@/components/AppShell";
import { PWAProvider } from "@/components/PWAProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { getSettings } from "@/lib/settings";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { canAccessDriverTraining, canAccessVehicleInspection } from "@/lib/system-access";
import { getUserThemePreference, type ThemeMode } from "@/lib/theme-preferences";
import { getOrganizationSubscriptionState, hasOrganizationModule } from "@/lib/organization-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RSL — Vehicle Inspection Management System",
  description: "Road Safety Limited — secure vehicle inspection, compliance, reporting, and fleet operations management.",
  manifest: "/manifest.json?v=4",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RSL VIMS",
  },
  icons: {
    icon: [
      { url: "/pwa/icon/192", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/pwa/icon/192", sizes: "192x192", type: "image/png" },
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
  const nonce = (await headers()).get("x-nonce") || undefined;
  let shellUser: { role: string; name: string; organizationId: string; allowedResources: string[] } | null = null;
  let accountTheme: ThemeMode | null = null;

  try {
    const user = await getCurrentUser();
    accountTheme = await getUserThemePreference(user.id);
    const organizationState = await getOrganizationSubscriptionState(user.organizationId);
    const allowedResources = SHELL_RESOURCES.filter((resource) => {
      if (!hasPermission(user, resource)) return false;
      if (resource === "reports") return hasOrganizationModule(organizationState, "reports");
      return true;
    }) as string[];
    if (canAccessVehicleInspection(user) && hasOrganizationModule(organizationState, "vehicle_inspection")) {
      allowedResources.push("vehicle_inspection");
    }
    if (canAccessDriverTraining(user) && hasOrganizationModule(organizationState, "driver_training")) {
      allowedResources.push("training");
    }
    if (hasOrganizationModule(organizationState, "api")) {
      allowedResources.push("api_module");
    }

    shellUser = {
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
      allowedResources,
    };
  } catch {
    // Public and login routes intentionally render without an authenticated shell identity.
  }

  const settings = await getSettings(shellUser?.organizationId);
  const themeBootstrap = buildThemeBootstrap(accountTheme);
  const appearanceControl = <ThemeSwitcher accountMode={accountTheme} authenticated={Boolean(shellUser)} />;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href={settings.logoDataUrl || "/pwa/icon/192"} />
        <meta name="theme-color" content={settings.themeColor} />
        <style nonce={nonce}>{`:root { --brand-color: ${settings.themeColor}; --brand-accent: ${settings.accentColor}; }`}</style>
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
            appearanceControl={appearanceControl}
          >
            {children}
          </AppShell>
          <PWAProvider />
        </ErrorBoundary>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { PWAProvider } from "@/components/PWAProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RSL — Vehicle Inspection Management System",
  description: "Road Safety Limited — Enterprise-grade vehicle inspection management. Available as PWA, Android, and iOS app.",
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href={settings.logoDataUrl || "/icons/icon-192.png"} />
        <meta name="theme-color" content={settings.themeColor} />
        <style>{`:root { --brand-color: ${settings.themeColor}; --brand-accent: ${settings.accentColor}; }`}</style>
      </head>
      <body className="bg-slate-100 text-slate-900 antialiased">
        <ErrorBoundary>
          <AppShell branding={{
            logoUrl: settings.logoDataUrl,
            companyName: settings.companyName,
            tagline: settings.tagline || "",
            footerText: settings.footerText || "",
            themeColor: settings.themeColor,
            accentColor: settings.accentColor,
          }}>
            {children}
          </AppShell>
          <PWAProvider />
        </ErrorBoundary>
      </body>
    </html>
  );
}

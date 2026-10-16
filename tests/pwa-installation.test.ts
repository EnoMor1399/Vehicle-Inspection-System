import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectInstallBrowser, detectInstallPlatform } from "../src/lib/pwa-platform";

test("PWA platform detection covers common mobile and desktop systems", () => {
  assert.equal(
    detectInstallPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)", platform: "Linux armv8l" }),
    "android",
  );
  assert.equal(
    detectInstallPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone" }),
    "ios",
  );
  assert.equal(
    detectInstallPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 }),
    "ios",
  );
  assert.equal(
    detectInstallPlatform({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32" }),
    "windows",
  );
  assert.equal(
    detectInstallPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", platform: "MacIntel" }),
    "macos",
  );
  assert.equal(
    detectInstallPlatform({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", platform: "Linux x86_64" }),
    "linux",
  );
});

test("PWA browser detection distinguishes installation guidance paths", () => {
  assert.equal(detectInstallBrowser("Mozilla/5.0 Chrome/155.0 Safari/537.36"), "chrome");
  assert.equal(detectInstallBrowser("Mozilla/5.0 Edg/155.0 Chrome/155.0 Safari/537.36"), "edge");
  assert.equal(detectInstallBrowser("Mozilla/5.0 Version/18.0 Safari/605.1.15"), "safari");
  assert.equal(detectInstallBrowser("Mozilla/5.0 Firefox/145.0"), "firefox");
});

test("manifest declares a cross-platform installable standalone application", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.theme_color, "#039703");
  assert.ok(Array.isArray(manifest.display_override));
  assert.ok(manifest.display_override.includes("standalone"));
  assert.ok(manifest.icons.some((icon: { sizes?: string; src?: string }) => icon.sizes === "192x192" && icon.src === "/pwa/icon/192"));
  assert.ok(manifest.icons.some((icon: { sizes?: string; src?: string }) => icon.sizes === "512x512" && icon.src === "/pwa/icon/512"));
});

test("PWA provider captures the native browser install event", () => {
  const source = readFileSync("src/components/PWAProvider.tsx", "utf8");
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /event as BeforeInstallPromptEvent/);
  assert.match(source, /__vimsInstallPrompt/);
  assert.match(source, /vims:install-available/);
  assert.match(source, /appinstalled/);
  assert.match(source, /updateViaCache: "none"/);
});

test("App Access provides direct installation and platform-specific fallback guidance", () => {
  const page = readFileSync("src/app/apps/page.tsx", "utf8");
  const centre = readFileSync("src/components/PWAInstallCentre.tsx", "utf8");

  assert.match(page, /PWAInstallCentre/);
  assert.match(page, /Android/);
  assert.match(page, /iPhone & iPad/);
  assert.match(page, /Windows/);
  assert.match(page, /macOS & Linux/);

  assert.match(centre, /Install VIMS/);
  assert.match(centre, /Add to Home Screen/);
  assert.match(centre, /Add to Dock/);
  assert.match(centre, /Install this site as an app/);
  assert.match(centre, /display-mode: standalone/);
});

test("service worker improves install launch performance without caching protected API data", () => {
  const source = readFileSync("public/sw.js", "utf8");
  assert.match(source, /navigationPreload\.enable/);
  assert.match(source, /event\.preloadResponse/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(source, /fetch\(request\)\.catch/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /\/pwa\/icon\/192/);
  assert.match(source, /\/pwa\/icon\/512/);
  assert.doesNotMatch(source, /cache\.put\(request[\s\S]{0,120}url\.pathname\.startsWith\("\/api\/"\)/);
});


test("PWA icon endpoint generates the exact install icon sizes", () => {
  const source = readFileSync("src/app/pwa/icon/[size]/route.tsx", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");

  assert.match(source, /new ImageResponse/);
  assert.match(source, /SUPPORTED_SIZES = new Set\(\[192, 512\]\)/);
  assert.match(source, /"Cache-Control": "public, max-age=31536000, immutable"/);
  assert.match(layout, /manifest: "\/manifest\.json\?v=4"/);
  assert.match(layout, /url: "\/pwa\/icon\/192"/);
  assert.match(layout, /url: "\/pwa\/icon\/512"/);
});

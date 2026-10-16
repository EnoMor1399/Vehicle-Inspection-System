export type InstallPlatform = "ios" | "android" | "windows" | "macos" | "linux" | "other";
export type InstallBrowser = "edge" | "chrome" | "safari" | "firefox" | "other";

export function detectInstallPlatform(input: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}): InstallPlatform {
  const ua = input.userAgent || "";
  const platform = input.platform || "";

  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";

  // Modern iPadOS can identify itself as Macintosh while still exposing touch points.
  if (/Mac/i.test(platform) && (input.maxTouchPoints || 0) > 1) return "ios";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua)) return "macos";
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return "linux";

  return "other";
}

export function detectInstallBrowser(userAgent: string): InstallBrowser {
  const ua = userAgent || "";
  if (/Edg\//i.test(ua)) return "edge";
  if (/CriOS|Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "chrome";
  if (/Firefox\//i.test(ua) || /FxiOS/i.test(ua)) return "firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/CriOS/i.test(ua) && !/Edg\//i.test(ua)) return "safari";
  return "other";
}

export function installPlatformLabel(platform: InstallPlatform) {
  const labels: Record<InstallPlatform, string> = {
    ios: "iPhone / iPad",
    android: "Android",
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    other: "This device",
  };
  return labels[platform];
}

export function installBrowserLabel(browser: InstallBrowser) {
  const labels: Record<InstallBrowser, string> = {
    edge: "Microsoft Edge",
    chrome: "Google Chrome",
    safari: "Safari",
    firefox: "Firefox",
    other: "your browser",
  };
  return labels[browser];
}

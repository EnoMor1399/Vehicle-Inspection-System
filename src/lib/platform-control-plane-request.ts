// The platform control plane is always authorized by the original login
// identity, never by a subscriber-scoped operational capability.
export function isPlatformControlPlaneRequest(path: string | null, method: string | null): boolean {
  return Boolean(
    path && path.startsWith("/platform/")
      && path !== "/platform/operations-expired"
      && ["GET", "HEAD", "POST"].includes(method || "")
  );
}

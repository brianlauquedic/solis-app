/**
 * Client-side device fingerprint utility.
 * Generates a stable UUID stored in localStorage.
 * Used as X-Device-ID header to identify same-browser-across-sessions.
 *
 * Call from useEffect or event handlers (not during SSR).
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("solis_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("solis_device_id", id);
  }
  return id;
}

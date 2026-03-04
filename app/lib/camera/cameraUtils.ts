/**
 * Shared camera utilities — constraint negotiation and error handling
 * for getUserMedia across desktop and mobile browsers.
 */

/** Wrap a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DOMException(
        `Camera request timed out after ${ms / 1000}s.`,
        "TimeoutError",
      ));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Progressive constraint tiers for getUserMedia. */
const CONSTRAINT_TIERS: MediaStreamConstraints[] = [
  // Tier 1: ideal resolution + front camera
  { video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }, audio: false },
  // Tier 2: just front camera (let browser pick resolution)
  { video: { facingMode: "user" }, audio: false },
  // Tier 3: any camera at all (covers older Android WebView)
  { video: true, audio: false },
];

/**
 * Attempt getUserMedia with progressive constraint fallback.
 * Stops immediately on NotAllowedError (user denied).
 * Falls through tiers on OverconstrainedError / NotFoundError.
 */
export async function getUserMediaWithFallback(): Promise<MediaStream> {
  // HTTPS check — getUserMedia requires secure context on mobile
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    throw new DOMException(
      "Camera access requires a secure (HTTPS) connection.",
      "SecurityError",
    );
  }

  let lastError: Error | null = null;

  for (const constraints of CONSTRAINT_TIERS) {
    try {
      return await withTimeout(
        navigator.mediaDevices.getUserMedia(constraints),
        10_000,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // User denied — no point trying other tiers
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        throw err;
      }
      // OverconstrainedError / NotFoundError / NotReadableError — try next tier
    }
  }

  throw lastError || new Error("Could not access camera");
}

/** Return a user-friendly error message for camera failures. */
export function getCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Camera access was denied. Please allow camera permissions in your browser settings and try again.";
      case "NotFoundError":
        return "No camera found on this device. Please connect a camera and try again.";
      case "NotReadableError":
        return "Camera is in use by another app. Please close other apps using the camera and try again.";
      case "OverconstrainedError":
        return "Camera doesn't support the required settings. Please try a different browser.";
      case "SecurityError":
        return "Camera access requires HTTPS. Please access this site via a secure (https://) connection.";
      case "TimeoutError":
        return "Camera took too long to respond. Please close other apps using the camera and try again.";
      default:
        return `Camera error: ${err.message}`;
    }
  }
  return `Camera error: ${err instanceof Error ? err.message : String(err)}`;
}

"use client";

/**
 * SealStampOverlay — the visual "finality" moment.
 *
 * When an intent signs successfully, this full-screen overlay plays a
 * short (~1.4s) sequence that anchors the psychological finality of
 * the on-chain commitment:
 *
 *   1. Background: brief radial dim + vermillion flash
 *   2. The existing <SakuraSeal/> falls from above with gravity +
 *      overshoot bounce, lands center-screen with a slight impact scale
 *   3. A concentric ring expands outward from the seal edge (shock-wave)
 *   4. Haptic pulse on devices that support Web Vibration API
 *   5. Auto-dismisses after ~2.2s so the signer UI below remains usable
 *
 * The seal artwork itself is NOT modified — this is purely a wrapper
 * that animates the existing <SakuraSeal/> component.
 *
 * Usage:
 *   <SealStampOverlay show={status.kind === "success"} onDone={...} />
 */

import { useEffect, useRef } from "react";
import SakuraSeal from "@/components/SakuraSeal";

interface SealStampOverlayProps {
  /** When true, the overlay plays its sequence. Toggle to re-trigger. */
  show: boolean;
  /** Called ~2.2s after `show` turns true, when the overlay auto-dismisses. */
  onDone?: () => void;
  /** Skip animation (e.g. `?noStamp=true` query param for screen recording). */
  disabled?: boolean;
}

export default function SealStampOverlay({
  show,
  onDone,
  disabled = false,
}: SealStampOverlayProps) {
  // Keep a fresh ref to `onDone` without putting it in the main effect's
  // dependency list — otherwise a new inline arrow from the parent would
  // restart the animation timer. Canonical React docs pattern: update
  // the ref in its own effect, read via `.current` inside handlers.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!show || disabled) return;

    // Haptic pulse — short-tap-short. No-op on desktop / unsupported.
    // Non-blocking; wrapped in try/catch because some browsers throw
    // on calling vibrate() without a user gesture.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([40, 30, 60]);
      } catch {
        /* silently ignore */
      }
    }

    // Auto-dismiss after the animation sequence completes.
    const t = setTimeout(() => {
      onDoneRef.current?.();
    }, 2200);

    return () => clearTimeout(t);
  }, [show, disabled]);

  if (!show || disabled) return null;

  return (
    <div
      className="seal-stamp-overlay"
      aria-hidden="true"
      // Use a key derived from `show` so remounts cleanly reset the
      // animation if the caller toggles show off→on rapidly.
    >
      <div className="seal-stamp-flash" />
      <div className="seal-stamp-wrapper">
        <div className="seal-stamp-ring" />
        <div className="seal-stamp-drop">
          <SakuraSeal size={320} animate={false} />
        </div>
      </div>
    </div>
  );
}

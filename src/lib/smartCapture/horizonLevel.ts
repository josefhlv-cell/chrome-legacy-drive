// Smart Capture — Gyroscope horizon leveling
// Computes the device ROLL relative to the current screen orientation, so the
// correction works identically in portrait and in landscape (phone rotated).
// Caller applies CSS `transform: rotate(${-angle}deg)` to the preview.
// On iOS, requestPermission must be triggered by a user gesture.

export interface HorizonController {
  start: () => Promise<boolean>;
  stop: () => void;
  isSupported: boolean;
}

const DEG = 180 / Math.PI;

function screenAngle(): number {
  const so = (window.screen as unknown as { orientation?: { angle?: number } })?.orientation;
  if (typeof so?.angle === "number") return so.angle;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

function normalize(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function createHorizonController(onAngle: (deg: number) => void): HorizonController {
  const supported = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  let attached = false;
  let raf = 0;
  let smoothed = 0;
  let initialized = false;

  const handler = (e: DeviceOrientationEvent) => {
    if (e.beta === null && e.gamma === null) return;
    const beta = (e.beta ?? 0) / DEG;   // front-back tilt
    const gamma = (e.gamma ?? 0) / DEG; // left-right tilt

    // Gravity vector projected onto the device screen plane.
    const gx = -Math.cos(beta) * Math.sin(gamma);
    const gy = -Math.sin(beta);

    // If the phone lies (nearly) flat, roll is undefined and jitters wildly —
    // hold the last angle instead of fighting the noise.
    if (Math.hypot(gx, gy) < 0.25) return;

    // Roll relative to the screen's current orientation (0 / 90 / 180 / -90).
    const rawRoll = Math.atan2(gx, gy) * DEG;
    let roll = normalize(rawRoll - screenAngle());

    // Clamp: gentle leveling only, never fight a deliberate rotation.
    roll = Math.max(-15, Math.min(15, roll));

    // Dead zone — below ~1.2° people don't see the tilt, but they DO see jitter.
    if (Math.abs(roll) < 1.2) roll = 0;

    smoothed = initialized ? smoothed * 0.85 + roll * 0.15 : roll;
    initialized = true;

    const out = Math.abs(smoothed) < 0.4 ? 0 : smoothed;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; onAngle(out); });
  };

  const reset = () => { smoothed = 0; initialized = false; onAngle(0); };

  return {
    isSupported: supported,
    start: async () => {
      if (!supported) return false;
      const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (D?.requestPermission) {
        try {
          const res = await D.requestPermission();
          if (res !== "granted") return false;
        } catch { return false; }
      }
      if (!attached) {
        window.addEventListener("deviceorientation", handler, true);
        window.addEventListener("orientationchange", reset);
        (window.screen as unknown as { orientation?: EventTarget })?.orientation?.addEventListener?.("change", reset);
        attached = true;
      }
      return true;
    },
    stop: () => {
      if (attached) {
        window.removeEventListener("deviceorientation", handler, true);
        window.removeEventListener("orientationchange", reset);
        (window.screen as unknown as { orientation?: EventTarget })?.orientation?.removeEventListener?.("change", reset);
        attached = false;
      }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      smoothed = 0; initialized = false;
    },
  };
}

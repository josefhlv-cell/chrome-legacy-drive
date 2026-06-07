// Smart Capture — Gyroscope horizon leveling
// Subscribes to DeviceOrientation events and exposes a tilt angle (degrees).
// Caller can apply CSS `transform: rotate(${-angle}deg)` to the preview.
// On iOS, requestPermission must be triggered by a user gesture.

export interface HorizonController {
  start: () => Promise<boolean>;
  stop: () => void;
  isSupported: boolean;
}

export function createHorizonController(onAngle: (deg: number) => void): HorizonController {
  const supported = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  let attached = false;
  let raf = 0;
  let lastAngle = 0;

  const handler = (e: DeviceOrientationEvent) => {
    // gamma: left-right tilt (-90..90). Use as horizon roll for landscape preview.
    // beta: front-back tilt. We blend lightly so portrait phones still get correction.
    const gamma = e.gamma ?? 0;
    // Clamp to ±20° — we don't want to fight aggressive rotation, just gentle leveling
    const angle = Math.max(-20, Math.min(20, gamma));
    // Low-pass smoothing
    lastAngle = lastAngle * 0.8 + angle * 0.2;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; onAngle(lastAngle); });
  };

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
      if (!attached) { window.addEventListener("deviceorientation", handler, true); attached = true; }
      return true;
    },
    stop: () => {
      if (attached) { window.removeEventListener("deviceorientation", handler, true); attached = false; }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
  };
}

// Detects a phone physically held sideways while the page stays portrait
// (iOS/Android rotation lock). The camera then delivers a portrait frame with
// the car lying on its side, so the still must be turned by a quarter.

/** -1 = rotate the photo 90° counter-clockwise, 1 = clockwise, 0 = keep. */
export type QuarterTurn = -1 | 0 | 1;

export function quarterTurnFromTilt(beta: number | null, gamma: number | null, screenAngle: number): QuarterTurn {
  if (beta === null || gamma === null) return 0;
  // The UI already rotated with the phone: the video frame is landscape.
  if (((screenAngle % 360) + 360) % 360 !== 0) return 0;
  const b = (beta * Math.PI) / 180, g = (gamma * Math.PI) / 180;
  const gx = -Math.cos(b) * Math.sin(g);
  const gy = -Math.sin(b);
  if (Math.abs(gx) < 0.55 || Math.abs(gx) < Math.abs(gy) * 1.4) return 0;
  // gx > 0: top of the phone points left, sky is on the photo's right side.
  return gx > 0 ? -1 : 1;
}

function screenAngle(): number {
  const so = (window.screen as unknown as { orientation?: { angle?: number } })?.orientation;
  if (typeof so?.angle === "number") return so.angle;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

let last: { beta: number | null; gamma: number | null } = { beta: null, gamma: null };
let listening = false;
const onOrientation = (e: DeviceOrientationEvent) => { last = { beta: e.beta, gamma: e.gamma }; };

/** Starts listening; on iOS call from a user gesture to obtain the permission. */
export function watchDeviceTurn(): void {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (D?.requestPermission) void D.requestPermission().catch(() => undefined);
  if (!listening) { window.addEventListener("deviceorientation", onOrientation, true); listening = true; }
}

export function currentQuarterTurn(): QuarterTurn {
  if (typeof window === "undefined") return 0;
  return quarterTurnFromTilt(last.beta, last.gamma, screenAngle());
}

/** Rotates a JPEG by a quarter turn (losslessly in geometry, re-encoded at q 0.92). */
export async function rotateJpeg(blob: Blob, turn: QuarterTurn): Promise<Blob> {
  if (!turn) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.height; canvas.height = bitmap.width;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turn * Math.PI) / 2);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Otočení se nepodařilo."))), "image/jpeg", 0.92));
  } finally { bitmap.close(); }
}

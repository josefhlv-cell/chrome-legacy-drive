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

/** Physical sideways tilt, ignoring whether the page UI rotated. */
export function currentPhysicalTurn(): QuarterTurn {
  return quarterTurnFromTilt(last.beta, last.gamma, 0);
}

/**
 * iOS keeps delivering portrait camera frames after the UI rotates, so decide
 * from the real still: rotate only a portrait frame taken with a sideways phone.
 */
export function turnForStill(physical: QuarterTurn, width: number, height: number): QuarterTurn {
  return physical && height > width ? physical : 0;
}

/** Rotates a JPEG by a quarter turn (losslessly in geometry, re-encoded at q 0.92). */
/** Long side of every catalogue photo (matches the 3200×2400 listing standard). */
export const LISTING_LONG_SIDE = 3200;

/** Output size after a quarter turn, scaled down (never up) to the listing long side. */
export function fittedSize(width: number, height: number, turn: QuarterTurn, maxLong = LISTING_LONG_SIDE) {
  const [w, h] = turn % 2 ? [height, width] : [width, height];
  const scale = Math.min(1, maxLong / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
}

/** Rotates by a quarter turn and fits the photo to the listing resolution in one pass. */
export async function rotateJpeg(blob: Blob, turn: QuarterTurn, maxLong = LISTING_LONG_SIDE): Promise<Blob> {
  return (await fitJpeg(blob, () => turn, maxLong)).blob;
}

/** Decode EXIF once, rotate/resize once, and report actual upload dimensions. */
export async function fitJpeg(blob: Blob, resolveTurn: (bitmap: ImageBitmap) => QuarterTurn, maxLong = LISTING_LONG_SIDE): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const turn = resolveTurn(bitmap);
    const out = fittedSize(bitmap.width, bitmap.height, turn, maxLong);
    if (!turn && out.scale === 1) return { blob, width: out.width, height: out.height };
    const canvas = document.createElement("canvas");
    canvas.width = out.width; canvas.height = out.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Fotografii se nepodařilo otočit a zmenšit. Zkuste odeslání znovu.");
    ctx.imageSmoothingQuality = "high";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turn * Math.PI) / 2);
    ctx.scale(out.scale, out.scale);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    const resized = await new Promise<Blob>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Úprava fotografie trvá příliš dlouho. Zkuste odeslání znovu.")), 15000);
      canvas.toBlob(b => {
        clearTimeout(timeout);
        b ? resolve(b) : reject(new Error("Otočení se nepodařilo."));
      }, "image/jpeg", 0.92);
    });
    return { blob: resized, width: out.width, height: out.height };
  } finally { bitmap.close(); }
}

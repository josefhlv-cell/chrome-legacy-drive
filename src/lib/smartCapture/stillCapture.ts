import { inscribedSize } from "./captureMath";
import { CAPTURE_BG_URL, composePhotoOnBackground } from "./thumbnail";

const BG_PREF_KEY = "capture-show-background";

function backgroundEnabled(): boolean {
  try {
    return localStorage.getItem(BG_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

type PhotoCapture = {
  takePhoto?: () => Promise<Blob>;
  grabFrame?: () => Promise<ImageBitmap>;
};

function imageCapture(track: MediaStreamTrack): PhotoCapture | null {
  const Ctor = (globalThis as { ImageCapture?: new (track: MediaStreamTrack) => PhotoCapture }).ImageCapture;
  if (!Ctor) return null;
  try { return new Ctor(track); } catch { return null; }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Draws the full sensor frame. Rotation crops only the empty corners. */
export async function jpegFromSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  mirror: boolean,
  levelDegrees: number,
): Promise<Blob> {
  const angle = Math.abs(levelDegrees) >= 0.8 ? levelDegrees : 0;
  const crop = angle ? inscribedSize(width, height, angle) : { width, height };
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Snímek se nevytvořil.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (angle || mirror) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (angle) ctx.rotate((-angle * Math.PI) / 180);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
  } else {
    ctx.drawImage(source, 0, 0, width, height);
  }
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Snímek se nevytvořil."))),
      "image/jpeg",
      0.92,
    );
  });
}

async function maybeComposeBackground(blob: Blob): Promise<Blob> {
  if (!backgroundEnabled()) return blob;
  try {
    return await composePhotoOnBackground(blob, CAPTURE_BG_URL);
  } catch {
    // Snímek bez pozadí je lepší než ztráta foťáku.
    return blob;
  }
}

/**
 * Full camera still.
 * ImageCapture.takePhoto() is the sensor photo (not the letterboxed preview).
 * The video frame is only a fallback, still at videoWidth × videoHeight.
 * An untouched JPEG is returned when no mirror or leveling is required.
 * When showroom background is enabled (localStorage), the still is composed onto it.
 */
export async function captureFullStill(args: {
  video: HTMLVideoElement;
  stream: MediaStream;
  mirror: boolean;
  levelDegrees: number;
}): Promise<Blob> {
  const track = args.stream.getVideoTracks()[0];
  const capture = track && track.readyState === "live" ? imageCapture(track) : null;
  const level = Math.abs(args.levelDegrees) >= 0.8;

  if (capture?.takePhoto) {
    try {
      const photo = await withTimeout(capture.takePhoto(), 8000);
      if (photo && photo.size > 8000) {
        if (!args.mirror && !level) return maybeComposeBackground(photo);
        const bitmap = await createImageBitmap(photo);
        try {
          const framed = await jpegFromSource(bitmap, bitmap.width, bitmap.height, args.mirror, args.levelDegrees);
          return maybeComposeBackground(framed);
        } finally { bitmap.close(); }
      }
    } catch { /* The preview frame is still a full video frame, not a screen crop. */ }
  }

  if (capture?.grabFrame) {
    try {
      const frame = await withTimeout(capture.grabFrame(), 4000);
      try {
        const framed = await jpegFromSource(frame, frame.width, frame.height, args.mirror, args.levelDegrees);
        return maybeComposeBackground(framed);
      } finally { frame.close(); }
    } catch { /* video element */ }
  }

  const width = args.video.videoWidth;
  const height = args.video.videoHeight;
  if (!width || !height) throw new Error("Kamera ještě nemá obraz. Zkuste spoušť znovu.");
  const framed = await jpegFromSource(args.video, width, height, args.mirror, args.levelDegrees);
  return maybeComposeBackground(framed);
}

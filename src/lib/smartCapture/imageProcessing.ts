// Smart Capture — deterministic, non-destructive dealer photo processing.
// The original camera blob is always uploaded separately and never modified.

export interface ProcessOptions {
  brightness?: number;       // -100..100
  contrast?: number;         // -100..100
  saturation?: number;       // -100..100
  sharpen?: boolean;
  autoExposure?: boolean;
  autoWhiteBalance?: boolean;
  toneBalance?: boolean;
  maxWidth?: number;
  quality?: number;
}

const DEFAULTS: Required<ProcessOptions> = {
  brightness: 0,
  contrast: 5,
  saturation: 2,
  sharpen: false,
  autoExposure: true,
  autoWhiteBalance: true,
  toneBalance: true,
  maxWidth: 3200,
  quality: 0.94,
};

type ImageContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export async function loadImageBitmap(file: File | Blob): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

export async function processImage(
  file: File | Blob,
  opts: ProcessOptions = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const o = { ...DEFAULTS, ...opts };
  const bmp = await loadImageBitmap(file);
  const scale = bmp.width > o.maxWidth ? o.maxWidth / bmp.width : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as ImageContext | null;
  if (!ctx) {
    bmp.close();
    throw new Error("Fotografii se nepodařilo upravit.");
  }

  ctx.filter = `brightness(${1 + o.brightness / 100}) contrast(${1 + o.contrast / 100}) saturate(${1 + o.saturation / 100})`;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  if (o.autoExposure || o.autoWhiteBalance || o.toneBalance) {
    normalizeTones(ctx, w, h, o);
  }
  if (o.sharpen) applySharpen(ctx, w, h, 0.25);

  const blob = "convertToBlob" in canvas
    ? await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality: o.quality })
    : await new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          result => result ? resolve(result) : reject(new Error("Fotografii se nepodařilo exportovat.")),
          "image/jpeg",
          o.quality,
        );
      });
  return { blob, width: w, height: h };
}

/**
 * Restrained global correction for consistent dealership galleries.
 * Uses sampled luminance percentiles (not absolute min/max), limits exposure
 * and white-balance changes, and preserves the source pixels outside this
 * derived web image. It deliberately avoids aggressive HDR/local relighting.
 */
function normalizeTones(ctx: ImageContext, w: number, h: number, options: Required<ProcessOptions>) {
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const histogram = new Uint32Array(256);
  let rSum = 0, gSum = 0, bSum = 0, samples = 0;
  const stride = Math.max(4, Math.floor((w * h) / 50000) * 4);

  for (let i = 0; i < data.length; i += stride) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
    histogram[y]++;
    rSum += r; gSum += g; bSum += b; samples++;
  }

  let low = 0, high = 255;
  if (options.autoExposure) {
    const total = samples;
    const lowTarget = total * 0.03;
    const highTarget = total * 0.97;
    let cumulative = 0;
    for (let i = 0; i < 256; i++) {
      cumulative += histogram[i];
      if (cumulative >= lowTarget) { low = i; break; }
    }
    cumulative = 0;
    for (let i = 0; i < 256; i++) {
      cumulative += histogram[i];
      if (cumulative >= highTarget) { high = i; break; }
    }
  }

  // Grey-world white balance, deliberately capped to avoid shifting paint colour.
  let redGain = 1, greenGain = 1, blueGain = 1;
  if (options.autoWhiteBalance && samples) {
    const avgR = rSum / samples, avgG = gSum / samples, avgB = bSum / samples;
    const gray = (avgR + avgG + avgB) / 3;
    const clamp = (v: number) => Math.max(0.97, Math.min(1.03, v));
    redGain = clamp(gray / Math.max(1, avgR));
    greenGain = clamp(gray / Math.max(1, avgG));
    blueGain = clamp(gray / Math.max(1, avgB));
  }

  // Avoid stretching already-good photos. Exposure correction is limited to ±8%.
  const range = Math.max(1, high - low);
  const shouldStretch = options.autoExposure && (low > 10 || high < 245 || range < 225);
  const exposureScale = shouldStretch ? Math.max(0.92, Math.min(1.08, 235 / range)) : 1;
  const exposureOffset = shouldStretch ? Math.max(-8, Math.min(8, 8 - low * exposureScale)) : 0;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * redGain;
    let g = data[i + 1] * greenGain;
    let b = data[i + 2] * blueGain;
    if (shouldStretch) {
      r = r * exposureScale + exposureOffset;
      g = g * exposureScale + exposureOffset;
      b = b * exposureScale + exposureOffset;
    }
    if (options.toneBalance) {
      // Gentle shadow lift/highlight roll-off, avoiding clipped paint reflections.
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const shadow = y < 90 ? (90 - y) / 90 * 3 : 0;
      const highlight = y > 220 ? (y - 220) / 35 * 2 : 0;
      const correction = shadow - highlight;
      r += correction; g += correction; b += correction;
    }
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(image, 0, 0);
}

function applySharpen(ctx: ImageContext, w: number, h: number, amount: number) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data, o = out.data;
  const k = amount;
  const center = 1 + 4 * k;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = s[i + c] * center -
          (s[i - 4 + c] + s[i + 4 + c] + s[i - w * 4 + c] + s[i + w * 4 + c]) * k;
        o[i + c] = Math.max(0, Math.min(255, v));
      }
      o[i + 3] = s[i + 3];
    }
  }
  // Preserve untouched edge pixels.
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = s[i + 3];
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

// Lightweight blur detection (variance of Laplacian, sampled).
export async function computeBlurScore(file: File | Blob): Promise<number> {
  const bmp = await loadImageBitmap(file);
  const W = 200;
  const H = Math.max(1, Math.round(bmp.height * (W / bmp.width)));
  const c = (typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(W, H)
    : Object.assign(document.createElement("canvas"), { width: W, height: H })) as HTMLCanvasElement;
  const ctx = c.getContext("2d");
  if (!ctx) { bmp.close(); return 0; }
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close();
  const { data } = ctx.getImageData(0, 0, W, H);
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      const c0 = data[i] + data[i + 1] + data[i + 2];
      const cL = data[i - 4] + data[i - 3] + data[i - 2];
      const cR = data[i + 4] + data[i + 5] + data[i + 6];
      const cU = data[i - W * 4] + data[i - W * 4 + 1] + data[i - W * 4 + 2];
      const cD = data[i + W * 4] + data[i + W * 4 + 1] + data[i + W * 4 + 2];
      const lap = cL + cR + cU + cD - 4 * c0;
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (!n) return 0;
  const variance = sumSq / n - (sum / n) ** 2;
  return Math.max(0, Math.min(100, Math.round(Math.log10(Math.max(1, variance)) * 25)));
}

export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

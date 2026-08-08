// Smart Capture — client-side image processing (canvas)
// Premium dealer look: jemně zvýšený kontrast + sharpen + auto exposure
// Non-destructive: vrací nový Blob, originál se vždy ukládá zvlášť

export interface ProcessOptions {
  brightness?: number;       // -100..100 (default auto)
  contrast?: number;         // -100..100
  saturation?: number;       // -100..100
  sharpen?: boolean;
  autoExposure?: boolean;
  maxWidth?: number;         // resize
  quality?: number;          // 0..1 JPEG
}

const DEFAULTS: Required<ProcessOptions> = {
  brightness: 0,
  contrast: 8,
  saturation: 6,
  sharpen: false,        // drahá 3x3 konvoluce — vypnuto kvůli rychlosti
  autoExposure: false,   // getImageData je drahý — vypnuto kvůli rychlosti
  maxWidth: 3200,        // vysoké rozlišení pro web, showroom i A4 tisk
  quality: 0.92,         // nízká komprese — bez viditelných artefaktů
};


export async function loadImageBitmap(file: File | Blob): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

export async function processImage(file: File | Blob, opts: ProcessOptions = {}): Promise<{ blob: Blob; width: number; height: number; }>{
  const o = { ...DEFAULTS, ...opts };
  const bmp = await loadImageBitmap(file);

  const scale = bmp.width > o.maxWidth ? o.maxWidth / bmp.width : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);

  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = (canvas as HTMLCanvasElement).getContext
    ? (canvas as HTMLCanvasElement).getContext("2d", { willReadFrequently: false })!
    : (canvas as OffscreenCanvas).getContext("2d")!;

  // ⚡ Single-pass: filtr aplikován při draw, žádný temp canvas
  if (o.brightness !== 0 || o.contrast !== 0 || o.saturation !== 0) {
    (ctx as CanvasRenderingContext2D).filter =
      `brightness(${1 + o.brightness / 100}) contrast(${1 + o.contrast / 100}) saturate(${1 + o.saturation / 100})`;
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  if (o.autoExposure) autoExposure(ctx, w, h);
  if (o.sharpen) applySharpen(ctx, w, h, 0.35);

  const blob = "convertToBlob" in canvas
    ? await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality: o.quality })
    : await new Promise<Blob>((res) => (canvas as HTMLCanvasElement).toBlob((b) => res(b!), "image/jpeg", o.quality));

  return { blob, width: w, height: h };
}

function autoExposure(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Compute luminance min/max (sample every 8th pixel for speed)
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 32) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (y < min) min = y;
    if (y > max) max = y;
  }
  if (max - min < 220 && max > min) {
    const range = max - min;
    const scale = 230 / range;
    const offset = -min * scale + 12;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, d[i] * scale + offset));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * scale + offset));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * scale + offset));
    }
    ctx.putImageData(img, 0, 0);
  }
}

function applySharpen(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number, amount: number) {
  // Lightweight unsharp mask via 3x3 convolution
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data, o = out.data;
  const k = amount;
  const center = 1 + 4 * k;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          s[i + c] * center -
          (s[i - 4 + c] + s[i + 4 + c] + s[i - w * 4 + c] + s[i + w * 4 + c]) * k;
        o[i + c] = Math.max(0, Math.min(255, v));
      }
      o[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

// Lightweight blur detection (variance of Laplacian, sampled)
export async function computeBlurScore(file: File | Blob): Promise<number> {
  const bmp = await loadImageBitmap(file);
  const W = 200;
  const H = Math.round(bmp.height * (W / bmp.width));
  const c = (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H })) as HTMLCanvasElement;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, W, H);
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
      const lap = (cL + cR + cU + cD - 4 * c0);
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  const variance = sumSq / n - (sum / n) ** 2;
  // 0 (very blurry) → 100 (sharp). Empirical scaling.
  return Math.max(0, Math.min(100, Math.round(Math.log10(Math.max(1, variance)) * 25)));
}

export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      res(url.split(",")[1] ?? "");
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

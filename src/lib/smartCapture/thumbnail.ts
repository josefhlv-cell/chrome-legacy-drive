/**
 * Smart Capture — "miniatura na přednastaveném pozadí".
 *
 * Uživatel vidí při focení prvního záběru vložené pozadí (overlay v hledáčku)
 * a vyfotí do něj vozidlo. Výsledná fotka se pak deterministicky složí na
 * TOTOŽNÉ pozadí (žádné AI generování pozadí) a použije se POUZE jako
 * miniatura v nabídce vozů — v detailu vozidla se nezobrazuje.
 */
import captureBg from "@/assets/capture-bg.jpg.asset.json";

export const CAPTURE_BG_URL = captureBg.url;

/** Výstupní rozměr miniatury (16:9, shodné s masterem pozadí). */
export const THUMB_W = 1600;
export const THUMB_H = 900;

/** Deterministická geometrie umístění vozidla na pozadí. */
export const THUMB_PLACEMENT = {
  /** Podíl šířky plátna, kterou vozidlo zaplní. */
  widthRatio: 0.74,
  /** Maximální podíl výšky plátna. */
  maxHeightRatio: 0.60,
  /** Kde leží kola (podíl výšky) — asfalt, ne zeď. */
  wheelLineRatio: 0.895,
  /** Vodorovný středový bod. */
  centerXRatio: 0.5,
} as const;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Obrázek se nepodařilo načíst: ${src}`));
    img.src = src;
  });

const blobToImage = async (blob: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(blob);
  try { return await loadImage(url); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
};

/** Ořízne prázdné (plně transparentní) okraje PNG výřezu. */
const trimAlpha = (img: HTMLImageElement) => {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { canvas: c, x: 0, y: 0, w: c.width, h: c.height };
  return { canvas: c, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", quality));

/**
 * Složí miniaturu: pozadí (fixní asset) + výřez vozidla (PNG s alfou),
 * včetně kontaktního stínu. Pokud výřez není k dispozici, vrátí null.
 */
export const composeThumbnail = async (cutoutPng: Blob): Promise<Blob> => {
  const [bg, cutRaw] = await Promise.all([loadImage(CAPTURE_BG_URL), blobToImage(cutoutPng)]);
  const trimmed = trimAlpha(cutRaw);

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_W; canvas.height = THUMB_H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0, THUMB_W, THUMB_H);

  const p = THUMB_PLACEMENT;
  let targetW = THUMB_W * p.widthRatio;
  let targetH = targetW * (trimmed.h / trimmed.w);
  const maxH = THUMB_H * p.maxHeightRatio;
  if (targetH > maxH) { targetH = maxH; targetW = targetH * (trimmed.w / trimmed.h); }

  const baseline = THUMB_H * p.wheelLineRatio;
  const dx = THUMB_W * p.centerXRatio - targetW / 2;
  const dy = baseline - targetH;

  // Kontaktní stín pod koly — elipsa, měkký přechod, žádné AI.
  const shadowH = targetH * 0.10;
  const grad = ctx.createRadialGradient(
    dx + targetW / 2, baseline, 1,
    dx + targetW / 2, baseline, targetW * 0.52,
  );
  grad.addColorStop(0, "rgba(0,0,0,0.42)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.16)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(dx + targetW / 2, baseline);
  ctx.scale(1, shadowH / (targetW * 0.52));
  ctx.fillStyle = grad;
  ctx.translate(-(dx + targetW / 2), -baseline);
  ctx.beginPath();
  ctx.arc(dx + targetW / 2, baseline, targetW * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(trimmed.canvas, trimmed.x, trimmed.y, trimmed.w, trimmed.h, dx, dy, targetW, targetH);

  // Cíl do ~350 kB — miniatura v katalogu nemusí být větší.
  for (const q of [0.9, 0.82, 0.72, 0.6]) {
    const out = await canvasToJpeg(canvas, q);
    if (out.size <= 350_000 || q === 0.6) return out;
  }
  return await canvasToJpeg(canvas, 0.6);
};

/** Fallback: fotku jen normalizuje do 16:9 miniatury (bez výřezu). */
export const frameToThumbnail = async (frame: Blob): Promise<Blob> => {
  const img = await blobToImage(frame);
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_W; canvas.height = THUMB_H;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(THUMB_W / img.naturalWidth, THUMB_H / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  ctx.drawImage(img, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h);
  return await canvasToJpeg(canvas, 0.85);
};

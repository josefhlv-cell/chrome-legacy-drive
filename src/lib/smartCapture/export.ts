// ⚡ JSZip se načítá až při exportu (lazy) — nezdržuje start Smart Capture.
import { type ShotType } from "./types";

export interface ExportPhoto {
  shotType: ShotType;
  originalBlob?: Blob;
  processedBlob?: Blob;
  originalUrl?: string;
  processedUrl?: string;
  index: number;
  /** Skutečné datum pořízení fotografie (ISO). Použije se v názvu souboru. */
  capturedAt?: string | null;
}

/**
 * Název fotografie v ZIP exportu:
 *   POŘADÍ_ZNAČKA_MODEL_ROK_BARVA_DATUM.jpg
 * např. 01_CHRYSLER_PACIFICA_2022_GRANITE_CRYSTAL_2026-09-03.jpg
 *
 * PROČ: obchodník potřebuje z názvu okamžitě poznat vůz i den fotografování,
 * aniž by otevíral složku. Fotky samotné (kvalita, rozlišení, komprese)
 * se tímto nijak nemění — přejmenovává se pouze při exportu.
 */
const asciiToken = (value?: string | number | null): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isoDate = (value?: string | null): string => {
  const d = value ? new Date(value) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
};

export function buildPhotoFileName(
  photo: ExportPhoto,
  info: VehicleInfo,
): string {
  const order = String(photo.index + 1).padStart(2, "0");
  const parts = [
    order,
    asciiToken(info.brand) || "VOZIDLO",
    asciiToken(info.model) || "MODEL",
    asciiToken(info.year),
    asciiToken(info.color),
    isoDate(photo.capturedAt),
  ].filter(Boolean);
  return `${parts.join("_")}.jpg`;
}

export interface VehicleInfo {
  brand: string;
  model: string;
  year?: string | number;
  vin?: string;
  mileage?: string | number;
  price?: string | number;
  fuel?: string;
  transmission?: string;
  color?: string;
  power?: string;
  description?: string;
}

async function urlToBlob(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

/**
 * Re-encode an image blob to a JPEG with target max long side / quality
 * and (when targetMaxBytes is provided) iteratively lower quality so the
 * resulting file size stays under the limit (used for "inzertní" 1MB cap).
 */
async function reencodeJpeg(
  src: Blob,
  opts: {
    maxLongSide: number;
    quality: number;
    targetMaxBytes?: number;
  },
): Promise<Blob> {
  const bmp = await createImageBitmap(src);

  const renderAt = async (
    longSide: number,
    quality: number,
  ): Promise<Blob> => {
    const scale = Math.min(
      1,
      longSide / Math.max(bmp.width, bmp.height),
    );

    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), {
            width: w,
            height: h,
          });

    const ctx = (canvas as HTMLCanvasElement).getContext("2d")!;

    ctx.drawImage(bmp, 0, 0, w, h);

    if (canvas instanceof OffscreenCanvas) {
      return await canvas.convertToBlob({
        type: "image/jpeg",
        quality,
      });
    }

    return await new Promise<Blob>((res) =>
      (canvas as HTMLCanvasElement).toBlob(
        (b) => res(b!),
        "image/jpeg",
        quality,
      ),
    );
  };

  let longSide = opts.maxLongSide;
  let q = opts.quality;

  let blob = await renderAt(longSide, q);

  if (opts.targetMaxBytes) {
    // Step 1: lower quality
    while (blob.size > opts.targetMaxBytes && q > 0.45) {
      q -= 0.07;
      blob = await renderAt(longSide, q);
    }

    // Step 2: if still over, shrink dimensions in 15% steps
    // (guarantees ≤ target)
    while (blob.size > opts.targetMaxBytes && longSide > 800) {
      longSide = Math.round(longSide * 0.85);
      q = Math.max(q, 0.7);

      blob = await renderAt(longSide, q);

      while (blob.size > opts.targetMaxBytes && q > 0.45) {
        q -= 0.07;
        blob = await renderAt(longSide, q);
      }
    }
  }

  return blob;
}

function buildInfoTxt(
  info: VehicleInfo,
  photoCount: number,
): string {
  const line = (k: string, v?: string | number) =>
    v !== undefined &&
    v !== null &&
    String(v).trim() !== ""
      ? `${k}: ${v}\n`
      : "";

  const date = new Date().toLocaleString("cs-CZ");

  let out = "";

  out += "================================================\n";
  out += "  CHRYSLER & DODGE PARDUBICE — VOZIDLO\n";
  out += "================================================\n\n";

  out += line("Značka", info.brand);
  out += line("Model", info.model);
  out += line("Rok", info.year);
  out += line("VIN", info.vin);
  out += line("Najezd (km)", info.mileage);
  out += line("Cena", info.price);
  out += line("Palivo", info.fuel);
  out += line("Převodovka", info.transmission);
  out += line("Barva", info.color);
  out += line("Výkon", info.power);

  out += "\n------------------------------------------------\n";
  out += "POPIS VOZIDLA\n";
  out += "------------------------------------------------\n";

  out += (info.description?.trim() || "(bez popisu)") + "\n\n";

  out += "------------------------------------------------\n";
  out += `Export vytvořen: ${date}\n`;
  out += `Počet fotografií: ${photoCount}\n`;

  out += "Složky v ZIP:\n";
  out += "  /original  — originální fotografie (bez komprese)\n";
  out += "  /inzertni  — JPEG, max 1 MB (pro inzertní portály)\n";
  out += "  /web       — JPEG, malé pro web (~300 KB)\n";

  return out;
}

export async function buildSessionZip(
  photos: ExportPhoto[],
  info: VehicleInfo,
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");

  const zip = new JSZip();

  // Jedno datum pro celý export.
  // Používá se jak pro ZIP složku, tak pro názvy všech fotografií.
  const date = new Date().toISOString().slice(0, 10);

  const safeBrand = (info.brand || "Vozidlo").replace(
    /[^a-zA-Z0-9-]/g,
    "",
  );

  const safeModel = (info.model || "Model").replace(
    /[^a-zA-Z0-9-]/g,
    "",
  );

  const root = zip.folder(
    `${safeBrand}-${safeModel}-${date}`,
  )!;

  const original = root.folder("original")!;
  const inzertni = root.folder("inzertni")!;
  const web = root.folder("web")!;

  for (const p of photos) {
    // POŘADÍ_ZNAČKA_MODEL_ROK_BARVA_DATUM.jpg
    const name = buildPhotoFileName(p, info);

    const orig =
      p.originalBlob ??
      (p.originalUrl
        ? await urlToBlob(p.originalUrl)
        : null);

    if (!orig) continue;

    // 1) Original — beze změny
    original.file(name, orig);

    // 2) Inzertní — max 1 MB
    try {
      const inz = await reencodeJpeg(orig, {
        maxLongSide: 2000,
        quality: 0.85,
        targetMaxBytes: 1024 * 1024,
      });

      inzertni.file(name, inz);
    } catch {
      inzertni.file(name, orig);
    }

    // 3) Web — menší, ~300 KB
    try {
      const w = await reencodeJpeg(orig, {
        maxLongSide: 1280,
        quality: 0.78,
        targetMaxBytes: 350 * 1024,
      });

      web.file(name, w);
    } catch {
      web.file(name, orig);
    }
  }

  // info.txt
  root.file(
    "info.txt",
    buildInfoTxt(info, photos.length),
  );

  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6,
    },
  });
}

export function downloadBlob(
  blob: Blob,
  filename: string,
) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

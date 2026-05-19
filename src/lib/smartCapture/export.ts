import JSZip from "jszip";
import { slugifyShot, type ShotType } from "./types";

export interface ExportPhoto {
  shotType: ShotType;
  originalBlob?: Blob;
  processedBlob?: Blob;
  originalUrl?: string;
  processedUrl?: string;
  index: number;
}

export interface ExportMeta {
  brand: string;
  model: string;
}

async function urlToBlob(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.blob();
  } catch { return null; }
}

export async function buildSessionZip(photos: ExportPhoto[], meta: ExportMeta): Promise<Blob> {
  const zip = new JSZip();
  const date = new Date().toISOString().slice(0, 10);
  const safeBrand = (meta.brand || "Vozidlo").replace(/[^a-zA-Z0-9-]/g, "");
  const safeModel = (meta.model || "Model").replace(/[^a-zA-Z0-9-]/g, "");
  const root = zip.folder(`${safeBrand}-${safeModel}-${date}`)!;
  const original = root.folder("original")!;
  const web = root.folder("web")!;
  const inzerce = root.folder("inzerce")!;

  for (const p of photos) {
    const name = slugifyShot(p.shotType, p.index);
    const orig = p.originalBlob ?? (p.originalUrl ? await urlToBlob(p.originalUrl) : null);
    const proc = p.processedBlob ?? (p.processedUrl ? await urlToBlob(p.processedUrl) : null);
    if (orig) original.file(name, orig);
    if (proc) {
      web.file(name, proc);
      // pro inzerci stejná web verze (procesní pipeline by mohla generovat menší rozlišení)
      inzerce.file(name, proc);
    }
  }

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

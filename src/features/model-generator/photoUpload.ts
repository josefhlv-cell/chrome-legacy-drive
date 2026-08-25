/**
 * photoUpload — validace a příprava fotek pro generátor 3D modelů.
 *
 * Fotku zmenšujeme na 1600 px na dlouhé straně: pro analýzu vzhledu (barva,
 * tmavost skel, kola) je to plně dostačující, ale ušetří to upload i AI tokeny.
 * Originální fotky zůstávají v telefonu / počítači admina.
 */
import { ANALYSIS_MAX_EDGE, MAX_FILE_BYTES, MIN_MEGAPIXELS } from "./photoSlots";

export type ValidationIssue = { level: "error" | "warning"; message: string };

const readImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Soubor není platný obrázek."));
    };
    img.src = url;
  });

/** Odhad rozostření — variance Laplaciánu na zmenšené šedotónové kopii. */
const blurScore = (img: HTMLImageElement): number => {
  const w = 320;
  const h = Math.max(1, Math.round((img.height / img.width) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 999;

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
};

export type PreparedPhoto = {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  issues: ValidationIssue[];
};

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const issues: ValidationIssue[] = [];

  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Podporujeme JPG, PNG a WebP.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Fotka je větší než 12 MB.");
  }

  const img = await readImage(file);
  const megapixels = (img.width * img.height) / 1_000_000;

  if (megapixels < MIN_MEGAPIXELS) {
    issues.push({
      level: "warning",
      message: `Nízké rozlišení (${megapixels.toFixed(1)} MP) — doporučujeme alespoň 4 MP.`,
    });
  }
  if (img.height > img.width) {
    issues.push({ level: "warning", message: "Fotka je na výšku — vozy foťte na šířku." });
  }
  if (blurScore(img) < 40) {
    issues.push({ level: "warning", message: "Fotka vypadá rozostřená nebo v pohybu." });
  }

  const scale = Math.min(1, ANALYSIS_MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Prohlížeč neumí zpracovat obrázek.");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Konverze fotky selhala."))),
      "image/jpeg",
      0.88,
    ),
  );

  return { blob, previewUrl: URL.createObjectURL(blob), width, height, issues };
}

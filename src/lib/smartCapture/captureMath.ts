/** Largest centered, axis-aligned rectangle that stays inside a rotated photo. */
export function inscribedSize(width: number, height: number, degrees: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const angle = Math.abs(degrees) * Math.PI / 180;
  if (angle < 0.004) return { width: Math.round(width), height: Math.round(height) };
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  const widthIsLonger = width >= height;
  const sideLong = widthIsLonger ? width : height;
  const sideShort = widthIsLonger ? height : width;
  let nextWidth: number;
  let nextHeight: number;
  if (sideShort <= 2 * sin * cos * sideLong || Math.abs(sin - cos) < 1e-10) {
    const half = 0.5 * sideShort;
    if (widthIsLonger) {
      nextWidth = half / sin;
      nextHeight = half / cos;
    } else {
      nextWidth = half / cos;
      nextHeight = half / sin;
    }
  } else {
    const cos2 = cos * cos - sin * sin;
    nextWidth = (width * cos - height * sin) / cos2;
    nextHeight = (height * cos - width * sin) / cos2;
  }
  return {
    width: Math.max(1, Math.min(Math.round(width), Math.round(nextWidth))),
    height: Math.max(1, Math.min(Math.round(height), Math.round(nextHeight))),
  };
}

/** VIN without I, O, Q. A leading "VIN" label is ignored. */
export function normalizeVin(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^VIN/, "");
  const exact = compact.match(/[A-HJ-NPR-Z0-9]{17}/);
  if (exact) return exact[0];
  return compact.replace(/[IOQ]/g, "").slice(0, 17);
}

export function vinFromOcr(data: { vin?: string; confidence?: number } | null | undefined): string {
  const vin = normalizeVin(data?.vin ?? "");
  if (vin.length !== 17) return "";
  const confidence = typeof data?.confidence === "number" ? data.confidence : 100;
  if (confidence < 40) return "";
  return vin;
}

export function isVinShot(type: string): boolean {
  return type === "vin-za-oknem" || type === "vin-stitek";
}

export function positiveNumber(value: unknown): number | undefined {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export type CaptureImportMeta = {
  vin?: string;
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  fuel?: string;
  transmission?: string;
  power?: string;
  color?: string;
  description?: string;
};

type InfoFields = {
  brand?: string;
  model?: string;
  year?: string | number;
  vin?: string;
  mileage?: string | number;
  price?: string | number;
  fuel?: string;
  transmission?: string;
  color?: string;
  power?: string;
  description?: string;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** Fields that move from a capture session into a vehicle listing. */
export function captureImportMeta(
  info: InfoFields,
  decoded?: Record<string, unknown> | null,
  sessionVin?: string,
): CaptureImportMeta {
  const source = decoded ?? {};
  const year = positiveNumber(info.year) ?? positiveNumber(source.year);
  return {
    vin: normalizeVin(String(info.vin || sessionVin || "")) || undefined,
    brand: info.brand?.trim() || text(source.make),
    model: info.model?.trim() || text(source.model),
    year: year ? Math.round(year) : undefined,
    mileage: positiveNumber(info.mileage),
    price: positiveNumber(info.price),
    fuel: info.fuel?.trim() || text(source.fuel),
    transmission: info.transmission?.trim() || text(source.transmission),
    power: info.power?.trim() || text(source.power),
    color: info.color?.trim() || text(source.color),
    description: info.description?.trim() || undefined,
  };
}

export function listingName(meta: CaptureImportMeta): string {
  return [meta.brand, meta.model].filter(Boolean).join(" ").trim();
}

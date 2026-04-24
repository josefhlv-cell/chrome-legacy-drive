/**
 * Supabase Storage image optimizer.
 *
 * Rewrites public storage URLs to the on-the-fly render endpoint
 * (https://...supabase.co/storage/v1/render/image/public/...) so we get:
 *   - smaller file sizes (WebP/AVIF, configurable width/quality)
 *   - proper cache-control headers (1h CDN cache vs no-cache on raw object)
 *
 * Non-Supabase URLs (or already-rendered ones) are returned unchanged.
 */

const PUBLIC_OBJECT_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";

export type ImagePreset = "thumb" | "card" | "detail" | "hero" | "print";
export type ImageFormat = "webp" | "avif" | "origin";

const PRESETS: Record<ImagePreset, { width: number; quality: number }> = {
  thumb: { width: 200, quality: 65 },
  card: { width: 800, quality: 72 },
  detail: { width: 1280, quality: 75 },
  hero: { width: 1600, quality: 78 },
  print: { width: 1600, quality: 85 },
};

export const optimizeImage = (
  url: string | null | undefined,
  preset: ImagePreset = "card",
  format: ImageFormat = "webp",
): string => {
  if (!url) return "";
  // Already transformed → leave it
  if (url.includes(RENDER_MARKER)) return url;
  // Not a Supabase public object → leave it (external URLs, blob:, data:)
  if (!url.includes(PUBLIC_OBJECT_MARKER)) return url;

  const { width, quality } = PRESETS[preset];
  const rewritten = url.replace(PUBLIC_OBJECT_MARKER, RENDER_MARKER);
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    // resize=contain → server keeps full image, no crop. UI uses object-contain
    // on a dark background so the entire car is visible regardless of source ratio.
    resize: "contain",
  });
  if (format === "webp") params.set("format", "webp");
  else if (format === "avif") params.set("format", "avif");
  return `${rewritten}?${params.toString()}`;
};

/** Build a srcset with multiple widths for responsive <img>. */
export const buildSrcSet = (
  url: string | null | undefined,
  widths: number[] = [400, 800, 1280],
  quality = 72,
  format: "webp" | "avif" = "webp",
): string => {
  if (!url || !url.includes(PUBLIC_OBJECT_MARKER)) return "";
  const base = url.replace(PUBLIC_OBJECT_MARKER, RENDER_MARKER);
  return widths
    .map(
      (w) =>
        `${base}?width=${w}&quality=${quality}&resize=contain&format=${format} ${w}w`,
    )
    .join(", ");
};

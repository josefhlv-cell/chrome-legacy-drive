/**
 * Deep-link token replacement for CTA URLs.
 * Supports tokens like {vin}, {model}, {category}, {id}, plus tracking_id append.
 *
 * Example:
 *   resolveDeepLink({ external_url: "https://app.example.com/catalog/{vin}", route_params: { vin: "1C4..." }, tracking_id: "spring25" })
 *   → "https://app.example.com/catalog/1C4...?utm_source=chrysler-pardubice&utm_campaign=spring25"
 */
export interface LinkConfig {
  external_url?: string;
  route_params?: Record<string, string>;
  tracking_id?: string;
}

export const resolveDeepLink = (cfg: LinkConfig | null | undefined, fallbackUrl?: string): string => {
  const base = cfg?.external_url?.trim() || fallbackUrl?.trim() || "";
  if (!base) return "";

  let url = base;
  const params = cfg?.route_params || {};
  Object.entries(params).forEach(([k, v]) => {
    url = url.split(`{${k}}`).join(encodeURIComponent(v ?? ""));
  });

  if (cfg?.tracking_id) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}utm_source=chrysler-pardubice&utm_medium=banner&utm_campaign=${encodeURIComponent(cfg.tracking_id)}`;
  }
  return url;
};

export const isExternalUrl = (url: string) => /^https?:\/\//i.test(url);

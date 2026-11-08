// Free, deterministic pre-check that runs BEFORE any paid AI call.
// Smart Capture and admin uploads embed the shot type in the file name
// (e.g. `{session}/{photo}_8_sedacky-zezadu_web.jpg`). Interior, detail and
// VIN shots must never be cut out and placed on the exterior showroom plate.
export const NON_EXTERIOR_TOKENS = [
  "kufr", "sedacky-zezadu", "prava-stredni-sedacka", "prava-predni-sedacka",
  "dvd", "pristrojovka-zprostred", "leva-stredni-sedacka", "zprostred-predek-ridic",
  "dvere-ridic", "km", "stredovy-panel", "vrch-stropnice", "detail-klima", "vin-za-oknem",
  "kola-disky", "motor", "ridicuv-prostor", "predni-sedacky", "druha-rada", "treti-rada",
  "panorama-strop", "vin-stitek", "interier-jine", "detail",
  "interier", "interior", "dashboard", "palubni", "sedadl", "sedack", "cockpit", "trunk",
] as const;

/** Returns the matched token when the URL clearly names a non-exterior shot. */
export function detectNonExteriorShot(url: string): string | null {
  let path = url;
  try { path = new URL(url).pathname; } catch { /* keep raw */ }
  const name = decodeURIComponent(path.split("/").pop() ?? "").toLowerCase();
  const parts = name.replace(/\.[a-z0-9]+$/, "").split(/[_.\s]+/);
  for (const part of parts) {
    if ((NON_EXTERIOR_TOKENS as readonly string[]).includes(part)) return part;
  }
  for (const t of ["interier", "interior", "dashboard", "palubni", "sedadl", "sedack", "cockpit"]) {
    if (name.includes(t)) return t;
  }
  return null;
}

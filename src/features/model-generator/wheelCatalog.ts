/**
 * OEM katalog kol Chrysler Pacifica (Mopar diagram "Hliníkové kolo, přední
 * nebo zadní", MY2017+).
 *
 * PROČ TENHLE SOUBOR EXISTUJE
 * ---------------------------
 * Dřív se disk „hádal“ z volného textu výbavy (`/pinnacle|limited/` →
 * `10spoke`, jinak fallback `default`) a měnil se jen odstín materiálu.
 * Výsledek: dvě stejné Pacifiky měly v AR jiná kola a u části vozů se
 * nepoužil žádný styl. Katalog je proto jediné místo, kde se rozhoduje,
 * JAKÉ kolo daný vůz má — mapování je deterministické (stejný vstup =
 * stejné kolo) a vždy vrátí konkrétní OEM položku, nikdy „nevím“.
 */

export type WheelFinish = "silver" | "polished" | "hyperblack" | "gloss_black" | "steel";

export type WheelSpec = {
  /** Stabilní klíč ukládaný do `vehicle_appearance_profiles.wheel_style`. */
  id: string;
  /** Číslo v Mopar diagramu (1–8). */
  diagram: number;
  label: string;
  /** Průměr v palcích — jen informativní popis pro obsluhu. */
  diameter: 17 | 18 | 20;
  finish: WheelFinish;
};

/** Pořadí odpovídá číslům v oficiálním Mopar nákresu. */
export const WHEEL_CATALOG: WheelSpec[] = [
  { id: "oem_1_5spoke_polished", diagram: 1, label: "1 · 5 ramen, leštěná slitina (17\")", diameter: 17, finish: "polished" },
  { id: "oem_2_5spoke_silver", diagram: 2, label: "2 · 5 dvojramen, stříbrná (17\")", diameter: 17, finish: "silver" },
  { id: "oem_3_multispoke_silver", diagram: 3, label: "3 · Multispoke, stříbrná (18\")", diameter: 18, finish: "silver" },
  { id: "oem_4_20spoke_silver", diagram: 4, label: "4 · Jemná ramena, stříbrná (18\")", diameter: 18, finish: "silver" },
  { id: "oem_5_5spoke_wide", diagram: 5, label: "5 · Široká 5 ramen, leštěná (18\")", diameter: 18, finish: "polished" },
  { id: "oem_6_multispoke_hyperblack", diagram: 6, label: "6 · Multispoke, hyper black (20\")", diameter: 20, finish: "hyperblack" },
  { id: "oem_7_5spoke_black", diagram: 7, label: "7 · 5 ramen, černá lesklá — S Appearance (20\")", diameter: 20, finish: "gloss_black" },
  { id: "oem_8_steel_cover", diagram: 8, label: "8 · Plechové kolo + poklice (17\")", diameter: 17, finish: "steel" },
];

export const DEFAULT_WHEEL_ID = "oem_2_5spoke_silver";

/** Staré klíče z dřívějších profilů → OEM položka (aby nezmizela data). */
const LEGACY_MAP: Record<string, string> = {
  default: DEFAULT_WHEEL_ID,
  "5spoke": "oem_1_5spoke_polished",
  "10spoke": "oem_4_20spoke_silver",
  multispoke: "oem_3_multispoke_silver",
  alloy_dark: "oem_6_multispoke_hyperblack",
  steel_cover: "oem_8_steel_cover",
};

/** Vrátí vždy konkrétní OEM kolo — nikdy `undefined`. */
export const resolveWheel = (value?: string | null): WheelSpec => {
  const key = (value ?? "").trim();
  const direct = WHEEL_CATALOG.find((w) => w.id === key);
  if (direct) return direct;
  const legacy = LEGACY_MAP[key.toLowerCase()];
  const mapped = legacy ? WHEEL_CATALOG.find((w) => w.id === legacy) : undefined;
  return mapped ?? WHEEL_CATALOG.find((w) => w.id === DEFAULT_WHEEL_ID)!;
};

/**
 * Deterministické mapování výbava/VIN → OEM kolo.
 *
 * Pravidla vycházejí z české nabídky Pacifiky:
 *   Pinnacle / Limited          → 20" multispoke hyper black (6)
 *   S Appearance / blackout     → 20" černá 5 ramen (7)
 *   Touring L / Touring Plus    → 18" multispoke stříbrná (3)
 *   Touring                     → 17" 5 dvojramen stříbrná (2)
 *   LX / Voyager                → 17" plech + poklice (8)
 * Bez rozpoznané výbavy se použije 17" stříbrná (2) — základní tovární kolo,
 * takže všechny vozy bez dat mají shodná kola místo náhodných odstínů.
 */
export const wheelFromTrim = (trimText?: string | null): WheelSpec => {
  const t = (trimText ?? "").toLowerCase();

  const pick = (id: string) => WHEEL_CATALOG.find((w) => w.id === id)!;

  if (/\bs appearance\b|blackout|\bs\s*paket\b/.test(t)) return pick("oem_7_5spoke_black");
  if (/pinnacle|limited/.test(t)) return pick("oem_6_multispoke_hyperblack");
  if (/touring\s*(l|plus|l plus)\b/.test(t)) return pick("oem_3_multispoke_silver");
  if (/touring/.test(t)) return pick("oem_2_5spoke_silver");
  if (/\blx\b|voyager/.test(t)) return pick("oem_8_steel_cover");
  return pick(DEFAULT_WHEEL_ID);
};

/** Materiálové parametry disku podle povrchu OEM kola. */
export const wheelMaterial = (
  finish: WheelFinish,
): { hex: string; metalness: number; roughness: number } => {
  switch (finish) {
    case "polished":
      return { hex: "#cdd2d8", metalness: 0.92, roughness: 0.18 };
    case "silver":
      return { hex: "#b9bec5", metalness: 0.85, roughness: 0.3 };
    case "hyperblack":
      return { hex: "#4a4d53", metalness: 0.9, roughness: 0.34 };
    case "gloss_black":
      return { hex: "#16171a", metalness: 0.75, roughness: 0.22 };
    case "steel":
    default:
      return { hex: "#8d9096", metalness: 0.5, roughness: 0.5 };
  }
};

/**
 * Dealer Mode — vizuální VODÍTKO v hledáčku (pouze overlay).
 *
 * Rámeček NIKDY neovlivňuje kameru: žádný crop, žádný zoom, žádná změna
 * rozlišení ani poměru stran výsledné fotografie. Slouží jen k tomu, aby
 * uživatel u všech vozidel dodržel podobnou kompozici a vzdálenost.
 *
 * Hodnoty jsou v podílech VIDITELNÉHO obrazu (0–1), takže se automaticky
 * přepočítají při změně orientace i poměru stran streamu.
 */
import type { ShotType } from "./types";

export interface GuideRect {
  /** Šířka rámečku jako podíl šířky obrazu. */
  width: number;
  /** Výška rámečku jako podíl výšky obrazu. */
  height: number;
  /** Střed rámečku (podíly). */
  centerX: number;
  centerY: number;
  /** Krátká rada pod rámečkem. */
  hint: string;
}

const EXTERIOR_3Q: GuideRect = {
  width: 0.86, height: 0.60, centerX: 0.5, centerY: 0.54,
  hint: "Celý vůz do rámečku — nesmí chybět nárazníky, střecha, kola ani zrcátka.",
};

const EXTERIOR_STRAIGHT: GuideRect = {
  width: 0.72, height: 0.62, centerX: 0.5, centerY: 0.54,
  hint: "Kolmý pohled — vůz vycentrovaný, celá šířka i kola v rámečku.",
};

const INTERIOR: GuideRect = {
  width: 0.92, height: 0.82, centerX: 0.5, centerY: 0.5,
  hint: "Vyplňte rámeček interiérem, držte telefon vodorovně.",
};

const DETAIL: GuideRect = {
  width: 0.66, height: 0.62, centerX: 0.5, centerY: 0.5,
  hint: "Detail vycentrujte do rámečku a zaostřete.",
};

const VIN: GuideRect = {
  width: 0.78, height: 0.34, centerX: 0.5, centerY: 0.5,
  hint: "VIN vodorovně do rámečku, písmo ostré a čitelné.",
};

/** Rámeček podle typu záběru. Nemění seznam „Vyžadovaných fotek“ — jen vodítko. */
export function guideForShot(
  type: ShotType | undefined,
  category: "exterior" | "interior" | "detail" | "vin" | undefined,
): GuideRect {
  if (type === "predek" || type === "zadek" || type === "predni-cast" || type === "zadni-cast") {
    return EXTERIOR_STRAIGHT;
  }
  if (category === "exterior") return EXTERIOR_3Q;
  if (category === "vin") return VIN;
  if (category === "detail") return DETAIL;
  return INTERIOR;
}

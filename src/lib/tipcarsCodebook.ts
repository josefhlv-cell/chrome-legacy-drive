// TipCars CiselnikyXmlImport — značky a modely (kompletní pro značky, které prodáváme).
// Stahováno z https://www.tipcars.com/import/CiselnikyProImportXml.php?TYP=1&O=A
// AKTUALIZOVÁNO podle reálných kódů — předtím se vše označovalo nesprávně jako Lancia/Flavia (AW/AWM).

export type TipCarsCode = { znacka_kod: string; znacka: string; model_kod: string; model: string };

// Pořadí v rámci značky je důležité — nejprve specifické modely, na konci „Ostatní".
// Klíčová slova jsou case-insensitive a hledají se v názvu vozu (substring).
const MAP: Array<{ keywords: string[]; code: TipCarsCode }> = [
  // ─── Chrysler (AS) ───
  { keywords: ["pacifica"],          code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "AST", model: "Pacifica" } },
  { keywords: ["grand voyager"],     code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASG", model: "Grand Voyager" } },
  { keywords: ["grand caravan"],     code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRL", model: "Grand Caravan" } },
  { keywords: ["town"],              code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASP", model: "Town & Country" } },
  { keywords: ["300c", "300 c"],     code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASU", model: "300C" } },
  { keywords: ["300m"],              code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASJ", model: "300M" } },
  { keywords: ["voyager"],           code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASF", model: "Voyager" } },
  { keywords: ["sebring"],           code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASO", model: "Sebring" } },
  { keywords: ["crossfire"],         code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASV", model: "Crossfire" } },
  { keywords: ["pt cruiser"],        code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASS", model: "PT Cruiser" } },
  { keywords: ["aspen"],             code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "AS0", model: "Aspen" } },

  // ─── Dodge (CR) ───
  { keywords: ["challenger"],        code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRT", model: "Challenger" } },
  { keywords: ["charger"],           code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRU", model: "Charger" } },
  { keywords: ["durango"],           code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRG", model: "Durango" } },
  { keywords: ["journey"],           code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRS", model: "Journey" } },
  { keywords: ["nitro"],             code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRQ", model: "Nitro" } },
  { keywords: ["caliber"],           code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRR", model: "Caliber" } },
  { keywords: ["avenger"],           code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRA", model: "Avenger" } },
  { keywords: ["magnum"],            code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRP", model: "Magnum" } },
  { keywords: ["viper"],             code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRD", model: "Viper" } },
  { keywords: ["ram 1500"],          code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CR0", model: "RAM 1500" } },
  { keywords: ["ram"],               code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRF", model: "RAM" } },
  { keywords: ["caravan"],           code: { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRE", model: "Caravan" } },

  // ─── Lancia (AW) ───
  { keywords: ["flavia"],            code: { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWM", model: "Flavia" } },
  { keywords: ["thema"],             code: { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWE", model: "Thema" } },
  { keywords: ["thesis"],            code: { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWI", model: "Thesis" } },
  { keywords: ["delta"],             code: { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWB", model: "Delta" } },
  { keywords: ["musa"],              code: { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWK", model: "Musa" } },
  { keywords: ["phedra"],            code: { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWJ", model: "Phedra" } },
];

const FALLBACK_CHRYSLER: TipCarsCode = { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASZ", model: "Ostatní" };
const FALLBACK_DODGE: TipCarsCode    = { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRZ", model: "Ostatní" };
const FALLBACK_LANCIA: TipCarsCode   = { znacka_kod: "AW", znacka: "Lancia",   model_kod: "AWZ", model: "Ostatní" };

/**
 * Z názvu vozu (např. "Chrysler Pacifica 3,6 RU 2021") odvodí značku a model
 * podle TipCars číselníku. Vrací undefined jen když název neobsahuje žádné
 * z známých značek.
 */
export function detectTipCarsCode(name: string | null | undefined): TipCarsCode | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();

  // Nejprve hledej konkrétní model — vyhne se kolizi „Lancia Voyager" → Voyager
  // Vyhrajeme tu, kde se klíčové slovo objeví NEJDŘÍVE (nejlevější výskyt).
  let best: { idx: number; code: TipCarsCode } | null = null;
  for (const entry of MAP) {
    for (const kw of entry.keywords) {
      const i = lower.indexOf(kw);
      if (i >= 0 && (best === null || i < best.idx)) {
        best = { idx: i, code: entry.code };
      }
    }
  }
  if (best) {
    // Speciální případ: „Lancia Voyager" — Lancia má vlastní model Voyager (AWL),
    // ale klíč „voyager" v MAP směřuje na Chrysler. Zkontroluj, zda název začíná na Lancia.
    if (best.code.model.toLowerCase() === "voyager" && lower.includes("lancia")) {
      return { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWL", model: "Voyager" };
    }
    return best.code;
  }

  // Fallback dle značky
  if (lower.includes("chrysler")) return FALLBACK_CHRYSLER;
  if (lower.includes("dodge"))    return FALLBACK_DODGE;
  if (lower.includes("lancia"))   return FALLBACK_LANCIA;
  return undefined;
}

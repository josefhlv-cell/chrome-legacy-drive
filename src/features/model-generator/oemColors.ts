/**
 * Oficiální vzorník laků Chrysler Pacifica (2017+).
 *
 * Proč: dřív se barva modelu odhadovala z českého názvu („modrá“ → obecná
 * modrá), takže 3D model nikdy nesouhlasil s reálným vozem. Tady máme
 * OEM kódy z výrobního štítku, jejich oficiální názvy, odpovídající hex
 * a typ laku (pearl / metallic / solid), který řídí lesk a flake v 3D i AR.
 *
 * `codes` obsahuje obě varianty z vzorníku (kód laku / kód interiéru-mixu),
 * takže vyhledání funguje i když admin zadá jen jeden z nich.
 */
import type { AppearanceProfile } from "./appearance";

export type OemColor = {
  /** Kódy z výrobního štítku, např. ["PW7", "GW7"]. */
  codes: string[];
  /** Oficiální marketingový název laku. */
  name: string;
  /** Hex pro 3D model. */
  hex: string;
  /** Typ laku — určuje clearcoat/flake v `glbBuilder`. */
  finish: AppearanceProfile["paint_finish"];
  /** Volitelné české/alternativní názvy pro vyhledání z karty vozu. */
  aliases?: string[];
};

export const OEM_COLORS: OemColor[] = [
  { codes: ["PW7", "GW7"], name: "Bright White Clear Coat", hex: "#f2f3f4", finish: "solid", aliases: ["bílá", "bila", "white"] },
  { codes: ["PXR", "AXR"], name: "Brilliant Black Crystal Pearl Coat", hex: "#0d0e10", finish: "pearl", aliases: ["černá", "cerna", "black"] },
  { codes: ["PXJ", "KXJ"], name: "Diamond Black Crystal Pearl Coat", hex: "#131519", finish: "pearl" },
  { codes: ["PAU", "LAU"], name: "Granite Crystal Metallic", hex: "#4c4f52", finish: "metallic", aliases: ["grafit", "granite"] },
  { codes: ["PSC", "JSC"], name: "Billet Silver Metallic", hex: "#9ba0a4", finish: "metallic", aliases: ["stříbrná", "stribrna", "silver"] },
  { codes: ["PTE"], name: "Light Toffee Silver Metallic", hex: "#b0a494", finish: "metallic", aliases: ["béžová", "bezova", "toffee"] },
  { codes: ["PBX", "KBX"], name: "Jazz Blue Pearl Coat", hex: "#1d2c56", finish: "pearl" },
  { codes: ["PBM", "SBM"], name: "Ocean Blue Metallic", hex: "#20456f", finish: "metallic", aliases: ["modrá", "modra", "blue"] },
  { codes: ["PRV", "NRV"], name: "Velvet Red Pearl Coat", hex: "#6d1220", finish: "pearl", aliases: ["vínová", "vinova", "bordó"] },
  { codes: ["PUV", "GUV"], name: "Dark Cordovan Pearl Coat", hex: "#4a2b2c", finish: "pearl", aliases: ["hnědá", "hneda"] },
  { codes: ["PLB", "KLB"], name: "Copperhead Pearl Coat", hex: "#8a4a20", finish: "pearl", aliases: ["oranžová", "oranzova", "copper"] },
  { codes: ["PQA"], name: "Silver Teal Pearl Coat", hex: "#5a7f80", finish: "pearl" },
  { codes: ["PW2"], name: "Cement White / Luxury White", hex: "#e6e5df", finish: "solid" },
  { codes: ["PAR", "KAR"], name: "Maximum Steel Metallic", hex: "#5e666b", finish: "metallic", aliases: ["šedá", "seda", "steel"] },
  { codes: ["PDN", "503B"], name: "Ceramic Gray", hex: "#8d8f8c", finish: "metallic" },
  { codes: ["PR6", "ZR6"], name: "Red Hot / Red Hot Pearl Coat", hex: "#a8121a", finish: "pearl", aliases: ["červená", "cervena", "red"] },
  { codes: ["PSE", "SSE"], name: "Silver Mist / Silver Zynith", hex: "#a9adb0", finish: "metallic" },
  { codes: ["PPS", "LPS"], name: "Fathom Blue / After Dark Blue", hex: "#16233c", finish: "pearl", aliases: ["tmavě modrá", "tmave modra", "navy"] },
];

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Najde OEM lak podle kódu (PBM, SBM…), oficiálního názvu nebo aliasu.
 * Kód se hledá jako samostatné slovo, aby „PW7“ v poznámce „lak PW7“ prošlo,
 * ale náhodná sekvence uvnitř VIN ne.
 */
export const resolveOemColor = (value?: string | null): OemColor | null => {
  if (!value) return null;
  const raw = norm(value);
  if (!raw) return null;

  for (const color of OEM_COLORS) {
    for (const code of color.codes) {
      const c = norm(code);
      if (raw === c || new RegExp(`(^|[^a-z0-9])${c}([^a-z0-9]|$)`).test(raw)) return color;
    }
  }

  for (const color of OEM_COLORS) {
    if (raw.includes(norm(color.name)) || norm(color.name).includes(raw)) return color;
    for (const alias of color.aliases ?? []) {
      if (raw === norm(alias)) return color;
    }
  }

  return null;
};

/** Popis pro select v adminu: „PBM / SBM — Ocean Blue Metallic“. */
export const oemLabel = (color: OemColor) => `${color.codes.join(" / ")} — ${color.name}`;

/**
 * Registr 3D/AR modelů Chrysler Pacifica.
 *
 * PROČ TENTO SOUBOR EXISTUJE
 * --------------------------
 * Chceme, aby každá konkrétní Pacifica z nabídky mohla mít VLASTNÍ model
 * (barva laku, kola, chrom, světla…), ale zároveň nechceme kvůli tomu
 * duplikovat logiku v AR komponentách. Tenhle modul je jediné místo, kde se
 * rozhoduje, KTERÝ soubor se pro dané vozidlo použije.
 *
 * GEOMETRICKÁ REFERENCE (HQ master — NIKDY se nemění)
 *   délka  5,1930 m
 *   šířka  2,2989 m (se zrcátky)
 *   výška  1,7514 m
 *   Y-up, základna na Y = 0, metersPerUnit = 1.0, žádný skrytý scale.
 *
 * Každá nová varianta MUSÍ mít stejné fyzické rozměry — v kódu se nikdy
 * nepočítá REAL_LENGTH / largestDimension a nikde se nepřidává scale.
 */
import pacificaGlbAsset from "./pacifica.glb.asset.json";
import pacificaUsdzAsset from "./pacifica.usdz.asset.json";

/** Fyzické rozměry HQ masteru v metrech — referenční hodnoty pro varianty. */
export const PACIFICA_DIMENSIONS_M = {
  length: 5.193,
  width: 2.2989,
  height: 1.7514,
} as const;

/** HQ master (fallback pro každou Pacificu bez vlastního modelu). */
export const PACIFICA_HQ_GLB = pacificaGlbAsset.url;
export const PACIFICA_HQ_USDZ = pacificaUsdzAsset.url;

export type PacificaVariant = {
  /** Stabilní klíč, který se ukládá do `vehicles.model_3d_glb` jako `variant:<key>`. */
  key: string;
  /** Popis pro admina. */
  label: string;
  glb: string;
  usdz: string;
};

/**
 * Varianty postavené nad HQ masterem.
 *
 * Zatím obsahuje pouze samotný master. Nové varianty se přidávají jako
 * projektové assety (`*.asset.json` ve stejné složce) — bez Supabase Storage
 * a bez edge funkcí. Karoserie zůstává společná, mění se jen lak / kola /
 * doplňky, takže fyzické rozměry zůstávají 1:1.
 */
export const PACIFICA_VARIANTS: PacificaVariant[] = [
  {
    key: "hq-master",
    label: "Pacifica HQ master (výchozí)",
    glb: PACIFICA_HQ_GLB,
    usdz: PACIFICA_HQ_USDZ,
  },
];

const VARIANT_PREFIX = "variant:";

const findVariant = (value: string): PacificaVariant | null => {
  const key = value.slice(VARIANT_PREFIX.length).trim();
  return PACIFICA_VARIANTS.find((v) => v.key === key) ?? null;
};

/**
 * Přeloží hodnotu z DB na skutečnou URL modelu.
 * Podporuje jak přímou URL projektového assetu, tak odkaz `variant:<key>`.
 */
const resolveRef = (
  value: string | null | undefined,
  kind: "glb" | "usdz",
): string | null => {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith(VARIANT_PREFIX)) {
    const variant = findVariant(raw);
    return variant ? variant[kind] : null;
  }
  return raw;
};

export type VehicleModelSource = {
  /** GLB pro Android AR a desktopový náhled. */
  glb: string;
  /** USDZ pro iOS Quick Look. */
  usdz: string;
  /** True, pokud jde o model konkrétního vozu (ne HQ fallback). */
  isVehicleSpecific: boolean;
};

/**
 * Priorita podle zadání:
 *   1) vlastní model konkrétního vozu (`model_3d_glb` / `model_3d_usdz`)
 *   2) model vygenerovaný v /admin/3d-generator
 *   3) HQ Pacifica master jako fallback
 *
 * GLB a USDZ se řeší nezávisle: když je u vozu vyplněné jen jedno z nich,
 * druhé se doplní z nejbližší dostupné úrovně (nikdy se nepodstrčí jiný
 * model než Pacifica).
 */
export const resolveVehicleModel = (input: {
  ownGlb?: string | null;
  ownUsdz?: string | null;
  generatedGlb?: string | null;
  generatedUsdz?: string | null;
}): VehicleModelSource => {
  const ownGlb = resolveRef(input.ownGlb, "glb");
  const ownUsdz = resolveRef(input.ownUsdz, "usdz");
  const genGlb = resolveRef(input.generatedGlb, "glb");
  const genUsdz = resolveRef(input.generatedUsdz, "usdz");

  return {
    glb: ownGlb ?? genGlb ?? PACIFICA_HQ_GLB,
    usdz: ownUsdz ?? genUsdz ?? PACIFICA_HQ_USDZ,
    isVehicleSpecific: Boolean(ownGlb || ownUsdz || genGlb || genUsdz),
  };
};

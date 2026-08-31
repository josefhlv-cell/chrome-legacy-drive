/**
 * Typy a helpery pro "appearance profil" — popis vzhledu konkrétního vozu,
 * který se přenáší na základní 3D model Pacifiky.
 */

import { DEFAULT_WHEEL_ID, WHEEL_CATALOG } from "./wheelCatalog";

export type Damage = {
  part: string;
  type: string;
  severity: string;
  note?: string;
};

export type AppearanceProfile = {
  id?: string;
  vehicle_id: string;
  body_color_hex: string;
  paint_finish: "solid" | "metallic" | "pearl" | "matte";
  clearcoat: number;
  roughness: number;
  glass_opacity: number;
  trim_style: "chrome" | "black" | "body";
  wheel_style: string;
  wheel_condition?: string | null;
  damages: Damage[];
  interior_color_hex?: string | null;
  photos?: Record<string, string>;
  analysis?: Record<string, unknown>;
  status?: string;
  notes?: string | null;
};

export const DEFAULT_PROFILE = (vehicleId: string): AppearanceProfile => ({
  vehicle_id: vehicleId,
  body_color_hex: "#e9eaec",
  paint_finish: "metallic",
  clearcoat: 1,
  roughness: 0.2,
  glass_opacity: 0.55,
  trim_style: "chrome",
  wheel_style: DEFAULT_WHEEL_ID,
  damages: [],
  interior_color_hex: "#2b2b2e",
});

/**
 * Seznam kol pro admin select — jediným zdrojem pravdy je OEM katalog
 * (Mopar diagram), aby se u dvou stejných vozů nikdy neobjevila jiná kola.
 */
export const WHEEL_STYLES: { id: string; label: string }[] = WHEEL_CATALOG.map(
  ({ id, label }) => ({ id, label }),
);


export const TRIM_LABELS: Record<string, string> = {
  chrome: "Chromový paket",
  black: "Černý paket",
  body: "V barvě karoserie",
};

export const DAMAGE_PARTS: { id: string; label: string }[] = [
  { id: "predni_naraznik", label: "Přední nárazník" },
  { id: "zadni_naraznik", label: "Zadní nárazník" },
  { id: "dvere_levo", label: "Dveře — levá strana" },
  { id: "dvere_pravo", label: "Dveře — pravá strana" },
  { id: "blatnik", label: "Blatník" },
  { id: "kapota", label: "Kapota" },
  { id: "paty_dvere", label: "Páté dveře" },
  { id: "strecha", label: "Střecha" },
  { id: "jine", label: "Jiné" },
];

export const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value.trim());

// Smart Capture — typy a konstanty
export type ShotType =
  | "predni-pravy-roh" | "pravy-bok" | "pravy-zadni-roh" | "zadni-cast"
  | "levy-zadni-roh" | "levy-bok" | "levy-predni-roh" | "predni-cast"
  | "kola-disky" | "motor" | "ridicuv-prostor" | "predni-sedacky"
  | "druha-rada" | "treti-rada" | "kufr" | "panorama-strop" | "vin-stitek"
  | "interier-jine" | "exterier-jine" | "detail" | "unknown";

export interface ShotStep {
  type: ShotType;
  label: string;
  hint: string;
  category: "exterior" | "interior" | "detail" | "vin";
}

export const SHOT_SEQUENCE: ShotStep[] = [
  { type: "predni-pravy-roh", label: "Pravý přední roh", hint: "Titulní fotka — postavte se 3–4 m od auta v úhlu 45°.", category: "exterior" },
  { type: "pravy-bok", label: "Pravý bok", hint: "Kolmo k vozidlu, celá silueta v záběru.", category: "exterior" },
  { type: "pravy-zadni-roh", label: "Pravý zadní roh", hint: "Stejný úhel 45° z druhé strany.", category: "exterior" },
  { type: "zadni-cast", label: "Zadní část", hint: "Kolmo zezadu, světla v ostřících.", category: "exterior" },
  { type: "levy-zadni-roh", label: "Levý zadní roh", hint: "Symetricky k pravému zadnímu rohu.", category: "exterior" },
  { type: "levy-bok", label: "Levý bok", hint: "Kolmo k vozidlu.", category: "exterior" },
  { type: "levy-predni-roh", label: "Levý přední roh", hint: "Symetricky k titulní fotce.", category: "exterior" },
  { type: "predni-cast", label: "Přední část", hint: "Kolmo zepředu, maska celá v záběru.", category: "exterior" },
  { type: "kola-disky", label: "Kola / disky", hint: "Detail disku z přibližně 1 m.", category: "detail" },
  { type: "motor", label: "Motor", hint: "Otevřená kapota, dostatek světla.", category: "detail" },
  { type: "ridicuv-prostor", label: "Řidičův prostor", hint: "Volant, palubní deska, multimédia.", category: "interior" },
  { type: "predni-sedacky", label: "Přední sedačky", hint: "Foto ze zadních dveří dopředu.", category: "interior" },
  { type: "druha-rada", label: "Druhá řada", hint: "Pohled na zadní sedačky.", category: "interior" },
  { type: "treti-rada", label: "Třetí řada", hint: "Pokud vůz třetí řadu má.", category: "interior" },
  { type: "kufr", label: "Kufr", hint: "Otevřený, prázdný, dobré osvětlení.", category: "interior" },
  { type: "panorama-strop", label: "Panorama / strop", hint: "Pokud má panoramatickou střechu.", category: "interior" },
  { type: "vin-stitek", label: "VIN štítek", hint: "Detailní záběr štítku, ostré písmo.", category: "vin" },
];

export const SHOT_LABEL_MAP: Record<ShotType, string> = SHOT_SEQUENCE.reduce((acc, s) => {
  acc[s.type] = s.label;
  return acc;
}, {
  "interier-jine": "Interiér",
  "exterier-jine": "Exteriér",
  "detail": "Detail",
  "unknown": "Neznámé",
} as Record<ShotType, string>);

// Bezpečný název souboru
export const slugifyShot = (type: ShotType, index: number): string => {
  const idx = String(index + 1).padStart(2, "0");
  return `${idx}-${type}.jpg`;
};

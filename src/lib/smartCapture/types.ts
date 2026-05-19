// Smart Capture — typy a konstanty
// Pořadí záběrů dle požadavku majitele (20 kroků)
export type ShotType =
  | "prava-predni" | "leva-predni" | "leva-zadni" | "prava-zadni"
  | "zadek" | "predek" | "kufr"
  | "sedacky-zezadu" | "prava-stredni-sedacka" | "prava-predni-sedacka"
  | "dvd" | "pristrojovka-zprostred" | "leva-stredni-sedacka"
  | "zprostred-predek-ridic" | "dvere-ridic" | "km"
  | "stredovy-panel" | "vrch-stropnice" | "detail-klima" | "vin-za-oknem"
  // legacy/fallback typy zachované pro starší data
  | "predni-pravy-roh" | "pravy-bok" | "pravy-zadni-roh" | "zadni-cast"
  | "levy-zadni-roh" | "levy-bok" | "levy-predni-roh" | "predni-cast"
  | "kola-disky" | "motor" | "ridicuv-prostor" | "predni-sedacky"
  | "druha-rada" | "treti-rada" | "panorama-strop" | "vin-stitek"
  | "interier-jine" | "exterier-jine" | "detail" | "unknown";

export interface ShotStep {
  type: ShotType;
  label: string;
  hint: string;
  category: "exterior" | "interior" | "detail" | "vin";
}

export const SHOT_SEQUENCE: ShotStep[] = [
  { type: "prava-predni", label: "Pravá přední", hint: "Titulní fotka — 3–4 m od auta v úhlu 45° z pravé strany zepředu.", category: "exterior" },
  { type: "leva-predni", label: "Levá přední", hint: "Symetricky k titulní fotce z levé strany zepředu.", category: "exterior" },
  { type: "leva-zadni", label: "Levá zadní", hint: "Úhel 45° z levé strany zezadu.", category: "exterior" },
  { type: "prava-zadni", label: "Pravá zadní", hint: "Úhel 45° z pravé strany zezadu.", category: "exterior" },
  { type: "zadek", label: "Zadek", hint: "Kolmo zezadu, celá záď v záběru.", category: "exterior" },
  { type: "predek", label: "Předek", hint: "Kolmo zepředu, maska celá v záběru.", category: "exterior" },
  { type: "kufr", label: "Kufr", hint: "Otevřený a prázdný kufr, dobré osvětlení.", category: "interior" },
  { type: "sedacky-zezadu", label: "Sedačky zezadu", hint: "Pohled na zadní sedačky zezadu (otevřené kufr/dveře).", category: "interior" },
  { type: "prava-stredni-sedacka", label: "Pravá střední sedačka", hint: "Detail pravé sedačky druhé řady.", category: "interior" },
  { type: "prava-predni-sedacka", label: "Pravá přední sedačka", hint: "Detail spolujezdcovy sedačky.", category: "interior" },
  { type: "dvd", label: "DVD / multimédia", hint: "Zadní DVD obrazovka nebo multimediální systém.", category: "interior" },
  { type: "pristrojovka-zprostred", label: "Přístrojovka zprostřed", hint: "Pohled z prostředku auta na přístrojovou desku.", category: "interior" },
  { type: "leva-stredni-sedacka", label: "Levá střední sedačka", hint: "Detail levé sedačky druhé řady.", category: "interior" },
  { type: "zprostred-predek-ridic", label: "Zprostřed na řidiče", hint: "Z prostředku auta pohled dopředu na místo řidiče.", category: "interior" },
  { type: "dvere-ridic", label: "Dveře řidiče", hint: "Otevřené dveře řidiče s detailem výplně.", category: "interior" },
  { type: "km", label: "Tachometr / km", hint: "Detail tachometru s aktuálním nájezdem.", category: "detail" },
  { type: "stredovy-panel", label: "Středový panel", hint: "Středová konzole s ovládacími prvky.", category: "interior" },
  { type: "vrch-stropnice", label: "Vrch stropnice", hint: "Pohled nahoru — stropnice / panorama.", category: "interior" },
  { type: "detail-klima", label: "Detail klimatizace", hint: "Detail ovládání klimatizace.", category: "detail" },
  { type: "vin-za-oknem", label: "VIN za oknem", hint: "Detailní záběr VIN štítku za čelním sklem, ostré písmo.", category: "vin" },
];

export const SHOT_LABEL_MAP: Record<ShotType, string> = SHOT_SEQUENCE.reduce((acc, s) => {
  acc[s.type] = s.label;
  return acc;
}, {
  // legacy popisky
  "predni-pravy-roh": "Pravý přední roh",
  "pravy-bok": "Pravý bok",
  "pravy-zadni-roh": "Pravý zadní roh",
  "zadni-cast": "Zadní část",
  "levy-zadni-roh": "Levý zadní roh",
  "levy-bok": "Levý bok",
  "levy-predni-roh": "Levý přední roh",
  "predni-cast": "Přední část",
  "kola-disky": "Kola / disky",
  "motor": "Motor",
  "ridicuv-prostor": "Řidičův prostor",
  "predni-sedacky": "Přední sedačky",
  "druha-rada": "Druhá řada",
  "treti-rada": "Třetí řada",
  "panorama-strop": "Panorama / strop",
  "vin-stitek": "VIN štítek",
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

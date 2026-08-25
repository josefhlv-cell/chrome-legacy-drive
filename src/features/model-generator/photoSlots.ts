/**
 * Definice 16 fotografických slotů pro generátor 3D modelů.
 *
 * Sloty jsou pevné a pojmenované — edge funkce `vehicle-appearance-analyze`
 * si podle nich vybírá, kterou fotku k čemu použije (barva laku ze pohledu
 * ze strany, tmavost skel z detailu okna atd.).
 */

export type SlotGroup = "exterior" | "detail" | "interior";

export type PhotoSlot = {
  id: string;
  label: string;
  hint: string;
  group: SlotGroup;
  /** Slot je nutný pro spolehlivou analýzu vzhledu. */
  required: boolean;
};

export const PHOTO_SLOTS: PhotoSlot[] = [
  { id: "ext_0", label: "Předek (0°)", hint: "Celý vůz zpředu, objektiv ve výšce pasu.", group: "exterior", required: true },
  { id: "ext_45_left", label: "Předek-levý (45°)", hint: "Klasický katalogový záběr.", group: "exterior", required: true },
  { id: "ext_90_left", label: "Levý bok (90°)", hint: "Celý bok, kola na okrajích záběru.", group: "exterior", required: true },
  { id: "ext_135_left", label: "Zadek-levý (135°)", hint: "Bez tvrdého stínu na laku.", group: "exterior", required: false },
  { id: "ext_180", label: "Zadek (180°)", hint: "Celá zadní část včetně nárazníku.", group: "exterior", required: true },
  { id: "ext_225_right", label: "Zadek-pravý (225°)", hint: "Zrcadlově k 135°.", group: "exterior", required: false },
  { id: "ext_270_right", label: "Pravý bok (270°)", hint: "Celý pravý bok.", group: "exterior", required: false },
  { id: "ext_315_right", label: "Předek-pravý (315°)", hint: "Zrcadlově k 45°.", group: "exterior", required: false },

  { id: "detail_wheel", label: "Kolo (detail)", hint: "Celý disk zpředu, vidět dezén pneu.", group: "detail", required: true },
  { id: "detail_damage", label: "Poškození (detail)", hint: "30 cm od plochy, bez blesku. Nemáte-li poškození, vyfoťte čistý bok.", group: "detail", required: false },
  { id: "detail_window", label: "Okno (detail)", hint: "Bok okna bez odlesku slunce — určuje tmavost skel.", group: "detail", required: true },
  { id: "detail_grille", label: "Maska / mřížka", hint: "Rozliší chromový a černý paket.", group: "detail", required: false },

  { id: "int_front", label: "Interiér — předek", hint: "Přední sedadla + palubní deska.", group: "interior", required: true },
  { id: "int_rear", label: "Interiér — druhá řada", hint: "Zadní sedadla ze dveří.", group: "interior", required: false },
  { id: "int_wheel", label: "Volant + přístroje", hint: "Vidět stav volantu a tachometr.", group: "interior", required: false },
  { id: "int_cargo", label: "Zavazadlový prostor", hint: "Případně motorový prostor.", group: "interior", required: false },
];

export const REQUIRED_SLOT_IDS = PHOTO_SLOTS.filter((s) => s.required).map((s) => s.id);

export const GROUP_LABELS: Record<SlotGroup, string> = {
  exterior: "Exteriér (8 fotek)",
  detail: "Detaily (4 fotky)",
  interior: "Interiér (4 fotky)",
};

/** Minimální rozlišení fotky (4 MP). */
export const MIN_MEGAPIXELS = 3.5;
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
/** Pro analýzu stačí 1600 px na dlouhé straně — šetří upload i AI tokeny. */
export const ANALYSIS_MAX_EDGE = 1600;

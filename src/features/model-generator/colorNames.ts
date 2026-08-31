/**
 * Mapování českých názvů barev z karty vozu na hex.
 *
 * Proč: při předvyplnění z VIN dekodér barvu nevrací (VIN ji neobsahuje),
 * takže model zůstával vždy bílý. Barvu ale máme u vozu v poli `color`
 * (případně přesnější `ar_color_hex`) — tady ji převedeme na lak modelu.
 */
const TABLE: Array<[RegExp, string]> = [
  [/perleť|pearl/i, "#eceff3"],
  [/bílá|bila|white/i, "#e9eaec"],
  [/černá|cerna|black/i, "#131519"],
  [/stříbrn|stribrn|silver/i, "#b8bcc2"],
  [/šedá|seda|grafit|graphite|gray|grey/i, "#6d7278"],
  [/tmavě modrá|tmave modra|navy/i, "#16244a"],
  [/modrá|modra|blue/i, "#1f47b8"],
  [/červená|cervena|red/i, "#9c1119"],
  [/vínová|vinova|bordó|bordo|burgundy/i, "#5a1220"],
  [/zelená|zelena|green/i, "#1f4a35"],
  [/hnědá|hneda|brown/i, "#4a352a"],
  [/béžová|bezova|beige/i, "#c8b79b"],
  [/zlatá|zlata|gold/i, "#a98b4e"],
  [/oranžová|oranzova|orange/i, "#c4581a"],
  [/žlutá|zluta|yellow/i, "#d8b414"],
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Vrátí hex laku podle názvu barvy, nebo null když název nerozpoznáme. */
export const colorNameToHex = (value?: string | null): string | null => {
  if (!value) return null;
  const raw = value.trim();
  if (HEX.test(raw)) return raw;
  for (const [pattern, hex] of TABLE) {
    if (pattern.test(raw)) return hex;
  }
  return null;
};

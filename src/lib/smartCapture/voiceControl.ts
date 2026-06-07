// Smart Capture — voice command recognition (Czech)
// Uses Web Speech API (webkitSpeechRecognition). Lightweight, no external deps.

export type VoiceCommand = "next" | "prev" | "shot" | "retake" | "vin" | "done";

const PATTERNS: Record<VoiceCommand, RegExp[]> = {
  shot:   [/\b(vyfotit|fot[ʼ']?|foť|fotit|cvak|klik|teď)\b/i],
  next:   [/\b(další|dalsi|pokračuj|pokracuj|další krok|next)\b/i],
  prev:   [/\b(zpět|zpet|předchozí|predchozi|back)\b/i],
  retake: [/\b(přefotit|prefotit|znovu|opakovat|smaž|smaz)\b/i],
  vin:    [/\b(vin|naskenuj vin|skenuj vin)\b/i],
  done:   [/\b(hotovo|konec|dokončit|dokoncit|finish)\b/i],
};

export interface VoiceController {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
  setHandler: (h: (cmd: VoiceCommand, raw: string) => void) => void;
  setDictationHandler: (h: ((text: string) => void) | null) => void;
}

interface SRConstructor {
  new (): SpeechRecognitionLike;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

export function createVoiceController(): VoiceController {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const supported = !!Ctor;
  let rec: SpeechRecognitionLike | null = null;
  let handler: ((cmd: VoiceCommand, raw: string) => void) | null = null;
  let dictation: ((text: string) => void) | null = null;
  let wantOn = false;

  const buildRec = () => {
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = "cs-CZ";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (!last?.isFinal) return;
      const text = String(last[0]?.transcript ?? "").trim();
      if (!text) return;
      if (dictation) { dictation(text); return; }
      for (const [cmd, regs] of Object.entries(PATTERNS) as [VoiceCommand, RegExp[]][]) {
        if (regs.some((re) => re.test(text))) { handler?.(cmd, text); return; }
      }
    };
    r.onerror = () => { /* swallow; will auto-restart in onend */ };
    r.onend = () => { if (wantOn) { try { r.start(); } catch { /* ignore */ } } };
    return r;
  };

  return {
    isSupported: supported,
    start: () => {
      if (!supported) return;
      wantOn = true;
      if (!rec) rec = buildRec();
      try { rec?.start(); } catch { /* already started */ }
    },
    stop: () => {
      wantOn = false;
      try { rec?.stop(); } catch { /* ignore */ }
    },
    setHandler: (h) => { handler = h; },
    setDictationHandler: (h) => { dictation = h; },
  };
}

// Parse a dictated free-form sentence into vehicle info fields.
// Example: "značka škoda model octavia rok 2018 najezd 120000 cena 250000 nafta automat"
export function parseDictation(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = " " + text.toLowerCase().replace(/[,.;]/g, " ") + " ";
  const grab = (re: RegExp) => t.match(re)?.[1]?.trim();

  const brand = grab(/\b(?:značka|znacka|marka)\s+([a-záčďéěíňóřšťúůýž-]+)/i);
  const model = grab(/\bmodel\s+([a-z0-9áčďéěíňóřšťúůýž-]+)/i);
  const year  = grab(/\brok(?:\s+výroby)?\s+(\d{4})/i);
  const km    = grab(/\b(?:najezd|nájezd|kilometry|km)\s+(\d[\d\s]{2,})/i);
  const price = grab(/\b(?:cena|prodejní cena)\s+(\d[\d\s]{2,})/i);
  const power = grab(/\b(?:výkon|vykon|kw)\s+(\d{2,3})/i);
  const color = grab(/\b(?:barva)\s+([a-záčďéěíňóřšťúůýž]+)/i);
  const vin   = grab(/\bvin\s+([a-z0-9]{11,17})/i);

  if (brand) out.brand = brand.replace(/^./, (c) => c.toUpperCase());
  if (model) out.model = model.replace(/^./, (c) => c.toUpperCase());
  if (year)  out.year  = year;
  if (km)    out.mileage = km.replace(/\s+/g, "");
  if (price) out.price = price.replace(/\s+/g, "");
  if (power) out.power = power;
  if (color) out.color = color;
  if (vin)   out.vin   = vin.toUpperCase();

  if (/\b(nafta|diesel)\b/.test(t))      out.fuel = "Nafta";
  else if (/\b(benzín|benzin)\b/.test(t)) out.fuel = "Benzín";
  else if (/\b(elektro|elektrický)\b/.test(t)) out.fuel = "Elektro";
  else if (/\b(hybrid)\b/.test(t))       out.fuel = "Hybrid";
  else if (/\b(lpg)\b/.test(t))          out.fuel = "LPG";

  if (/\b(automat|automatick)/.test(t))  out.transmission = "Automatická";
  else if (/\b(manuál|manual)/.test(t))  out.transmission = "Manuální";

  return out;
}

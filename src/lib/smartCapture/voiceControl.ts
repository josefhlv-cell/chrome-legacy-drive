// Smart Capture — voice command recognition (Czech)
// Uses Web Speech API (webkitSpeechRecognition). No external deps.

export type VoiceCommand = "next" | "prev" | "shot" | "retake" | "vin" | "done" | "skip";

const PATTERNS: Record<VoiceCommand, RegExp[]> = {
  shot: [
    /\b(vyfotit|vyfo[tť]|fo[tť]|fotit|cvak|cvakni|klik|teď|ted|snímek|fotka|foť to|ber)\b/i,
  ],
  next: [
    /\b(další|dalsi|pokračuj|pokracuj|další krok|next|dopředu)\b/i,
  ],
  prev: [
    /\b(zpět|zpet|předchozí|predchozi|back|zpátky)\b/i,
  ],
  retake: [
    /\b(přefotit|prefotit|znovu|opakovat|smaž|smaz|ještě jednou|znova)\b/i,
  ],
  vin: [
    /\b(vin|víín|naskenuj vin|skenuj vin|vin kód)\b/i,
  ],
  done: [
    /\b(hotovo|konec|dokončit|dokoncit|finish|ukončit|končíme)\b/i,
  ],
  skip: [
    /\b(přeskočit|preskocit|skip|vynechat)\b/i,
  ],
};

export interface VoiceController {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
  listening: () => boolean;
  setHandler: (h: (cmd: VoiceCommand, raw: string) => void) => void;
  setDictationHandler: (h: ((text: string) => void) | null) => void;
  setStatusHandler: (h: ((listening: boolean, error?: string) => void) | null) => void;
}

interface SRConstructor {
  new (): SpeechRecognitionLike;
}

/** Minimal SpeechRecognition shape — keep types simple for esbuild. */
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export function createVoiceController(): VoiceController {
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const supported = !!Ctor;
  let rec: SpeechRecognitionLike | null = null;
  let handler: ((cmd: VoiceCommand, raw: string) => void) | null = null;
  let dictation: ((text: string) => void) | null = null;
  let status: ((listening: boolean, error?: string) => void) | null = null;
  let wantOn = false;
  let isListening = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = (on: boolean, error?: string) => {
    isListening = on;
    status?.(on, error);
  };

  const clearRestart = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const matchCommand = (text: string): VoiceCommand | null => {
    for (const [cmd, regs] of Object.entries(PATTERNS) as [VoiceCommand, RegExp[]][]) {
      if (regs.some((re) => re.test(text))) return cmd;
    }
    return null;
  };

  const buildRec = () => {
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = "cs-CZ";
    r.continuous = true;
    r.interimResults = false;
    if (typeof r.maxAlternatives === "number") r.maxAlternatives = 1;

    r.onstart = () => notify(true);

    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (!last?.isFinal) return;
      const text = String(last[0]?.transcript ?? "").trim();
      if (!text) return;
      if (dictation) {
        dictation(text);
        return;
      }
      const cmd = matchCommand(text);
      if (cmd) handler?.(cmd, text);
    };

    r.onerror = (e) => {
      const code = e?.error || "error";
      if (code === "not-allowed" || code === "service-not-allowed") {
        wantOn = false;
        notify(false, "Mikrofon nemá oprávnění");
        return;
      }
      if (code === "no-speech" || code === "aborted") return;
      notify(isListening, code);
    };

    r.onend = () => {
      notify(false);
      if (!wantOn) return;
      clearRestart();
      restartTimer = setTimeout(() => {
        if (!wantOn) return;
        try {
          r.start();
        } catch {
          /* already started */
        }
      }, 280);
    };

    return r;
  };

  return {
    isSupported: supported,
    listening: () => isListening,
    start: () => {
      if (!supported) return;
      wantOn = true;
      if (!rec) rec = buildRec();
      clearRestart();
      try {
        rec?.start();
      } catch {
        /* already started */
      }
    },
    stop: () => {
      wantOn = false;
      clearRestart();
      try {
        rec?.abort();
      } catch {
        try {
          rec?.stop();
        } catch {
          /* ignore */
        }
      }
      notify(false);
    },
    setHandler: (h) => {
      handler = h;
    },
    setDictationHandler: (h) => {
      dictation = h;
    },
    setStatusHandler: (h) => {
      status = h;
    },
  };
}

/** Map command to short Czech label for toast / UI. */
export function voiceCommandLabel(cmd: VoiceCommand): string {
  switch (cmd) {
    case "shot": return "Vyfotit";
    case "next": return "Další";
    case "prev": return "Zpět";
    case "retake": return "Přefotit";
    case "vin": return "VIN";
    case "done": return "Hotovo";
    case "skip": return "Přeskočit";
  }
}

// Parse a dictated free-form sentence into vehicle info fields.
export function parseDictation(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = " " + text.toLowerCase().replace(/[,.;]/g, " ") + " ";
  const grab = (re: RegExp) => t.match(re)?.[1]?.trim();

  const brand = grab(/\b(?:značka|znacka|marka)\s+([a-záčďéěíňóřšťúůýž-]+)/i);
  const model = grab(/\bmodel\s+([a-z0-9áčďéěíňóřšťúůýž-]+)/i);
  const year = grab(/\brok(?:\s+výroby)?\s+(\d{4})/i);
  const km = grab(/\b(?:najezd|nájezd|kilometry|km)\s+(\d[\d\s]{2,})/i);
  const price = grab(/\b(?:cena|prodejní cena)\s+(\d[\d\s]{2,})/i);
  const power = grab(/\b(?:výkon|vykon|kw)\s+(\d{2,3})/i);
  const color = grab(/\b(?:barva)\s+([a-záčďéěíňóřšťúůýž]+)/i);
  const vin = grab(/\bvin\s+([a-z0-9]{11,17})/i);

  if (brand) out.brand = brand.replace(/^./, (c) => c.toUpperCase());
  if (model) out.model = model.replace(/^./, (c) => c.toUpperCase());
  if (year) out.year = year;
  if (km) out.mileage = km.replace(/\s+/g, "");
  if (price) out.price = price.replace(/\s+/g, "");
  if (power) out.power = power;
  if (color) out.color = color;
  if (vin) out.vin = vin.toUpperCase();

  if (/\b(nafta|diesel)\b/.test(t)) out.fuel = "Nafta";
  else if (/\b(benzín|benzin)\b/.test(t)) out.fuel = "Benzín";
  else if (/\b(elektro|elektrický)\b/.test(t)) out.fuel = "Elektro";
  else if (/\b(hybrid)\b/.test(t)) out.fuel = "Hybrid";
  else if (/\b(lpg)\b/.test(t)) out.fuel = "LPG";

  if (/\b(automat|automatick)/.test(t)) out.transmission = "Automatická";
  else if (/\b(manuál|manual)/.test(t)) out.transmission = "Manuální";

  return out;
}

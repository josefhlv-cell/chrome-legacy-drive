// Smart Capture — voice command recognition (Czech)
// Web Speech API (webkitSpeechRecognition). Mobile/iOS friendly.

export type VoiceCommand = "next" | "prev" | "shot" | "retake" | "vin" | "done" | "skip";

export interface VoiceController {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
  listening: () => boolean;
  setHandler: (h: (cmd: VoiceCommand, raw: string) => void) => void;
  setDictationHandler: (h: ((text: string) => void) | null) => void;
  setStatusHandler: (h: ((listening: boolean, error?: string) => void) | null) => void;
  setHeardHandler: (h: ((text: string) => void) | null) => void;
}

interface SRConstructor {
  new (): SpeechRecognitionLike;
}

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

function isIOSLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Strip diacritics for tolerant matching. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ordered: more specific commands first where needed. */
const COMMANDS: { cmd: VoiceCommand; keys: string[] }[] = [
  { cmd: "shot", keys: ["vyfotit", "vyfot", "fotit", "fot", "fotka", "fotku", "cvak", "cvakni", "klik", "ted", "snimek", "ber", "fo"] },
  { cmd: "retake", keys: ["prefotit", "prefot", "znovu", "opakovat", "smaz", "smazat", "jeste jednou", "znova"] },
  { cmd: "skip", keys: ["preskocit", "preskoc", "skip", "vynechat"] },
  { cmd: "next", keys: ["dalsi", "pokracuj", "next", "dopredu"] },
  { cmd: "prev", keys: ["zpet", "predchozi", "back", "zpatky"] },
  { cmd: "vin", keys: ["vin", "vinko", "naskenuj vin", "skenuj vin"] },
  { cmd: "done", keys: ["hotovo", "konec", "dokoncit", "finish", "ukoncit", "koncime"] },
];

function matchCommand(raw: string): VoiceCommand | null {
  const t = ` ${fold(raw)} `;
  for (const { cmd, keys } of COMMANDS) {
    for (const key of keys) {
      if (t.includes(` ${key} `) || t.includes(` ${key}`)) return cmd;
      // single-word exact
      if (t.trim() === key) return cmd;
    }
  }
  return null;
}

export function createVoiceController(): VoiceController {
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const supported = !!Ctor;
  const ios = isIOSLike();

  let rec: SpeechRecognitionLike | null = null;
  let handler: ((cmd: VoiceCommand, raw: string) => void) | null = null;
  let dictation: ((text: string) => void) | null = null;
  let status: ((listening: boolean, error?: string) => void) | null = null;
  let heard: ((text: string) => void) | null = null;
  let wantOn = false;
  let isListening = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = (on: boolean, error?: string) => {
    isListening = on;
    try {
      status?.(on, error);
    } catch {
      /* UI must not break recognition */
    }
  };

  const clearRestart = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const scheduleRestart = () => {
    clearRestart();
    if (!wantOn || !rec) return;
    // iOS needs a slightly longer gap after each utterance
    const delay = ios ? 400 : 250;
    restartTimer = setTimeout(() => {
      if (!wantOn || !rec) return;
      try {
        rec.start();
      } catch {
        // InvalidStateError if already started — ignore
      }
    }, delay);
  };

  const buildRec = () => {
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = "cs-CZ";
    // continuous=true is unreliable on iOS Safari / Chrome iOS
    r.continuous = !ios;
    r.interimResults = false;
    if (typeof r.maxAlternatives === "number") r.maxAlternatives = 3;

    r.onstart = () => notify(true);

    r.onresult = (e) => {
      const results = e.results;
      const last = results[results.length - 1];
      if (!last) return;
      // Some engines mark isFinal late; accept final or last alternative
      const text = String(last[0]?.transcript ?? "").trim();
      if (!text) return;
      if (!last.isFinal && ios) return;
      if (!last.isFinal && !ios) return;

      try {
        heard?.(text);
      } catch {
        /* ignore */
      }

      if (dictation) {
        dictation(text);
        return;
      }

      const cmd = matchCommand(text);
      if (cmd) {
        try {
          handler?.(cmd, text);
        } catch {
          /* ignore */
        }
      }
    };

    r.onerror = (e) => {
      const code = e?.error || "error";
      if (code === "not-allowed" || code === "service-not-allowed") {
        wantOn = false;
        notify(false, "Mikrofon nemá oprávnění");
        return;
      }
      // no-speech / aborted: onend will restart if wantOn
      if (code === "no-speech" || code === "aborted") return;
      if (code === "network") {
        notify(false, "Síťová chyba rozpoznávání");
        return;
      }
    };

    r.onend = () => {
      notify(false);
      if (wantOn) scheduleRestart();
    };

    return r;
  };

  return {
    isSupported: supported,
    listening: () => isListening,
    start: () => {
      if (!supported) {
        notify(false, "Prohlížeč nepodporuje hlasové ovládání");
        return;
      }
      wantOn = true;
      // Rebuild instance when starting — avoids stuck state after abort
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
      rec = buildRec();
      clearRestart();
      try {
        rec?.start();
      } catch {
        scheduleRestart();
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
    setHeardHandler: (h) => {
      heard = h;
    },
  };
}

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

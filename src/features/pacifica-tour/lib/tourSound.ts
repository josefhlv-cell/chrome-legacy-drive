/**
 * Zvuková vrstva virtuální prohlídky.
 *
 * Žádné externí audio soubory a žádný mluvený komentář — všechny zvuky
 * jsou syntetizované přes Web Audio API, takže nepřidávají ani jeden byte
 * ke stažení a nezdržují načtení prohlídky.
 *
 * Zvuk je ve výchozím stavu ZAPNUTÝ až po prvním gestu uživatele
 * (spuštění prohlídky), aby prohlížeč neblokoval AudioContext.
 */

const STORAGE_KEY = "pacifica_tour_muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambient: { osc: OscillatorNode[]; gain: GainNode } | null = null;

let muted = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
})();

const ensureContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;

  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!Ctor) return null;

  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }

  if (ctx.state === "suspended") void ctx.resume();

  return ctx;
};

export const isTourMuted = () => muted;

export const setTourMuted = (value: boolean) => {
  muted = value;

  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }

  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(
      value ? 0 : 0.6,
      ctx.currentTime + 0.25,
    );
  }
};

type ToneOptions = {
  freq: number;
  to?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

const tone = ({
  freq,
  to,
  duration = 0.14,
  type = "sine",
  gain = 0.18,
  delay = 0,
}: ToneOptions) => {
  const audio = ensureContext();
  if (!audio || !master || muted) return;

  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env);
  env.connect(master);

  osc.start(start);
  osc.stop(start + duration + 0.05);
};

const noise = (duration = 0.35, gain = 0.09, filterHz = 1400) => {
  const audio = ensureContext();
  if (!audio || !master || muted) return;

  const frames = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < frames; i += 1) {
    const fade = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }

  const src = audio.createBufferSource();
  src.buffer = buffer;

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterHz;

  const env = audio.createGain();
  env.gain.value = gain;

  src.connect(filter);
  filter.connect(env);
  env.connect(master);

  src.start();
};

export const sfx = {
  /** Kliknutí na hotspot / tlačítko. */
  tap: () => tone({ freq: 880, to: 1180, duration: 0.09, gain: 0.1 }),

  /** Přejezd kamery na detail. */
  swoosh: () => noise(0.42, 0.07, 900),

  /** Odemknutí vozu (vstup do interiéru). */
  unlock: () => {
    tone({ freq: 520, to: 900, duration: 0.12, gain: 0.16 });
    tone({ freq: 1240, duration: 0.1, gain: 0.12, delay: 0.13 });
  },

  /** Zamknutí / ukončení prohlídky. */
  lock: () => {
    tone({ freq: 780, to: 420, duration: 0.14, gain: 0.14 });
    noise(0.18, 0.06, 700);
  },

  /** Krok vpřed v interiéru. */
  step: () => tone({ freq: 640, to: 760, duration: 0.08, gain: 0.08 }),

  /** Dokončení prohlídky. */
  chime: () => {
    tone({ freq: 660, duration: 0.3, gain: 0.12, type: "triangle" });
    tone({ freq: 880, duration: 0.34, gain: 0.1, type: "triangle", delay: 0.12 });
    tone({ freq: 1320, duration: 0.4, gain: 0.08, type: "triangle", delay: 0.24 });
  },

  /** Fotoaparát — snapshot vozu. */
  shutter: () => {
    noise(0.06, 0.12, 4200);
    noise(0.12, 0.08, 2200);
  },

  /** Změna barvy laku. */
  paint: () => tone({ freq: 420, to: 720, duration: 0.16, gain: 0.08, type: "triangle" }),
};

/** Tichá showroomová atmosféra (dva rozladěné tóny + jemný šum). */
export const startAmbient = () => {
  const audio = ensureContext();
  if (!audio || !master || ambient) return;

  const gain = audio.createGain();
  gain.gain.value = 0.0001;
  gain.connect(master);
  gain.gain.exponentialRampToValueAtTime(0.045, audio.currentTime + 4);

  const osc = [55, 82.5, 110].map((freq, index) => {
    const o = audio.createOscillator();
    o.type = index === 2 ? "triangle" : "sine";
    o.frequency.value = freq + index * 0.4;
    o.connect(gain);
    o.start();
    return o;
  });

  ambient = { osc, gain };
};

export const stopAmbient = () => {
  if (!ambient || !ctx) return;

  const { osc, gain } = ambient;
  ambient = null;

  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);

  window.setTimeout(() => {
    osc.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* ignore */
      }
    });
    gain.disconnect();
  }, 900);
};

/** Musí být zavoláno z gesta uživatele (kliknutí), jinak iOS zvuk zablokuje. */
export const primeAudio = () => {
  ensureContext();
};

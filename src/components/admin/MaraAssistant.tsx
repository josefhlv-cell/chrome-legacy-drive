// MaraAssistant — postavička Máry v levém dolním rohu admin sekce.
// Komunikuje s adminem přes „notovou" bublinu nad hlavou.
//
// Chování:
// - Zpráva se zobrazí, typewriter doběhne a pak bublina ZŮSTANE otevřená 30 s.
// - Po 30 s zmizí jen text; Mára zůstane viditelná ještě 2 min, pak se schová.
// - Nad postavičkou (vlevo) je křížek (skrýt na 1 h).
// - Nad postavičkou (vpravo) je tlačítko s knížkou — znovu otevře poslední
//   zprávu na dalších 30 s.
// - Jednou denně Mára sama přijde s vtipem (po prvním mountu provideru).

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Music, X } from "lucide-react";
import maraGuitar from "@/assets/mara-guitar.png";

type MaraMessage = {
  id: string;
  text: string;
  title?: string;
  skipSlogan?: boolean;
};

interface MaraContextValue {
  say: (text: string, opts?: { title?: string; skipSlogan?: boolean }) => void;
  clear: () => void;
}

const MaraContext = createContext<MaraContextValue | null>(null);

export const useMara = () => {
  const ctx = useContext(MaraContext);
  if (!ctx) return { say: () => {}, clear: () => {} } as MaraContextValue;
  return ctx;
};

const SLOGAN = "Každé pondělí jeden hit od tebe pro tebe.";
const HIDDEN_UNTIL_KEY = "mara_hidden_until";
const JOKE_LAST_KEY = "mara_last_joke_date";
const SLOGAN_LAST_KEY = "mara_last_slogan_date";

const BUBBLE_VISIBLE_MS = 30_000; // 30 s otevřená bublina
const FIGURE_LINGER_MS = 120_000; // +2 min Mára zůstane bez textu

const JOKES = [
  "Víš proč mechanik nikdy nehraje poker? Pokaždé si nechá rozdat — a ještě s zárukou.",
  'Říká Chrysler Dodgi: „Hele, co děláš večer?" — „Nic, jsem v neutrálu."',
  'Přišel chlap do servisu: „Auto mi divně píská." Říkám: „To není auto, to je rádio — a hraje Chinaski."',
  'Ptá se zákazník: „Kolik koní má 300C?" Odpovídám: „Tolik, že ti uteče i účtenka."',
  'Lancia Flavia vchází do baru. Barman: „Tady nenaléváme." Flavia: „V pohodě, já piju jen prémiový benzín."',
  "Proč Ram 1500 nikdy nelže? Protože má pravdu na všech čtyřech.",
];

export const MaraProvider = ({ children }: { children: ReactNode }) => {
  const [queue, setQueue] = useState<MaraMessage[]>([]);
  const [current, setCurrent] = useState<MaraMessage | null>(null);
  const [lastMessage, setLastMessage] = useState<MaraMessage | null>(null);
  const [typed, setTyped] = useState("");
  const [hidden, setHidden] = useState(false);
  const typeTimerRef = useRef<number | null>(null);
  const hideBubbleTimerRef = useRef<number | null>(null);
  const lingerTimerRef = useRef<number | null>(null);

  // Initial: check whether Mára is hidden (after user closed her recently).
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(HIDDEN_UNTIL_KEY) || 0);
      if (until > Date.now()) setHidden(true);
    } catch { /* noop */ }
  }, []);

  const clearLingerTimer = () => {
    if (lingerTimerRef.current) {
      window.clearTimeout(lingerTimerRef.current);
      lingerTimerRef.current = null;
    }
  };

  const scheduleLinger = useCallback(() => {
    clearLingerTimer();
    lingerTimerRef.current = window.setTimeout(() => {
      setHidden(true);
    }, FIGURE_LINGER_MS);
  }, []);

  const say = useCallback((text: string, opts?: { title?: string; skipSlogan?: boolean }) => {
    setQueue((q) => [
      ...q,
      { id: crypto.randomUUID(), text, title: opts?.title, skipSlogan: opts?.skipSlogan },
    ]);
    setHidden(false);
    clearLingerTimer();
    try { localStorage.removeItem(HIDDEN_UNTIL_KEY); } catch { /* noop */ }
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
    setCurrent(null);
    setTyped("");
  }, []);

  // Promote next message from queue.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setLastMessage(next);
    setQueue(rest);
    setTyped("");
  }, [queue, current]);

  // Typewriter effect + 30s držení bubliny + 2min linger postavičky.
  useEffect(() => {
    if (!current) return;
    let includeSlogan = !current.skipSlogan;
    if (includeSlogan) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const isMonday = new Date().getDay() === 1;
        const lastSlogan = localStorage.getItem(SLOGAN_LAST_KEY);
        if (!isMonday || lastSlogan === today) {
          includeSlogan = false;
        } else {
          localStorage.setItem(SLOGAN_LAST_KEY, today);
        }
      } catch { includeSlogan = false; }
    }
    const fullText = current.text + (includeSlogan ? `\n\n${SLOGAN}` : "");
    let i = 0;
    const tick = () => {
      i += 2;
      setTyped(fullText.slice(0, i));
      if (i < fullText.length) {
        typeTimerRef.current = window.setTimeout(tick, 18);
      } else {
        // Bublina zůstává otevřená 30 s po dotypování.
        hideBubbleTimerRef.current = window.setTimeout(() => {
          setCurrent(null);
          setTyped("");
          scheduleLinger();
        }, BUBBLE_VISIBLE_MS);
      }
    };
    tick();
    return () => {
      if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
      if (hideBubbleTimerRef.current) window.clearTimeout(hideBubbleTimerRef.current);
    };
  }, [current, scheduleLinger]);

  const dismissCurrent = useCallback(() => {
    if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
    if (hideBubbleTimerRef.current) window.clearTimeout(hideBubbleTimerRef.current);
    setCurrent(null);
    setTyped("");
    scheduleLinger();
  }, [scheduleLinger]);

  const reopenLast = useCallback(() => {
    if (!lastMessage) return;
    clearLingerTimer();
    setCurrent({ ...lastMessage, id: crypto.randomUUID() });
    setTyped("");
  }, [lastMessage]);

  const hideForAWhile = useCallback(() => {
    setHidden(true);
    setCurrent(null);
    setQueue([]);
    clearLingerTimer();
    try {
      localStorage.setItem(HIDDEN_UNTIL_KEY, String(Date.now() + 60 * 60 * 1000));
    } catch { /* noop */ }
  }, []);

  // Jednou denně vtip.
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem(JOKE_LAST_KEY);
      if (last === today) return;
      const until = Number(localStorage.getItem(HIDDEN_UNTIL_KEY) || 0);
      if (until > Date.now()) return;
      const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
      const t = window.setTimeout(() => {
        say(joke, { title: "Vtip dne", skipSlogan: true });
        try { localStorage.setItem(JOKE_LAST_KEY, today); } catch { /* noop */ }
      }, 8000);
      return () => window.clearTimeout(t);
    } catch { /* noop */ }
  }, [say]);

  const value = useMemo(() => ({ say, clear }), [say, clear]);

  return (
    <MaraContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {!hidden && (
          <motion.div
            key="mara"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="fixed bottom-3 left-3 z-[60] pointer-events-none select-none"
            style={{ width: 182 }}
          >
            {/* Ovládací tlačítka nad postavičkou */}
            <div className="flex justify-between items-center mb-1 pointer-events-auto">
              <button
                type="button"
                onClick={hideForAWhile}
                aria-label="Skrýt Máru"
                className="w-7 h-7 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center hover:bg-secondary transition"
                title="Skrýt na hodinu"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
              {lastMessage && !current && (
                <button
                  type="button"
                  onClick={reopenLast}
                  aria-label="Znovu zobrazit zprávu"
                  className="w-7 h-7 rounded-full bg-background/90 border border-primary/40 shadow-md flex items-center justify-center hover:bg-primary/10 transition"
                  title="Znovu otevřít zprávu"
                >
                  <BookOpen className="w-4 h-4 text-primary" />
                </button>
              )}
            </div>

            {/* Note-shaped speech bubble */}
            <AnimatePresence>
              {current && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="pointer-events-auto absolute left-[156px] bottom-[182px] w-[364px] max-w-[80vw]"
                >
                  <div className="relative rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-sm shadow-2xl p-4 pr-8">
                    <button
                      type="button"
                      onClick={dismissCurrent}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                      aria-label="Zavřít zprávu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5 text-[13px] uppercase tracking-wider text-primary font-semibold mb-1.5">
                      <Music className="w-4 h-4" />
                      {current.title || "AI"}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{typed}</p>
                    {/* speech bubble tail */}
                    <div className="absolute -bottom-2 left-6 w-4 h-4 bg-card border-r border-b border-primary/30 rotate-45" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mára figure */}
            <img
              src={maraGuitar}
              alt="Mára"
              className="w-[182px] h-auto pointer-events-none drop-shadow-2xl"
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MaraContext.Provider>
  );
};

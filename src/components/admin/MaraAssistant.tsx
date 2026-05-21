// MaraAssistant — postavička Máry v levém dolním rohu admin sekce.
// Komunikuje s adminem přes „notovou" bublinu nad hlavou.
// Použij hook useMara() v jakékoliv komponentě:
//   const { say } = useMara(); say("Cenový návrh: 649 000 Kč");
//
// Každá zpráva se zobrazí v bublině, na konci je vždy slogan
// „Jako každý den jeden hit od tebe pro tebe." (lze potlačit pro speciální případy).
// Křížek nad postavičkou skryje Máru na ~1h.

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Music, X } from "lucide-react";
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

const SLOGAN = "Jako každý den jeden hit od tebe pro tebe.";
const HIDDEN_UNTIL_KEY = "mara_hidden_until";

export const MaraProvider = ({ children }: { children: ReactNode }) => {
  const [queue, setQueue] = useState<MaraMessage[]>([]);
  const [current, setCurrent] = useState<MaraMessage | null>(null);
  const [typed, setTyped] = useState("");
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Initial: check whether Mára is hidden (after user closed her recently).
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(HIDDEN_UNTIL_KEY) || 0);
      if (until > Date.now()) setHidden(true);
    } catch { /* noop */ }
  }, []);

  const say = useCallback((text: string, opts?: { title?: string; skipSlogan?: boolean }) => {
    setQueue((q) => [
      ...q,
      { id: crypto.randomUUID(), text, title: opts?.title, skipSlogan: opts?.skipSlogan },
    ]);
    // If user had hidden Mára, an explicit new message brings her back.
    setHidden(false);
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
    setQueue(rest);
    setTyped("");
  }, [queue, current]);

  // Typewriter effect.
  useEffect(() => {
    if (!current) return;
    const fullText = current.text + (current.skipSlogan ? "" : `\n\n${SLOGAN}`);
    let i = 0;
    const tick = () => {
      i += 2;
      setTyped(fullText.slice(0, i));
      if (i < fullText.length) {
        timerRef.current = window.setTimeout(tick, 18);
      } else {
        // Auto-dismiss after reading time (5s min, 12s max).
        const readMs = Math.min(12000, Math.max(5000, fullText.length * 35));
        timerRef.current = window.setTimeout(() => setCurrent(null), readMs);
      }
    };
    tick();
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [current]);

  const dismissCurrent = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setCurrent(null);
    setTyped("");
  }, []);

  const hideForAWhile = useCallback(() => {
    setHidden(true);
    setCurrent(null);
    setQueue([]);
    try {
      localStorage.setItem(HIDDEN_UNTIL_KEY, String(Date.now() + 60 * 60 * 1000));
    } catch { /* noop */ }
  }, []);

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
            style={{ width: 140 }}
          >
            {/* Close button (above figure) */}
            <div className="flex justify-end mb-1 pointer-events-auto">
              <button
                type="button"
                onClick={hideForAWhile}
                aria-label="Skrýt Máru"
                className="w-6 h-6 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center hover:bg-secondary transition"
                title="Skrýt na hodinu"
              >
                <X className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>

            {/* Note-shaped speech bubble */}
            <AnimatePresence>
              {current && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="pointer-events-auto absolute left-[120px] bottom-[140px] w-[280px] max-w-[70vw]"
                >
                  <div className="relative rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-sm shadow-2xl p-3 pr-7">
                    <button
                      type="button"
                      onClick={dismissCurrent}
                      className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
                      aria-label="Zavřít zprávu"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                      <Music className="w-3 h-3" />
                      {current.title || "AI"}
                    </div>
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">{typed}</p>
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
              className="w-[140px] h-auto pointer-events-none drop-shadow-2xl"
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MaraContext.Provider>
  );
};

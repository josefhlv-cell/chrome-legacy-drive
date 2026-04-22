import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import appPreview from "@/assets/app-preview.jpeg";

const SHOWN_KEY = "app-modal-shown";
const AUTO_CLOSE_MS = 20000;

const APP_MESSAGE =
  "Milí zákazníci, naše aplikace pro vás je v poslední fázi testování a brzy bude spuštěna. Připravili jsme si pro vás něco, co jinde neuvidíte. Představte si váš osobní kapesní servis, kde máte vše, co je potřeba: objednání servisu, servisní knížku, náhradní díly, vaše servisní intervaly a především online diagnostiku vašeho vozu s podporou našich mechaniků, i když s ním budete třeba mimo republiku. Budeme vaše podpora, ať jste kdekoliv. A mnoho dalšího! Máte se na co těšit! Bude to jízda! Společná jízda!";

const AppBanner = () => {
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_MS / 1000);
  const [keepOpen, setKeepOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const close = () => {
    setOpen(false);
    clearTimers();
  };

  const openModal = () => {
    setOpen(true);
    setKeepOpen(false);
    setSecondsLeft(AUTO_CLOSE_MS / 1000);
    clearTimers();
    timerRef.current = window.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
  };

  const handleKeepOpen = () => {
    clearTimers();
    setKeepOpen(true);
  };

  // Auto-open for new visitors (once per session)
  useEffect(() => {
    const shown = sessionStorage.getItem(SHOWN_KEY);
    if (!shown) {
      sessionStorage.setItem(SHOWN_KEY, "1");
      openModal();
    }
  }, []);

  // Intercept ANY click on a link to the app domain
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (
        href.includes("chryslerpardubice.site") &&
        !href.includes("chdp.chryslerpardubice.site")
      ) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Brzy spustíme naši aplikaci"
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="glass-card relative w-[95vw] md:w-[60vw] max-w-4xl p-6 md:p-8 border-primary/40 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Countdown header */}
            <div className="flex items-center justify-between gap-3 mb-5 pb-4 pr-10 border-b border-primary/20">
              {keepOpen ? (
                <button
                  onClick={close}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm md:text-base font-semibold font-montserrat"
                >
                  Zavřít
                </button>
              ) : (
                <>
                  <p className="text-sm md:text-base font-semibold tracking-wider text-primary font-montserrat">
                    Zavře se za:{" "}
                    <span className="text-foreground tabular-nums text-base md:text-lg">
                      {secondsLeft}s
                    </span>
                  </p>
                  <button
                    onClick={handleKeepOpen}
                    className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors text-xs md:text-sm font-semibold font-montserrat whitespace-nowrap"
                  >
                    Nezavírat okno
                  </button>
                </>
              )}
              <button
                onClick={close}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-primary/10"
                aria-label="Zavřít"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-5">
              <div className="flex-1 text-center md:text-left order-2 md:order-1">
                <h2 className="text-lg md:text-xl font-bold text-foreground font-serif mb-3">
                  Brzy spustíme naši aplikaci
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed font-montserrat">
                  {APP_MESSAGE}
                </p>
              </div>
              <div className="shrink-0 w-40 md:w-44 order-1 md:order-2">
                <img
                  src={appPreview}
                  alt="Ukázka mobilní aplikace Chrysler - Dodge Pardubice"
                  className="w-full rounded-xl border border-primary/30 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
                  loading="lazy"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppBanner;

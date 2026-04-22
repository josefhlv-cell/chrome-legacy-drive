import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import appPreview from "@/assets/app-preview.jpeg";

const SHOWN_KEY = "app-modal-shown";
const AUTO_CLOSE_MS = 10000;

const APP_MESSAGE =
  "Milí zákazníci, naše aplikace pro vás je v poslední fázi testování a brzy bude spuštěna. Připravili jsme si pro vás něco, co jinde neuvidíte. Představte si váš osobní kapesní servis, kde máte vše, co je potřeba: objednání servisu, servisní knížku, náhradní díly, vaše servisní intervaly a především online diagnostiku vašeho vozu s podporou našich mechaniků, i když s ním budete třeba mimo republiku. Budeme vaše podpora, ať jste kdekoliv. A mnoho dalšího! Máte se na co těšit! Bude to jízda! Společná jízda!";

const AppBanner = () => {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const close = () => {
    setOpen(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const openModal = () => {
    setOpen(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
  };

  // Auto-open for new visitors (once per session)
  useEffect(() => {
    const shown = sessionStorage.getItem(SHOWN_KEY);
    if (!shown) {
      sessionStorage.setItem(SHOWN_KEY, "1");
      openModal();
    }
  }, []);

  // Intercept any link/button to chryslerpardubice.site (the app URL)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      // Match any link pointing to the (yet-to-be-launched) app
      if (
        href.includes("chryslerpardubice.site") &&
        !href.includes("chdp.chryslerpardubice.site")
      ) {
        e.preventDefault();
        openModal();
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
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
            className="glass-card relative max-w-3xl w-full p-6 md:p-8 border-primary/40"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={close}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Zavřít"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="shrink-0 w-40 md:w-48">
                <img
                  src={appPreview}
                  alt="Ukázka mobilní aplikace Chrysler - Dodge Pardubice"
                  className="w-full rounded-xl border border-primary/30 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
                  loading="lazy"
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-lg md:text-xl font-bold text-foreground font-serif mb-3">
                  Brzy spustíme naši aplikaci
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed font-montserrat">
                  {APP_MESSAGE}
                </p>
                <p className="mt-3 text-xs text-primary font-semibold tracking-wider">
                  Toto okno se za 10 vteřin samo zavře.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppBanner;

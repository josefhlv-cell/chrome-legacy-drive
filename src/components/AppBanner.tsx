import { useState, useEffect } from "react";
import { X, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const APP_URL = "https://chryslerpardubice.site/";
const BANNER_DISMISSED_KEY = "app-banner-dismissed";

const AppBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "1");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-primary/30 shadow-[0_-4px_30px_rgba(0,0,0,0.4)]"
        >
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Star className="w-6 h-6 text-primary shrink-0 fill-primary" />
              <p className="text-xs md:text-sm text-muted-foreground truncate md:whitespace-normal">
                <span className="font-semibold text-foreground">Chrysler - Dodge Pardubice</span>
                <span className="hidden sm:inline"> — Mějte náš tým stále v kapse. Katalog dílů, VIN filtr a servisní historie.</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="chrome-button text-xs px-4 py-2"
              >
                Otevřít aplikaci
              </a>
              <button
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Zavřít banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppBanner;

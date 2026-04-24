import { useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

const STORAGE_KEY = "force-desktop-view";
const VIEWPORT_META_DESKTOP = "width=1280";
const VIEWPORT_META_MOBILE = "width=device-width, initial-scale=1.0, viewport-fit=cover";

const isMobileDevice = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

const applyDesktopMode = (forceDesktop: boolean) => {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute("content", forceDesktop ? VIEWPORT_META_DESKTOP : VIEWPORT_META_MOBILE);
};

const MobileViewToggle = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    const stored = localStorage.getItem(STORAGE_KEY) === "1";
    if (stored) {
      setForced(true);
      applyDesktopMode(true);
    }
  }, []);

  // Show button on actual mobile devices OR when desktop view is currently forced (so user can switch back)
  if (!isMobile && !forced) return null;

  const toggle = () => {
    const next = !forced;
    setForced(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    applyDesktopMode(next);
  };

  return (
    <div className="w-full border-t border-border/40 bg-background/80 py-3 text-center">
      <button
        onClick={toggle}
        className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-foreground hover:text-primary transition-colors font-montserrat"
        aria-label={forced ? "Přepnout na mobilní verzi" : "Přepnout na počítačovou verzi"}
      >
        {forced ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
        {forced ? "Přepnout na mobilní verzi" : "Přepnout na počítačovou verzi"}
      </button>
    </div>
  );
};

export default MobileViewToggle;

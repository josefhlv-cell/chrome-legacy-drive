import { Eye, EyeOff, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { VIEWS, type ViewKey } from "../data/tourData";

type Props = {
  view: ViewKey;
  onView: (v: ViewKey) => void;
  onReset: () => void;
  hotspotsVisible: boolean;
  onToggleHotspots: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  usingRealModel: boolean;
  /** Odsadit spodní navigaci, když je otevřený detail (mobil). */
  sheetOpen: boolean;
};

const iconBtn =
  "h-10 w-10 rounded-full border border-white/12 bg-white/8 backdrop-blur-md grid place-items-center text-white/85 transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95";

export const TourNav = ({
  view,
  onView,
  onReset,
  hotspotsVisible,
  onToggleHotspots,
  fullscreen,
  onToggleFullscreen,
  onClose,
  usingRealModel,
  sheetOpen,
}: Props) => (
  <>
    {/* Horní lišta — kompaktní, neruší výhled na vůz */}
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pt-[max(0.8rem,env(safe-area-inset-top))] pb-2">
      <div className="pointer-events-auto">
        <p className="text-[9px] uppercase tracking-[0.3em] text-primary">Digitální showroom</p>
        <h1 className="font-serif text-[15px] md:text-lg italic text-white/95">Chrysler Pacifica</h1>
        {!usingRealModel && (
          <p className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-white/40">
            Náhledový 3D model — ilustrační
          </p>
        )}
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleHotspots}
          aria-label={hotspotsVisible ? "Skrýt body zájmu" : "Zobrazit body zájmu"}
          aria-pressed={hotspotsVisible}
          className={iconBtn}
        >
          {hotspotsVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onReset} aria-label="Vrátit vůz do výchozího stavu" className={iconBtn}>
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? "Ukončit celou obrazovku" : "Celá obrazovka"}
          className={`${iconBtn} hidden sm:grid`}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onClose} aria-label="Zavřít prohlídku" className={iconBtn}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>

    {/* Navigace pohledů */}
    <div
      className={`absolute inset-x-0 z-30 px-3 transition-[bottom] duration-400 ${
        sheetOpen ? "bottom-[calc(env(safe-area-inset-bottom)+6.6rem)] md:bottom-0" : "bottom-0"
      }`}
    >
      <div className="mx-auto w-full max-w-2xl overflow-x-auto no-scrollbar pb-[max(0.7rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex min-w-max items-center gap-1 rounded-full border border-white/10 bg-black/50 p-1.5 backdrop-blur-xl">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => onView(v.key)}
              aria-current={v.key === view}
              className={`h-10 rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                v.key === view
                  ? "bg-primary text-primary-foreground shadow-[0_6px_22px_hsl(var(--primary)/0.45)]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  </>
);

export default TourNav;

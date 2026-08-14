import { Eye, EyeOff, Maximize2, Minimize2, Orbit, RotateCcw, X } from "lucide-react";
import { BODY_COLORS, MODEL_ATTRIBUTION } from "../data/tourData";

type Props = {
  onReset: () => void;
  hotspotsVisible: boolean;
  onToggleHotspots: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  colorKey: string;
  onColor: (key: string) => void;
  /** Odsadit spodní lištu, když je otevřený detail (mobil). */
  sheetOpen: boolean;
};

const iconBtn =
  "h-11 w-11 rounded-full border border-white/12 bg-white/8 backdrop-blur-md grid place-items-center text-white/85 transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95";

export const TourNav = ({
  onReset,
  hotspotsVisible,
  onToggleHotspots,
  fullscreen,
  onToggleFullscreen,
  onClose,
  autoRotate,
  onToggleAutoRotate,
  colorKey,
  onColor,
  sheetOpen,
}: Props) => (
  <>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none">
        <p className="text-[9px] uppercase tracking-[0.32em] text-primary">Digitální showroom</p>
        <h1 className="font-serif text-base md:text-lg text-white leading-tight">
          Chrysler <span className="italic">Pacifica</span>
        </h1>
        <p className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-white/40">{MODEL_ATTRIBUTION}</p>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleHotspots}
          aria-label={hotspotsVisible ? "Skrýt body zájmu" : "Spustit prohlídku — zobrazit body zájmu"}
          aria-pressed={hotspotsVisible}
          className={iconBtn}
        >
          {hotspotsVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onToggleAutoRotate}
          aria-label={autoRotate ? "Vypnout auto-rotaci" : "Zapnout auto-rotaci"}
          aria-pressed={autoRotate}
          className={`${iconBtn} ${autoRotate ? "!bg-primary/85 !text-primary-foreground" : ""}`}
        >
          <Orbit className="h-4 w-4" />
        </button>
        <button type="button" onClick={onReset} aria-label="Reset pohledu" className={iconBtn}>
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? "Ukončit celou obrazovku" : "Celá obrazovka"}
          className={iconBtn}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onClose} aria-label="Zavřít prohlídku" className={iconBtn}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>

    {/* Volba barvy laku */}
    <div
      className={`absolute inset-x-0 z-30 px-3 transition-[bottom] duration-500 ${
        sheetOpen ? "bottom-[calc(env(safe-area-inset-bottom)+7rem)] md:bottom-0" : "bottom-0"
      }`}
    >
      <div className="mx-auto w-full max-w-xl pb-[max(0.7rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-xl">
          <span className="hidden sm:block text-[9px] uppercase tracking-[0.2em] text-white/45">Barva laku</span>
          {BODY_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onColor(c.key)}
              aria-label={`Barva laku: ${c.label}`}
              aria-pressed={c.key === colorKey}
              title={c.label}
              className={`h-9 w-9 rounded-full border-2 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                c.key === colorKey ? "border-primary scale-110" : "border-white/25"
              }`}
              style={{
                background: c.hex
                  ? `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), ${c.hex} 62%)`
                  : "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.5), #2b2d31 62%)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  </>
);

export default TourNav;

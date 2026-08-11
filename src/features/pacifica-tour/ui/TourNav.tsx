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
};

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
}: Props) => (
  <>
    {/* Horní lišta */}
    <div className="absolute top-0 left-0 right-0 z-30 flex items-start justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-3 pointer-events-none">
      <div className="pointer-events-auto">
        <p className="text-[10px] uppercase tracking-[0.32em] text-primary">Digitální showroom</p>
        <h1 className="font-serif italic text-base md:text-lg text-white/95">Chrysler Pacifica</h1>
        {!usingRealModel && (
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-white/45">
            Náhledový 3D model — ilustrační
          </p>
        )}
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleHotspots}
          aria-label={hotspotsVisible ? "Skrýt hotspoty" : "Zobrazit hotspoty"}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 active:scale-95 transition"
        >
          {hotspotsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset kamery"
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 active:scale-95 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label="Celá obrazovka"
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 active:scale-95 transition"
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít prohlídku"
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 active:scale-95 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>

    {/* Navigace pohledů */}
    <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-2xl overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 p-1.5 rounded-full border border-white/12 bg-black/45 backdrop-blur-xl min-w-max mx-auto">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => onView(v.key)}
              className={`px-4 h-10 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
                v.key === view
                  ? "bg-primary text-primary-foreground shadow-[0_6px_24px_hsl(var(--primary)/0.45)]"
                  : "text-white/75 hover:text-white"
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

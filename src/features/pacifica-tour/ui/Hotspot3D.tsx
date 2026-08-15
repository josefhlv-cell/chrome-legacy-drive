import type {} from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  active: boolean;
  onSelect: (h: TourHotspot) => void;
};

/**
 * Hotspot 3D ukotvený přímo ke skutečné pozici na modelu.
 *
 * DŮLEŽITÉ:
 * - pozici neurčuje CSS, ale hotspot.position v tourData.ts
 * - HTML prvek má pouze vizuální velikost
 * - žádné transformace X/Y, které by hotspot od modelu odlepovaly
 * - na mobilu je bod menší a text se zobrazuje pouze u aktivního bodu
 */
export const Hotspot3D = ({ hotspot, active, onSelect }: Props) => {
  return (
    <Html
      position={hotspot.position}
      center
      distanceFactor={9}
      zIndexRange={[30, 10]}
      occlude={false}
      transform={false}
      sprite
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(hotspot);
        }}
        aria-label={hotspot.label}
        className="group pointer-events-auto relative flex min-h-[40px] min-w-[40px] items-center justify-center p-2 touch-manipulation"
        style={{
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Malý modrý bod */}
        <span
          className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 ${
            active ? "scale-110" : "scale-100"
          }`}
        >
          {/* Jemná aura místo velkého pulzujícího kruhu */}
          <span
            className={`absolute inset-0 rounded-full bg-primary/20 transition-all duration-200 ${
              active ? "scale-125 opacity-100" : "scale-100 opacity-70"
            }`}
          />

          {/* Vnější prstenec */}
          <span
            className={`absolute rounded-full border border-primary/70 transition-all duration-200 ${
              active ? "h-6 w-6" : "h-5 w-5"
            }`}
          />

          {/* Středový bod */}
          <span
            className={`relative rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.75)] transition-all duration-200 ${
              active ? "h-3 w-3" : "h-2.5 w-2.5"
            }`}
          />
        </span>

        {/* Název pouze u aktivního hotspotu.
            Na mobilu se tak obraz nezahltí modrými štítky. */}
        <span
          className={`pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white shadow-lg backdrop-blur-md transition-all duration-200 ${
            active
              ? "translate-x-0 opacity-100"
              : "pointer-events-none translate-x-1 opacity-0"
          }`}
        >
          {hotspot.label}
        </span>
      </button>
    </Html>
  );
};

export default Hotspot3D;

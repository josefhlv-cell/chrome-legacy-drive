import type {} from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  active: boolean;
  onSelect: (h: TourHotspot) => void;
};

/**
 * Hotspot ukotvený ke skutečné 3D pozici na modelu.
 * Malý, elegantní, animovaný — text až po kliknutí.
 */
export const Hotspot3D = ({ hotspot, active, onSelect }: Props) => (
  <Html position={hotspot.position} center distanceFactor={7} zIndexRange={[20, 10]}>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(hotspot);
      }}
      aria-label={hotspot.label}
      className="group relative flex items-center gap-2 pointer-events-auto"
    >
      <span className="relative flex items-center justify-center w-6 h-6">
        <span className="absolute inset-0 rounded-full bg-primary/45 animate-ping" />
        <span
          className={`relative rounded-full bg-primary ring-4 ring-primary/25 shadow-[0_0_20px_hsl(var(--primary))] transition-all ${
            active ? "w-3.5 h-3.5" : "w-2.5 h-2.5"
          }`}
        />
      </span>
      <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] tracking-wide text-white whitespace-nowrap opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
        {hotspot.label}
      </span>
    </button>
  </Html>
);

export default Hotspot3D;

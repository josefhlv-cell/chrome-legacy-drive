import type {} from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  active: boolean;
  visited?: boolean;
  onSelect: (h: TourHotspot) => void;
};

export const Hotspot3D = ({
  hotspot,
  active,
  visited = false,
  onSelect,
}: Props) => (
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
      onClick={(event) => {
        event.stopPropagation();
        onSelect(hotspot);
      }}
      aria-label={hotspot.label}
      className="group pointer-events-auto relative flex min-h-[40px] min-w-[40px] items-center justify-center p-2 touch-manipulation"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        className={`relative grid h-7 w-7 place-items-center rounded-full transition-transform duration-200 ${
          active ? "scale-110" : "scale-100"
        }`}
      >
        <span
          className={`absolute inset-0 rounded-full transition-all duration-300 ${
            active
              ? "scale-125 bg-primary/25"
              : visited
                ? "bg-emerald-400/10"
                : "bg-primary/15"
          }`}
        />

        <span
          className={`absolute rounded-full border transition-all duration-300 ${
            active
              ? "h-6 w-6 border-primary"
              : visited
                ? "h-5 w-5 border-emerald-400/65"
                : "h-5 w-5 border-primary/70"
          }`}
        />

        <span
          className={`relative rounded-full shadow-[0_0_12px_currentColor] transition-all duration-300 ${
            active
              ? "h-3 w-3 bg-primary text-primary"
              : visited
                ? "h-2.5 w-2.5 bg-emerald-400 text-emerald-400"
                : "h-2.5 w-2.5 bg-primary text-primary"
          }`}
        />
      </span>

      <span
        className={`pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white shadow-lg backdrop-blur-md transition-all duration-200 ${
          active
            ? "translate-x-0 opacity-100"
            : "translate-x-1 opacity-0"
        }`}
      >
        {visited ? "✓ " : ""}
        {hotspot.label}
      </span>
    </button>
  </Html>
);

export default Hotspot3D;

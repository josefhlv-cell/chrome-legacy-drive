import { useState } from "react";
import { Html } from "@react-three/drei";
import type { TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  active: boolean;
  visited?: boolean;
  onSelect: (h: TourHotspot) => void;
};

const KEY_ASSET = "/pacifica/virtual-tour/interior-key.png";

export const Hotspot3D = ({
  hotspot,
  active,
  visited = false,
  onSelect,
}: Props) => {
  const [keyOpened, setKeyOpened] = useState(false);

  const isDriverEntry = hotspot.id === "driver-entry";

  if (isDriverEntry) {
    return (
      <Html
        position={hotspot.position}
        center
        distanceFactor={9}
        zIndexRange={[50, 20]}
        occlude={false}
        transform={false}
        sprite
      >
        {!keyOpened ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setKeyOpened(true);
            }}
            aria-label="Zobrazit klíč"
            className="pointer-events-auto relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-black/55 p-2 shadow-2xl backdrop-blur-md transition-transform duration-300 hover:scale-105 active:scale-95"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <img
              src={KEY_ASSET}
              alt="Klíč od vozu"
              className="h-full w-full object-contain"
              draggable={false}
            />

            <span className="absolute inset-0 rounded-2xl bg-primary/10 opacity-0 transition-opacity duration-300 hover:opacity-100" />

            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[10px] font-medium tracking-wide text-white shadow-lg backdrop-blur-md">
              Náhled interiéru
            </span>
          </button>
        ) : (
          <div className="pointer-events-auto relative">
            <div className="relative h-64 w-44">
              <img
                src={KEY_ASSET}
                alt="Klíč od vozu"
                className="h-full w-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.55)]"
                draggable={false}
              />

              {/* Pulzující hotspot na tlačítku ODEMKNOUT */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(hotspot);
                }}
                aria-label="Odemknout vůz a vstoupit do interiéru"
                className="absolute left-[31%] top-[10%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <span className="absolute h-14 w-14 animate-ping rounded-full bg-primary/30" />

                <span className="absolute h-11 w-11 animate-pulse rounded-full border-2 border-primary bg-primary/20 shadow-[0_0_25px_hsl(var(--primary))]" />

                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary))]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="10"
                      rx="2"
                    />
                    <path d="M7 11V7a5 5 0 0 1 10 0v1" />
                  </svg>
                </span>
              </button>

              <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/30 bg-black/80 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white shadow-lg backdrop-blur-md">
                Odemknout interiér
              </span>
            </div>
          </div>
        )}
      </Html>
    );
  }

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
};

export default Hotspot3D;

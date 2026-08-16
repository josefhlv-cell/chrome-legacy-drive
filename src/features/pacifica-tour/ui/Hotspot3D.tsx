import { useEffect, useState } from "react";
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

  // Po zavření panelu se klíč vrátí do výchozího placeholderu.
  useEffect(() => {
    if (isDriverEntry && !active) {
      setKeyOpened(false);
    }
  }, [active, isDriverEntry]);

  /*
   * SPECIÁLNÍ HOTSPOT PRO VSTUP DO INTERIÉRU
   *
   * 1. Nejprve se zobrazí placeholder klíče.
   * 2. Klepnutí zobrazí velký klíč.
   * 3. Na ikoně ODEMKNOUT začne pulsovat hotspot.
   * 4. Klepnutí na odemknutí zavolá onSelect()
   *    a rodič přepne prohlídku do interiéru.
   */
  if (isDriverEntry) {
    return (
      <Html
        position={hotspot.position}
        center
        distanceFactor={9}
        zIndexRange={[60, 20]}
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
            aria-label="Zobrazit klíč a odemknout interiér"
            className="pointer-events-auto relative flex h-20 w-14 items-center justify-center rounded-2xl border border-white/15 bg-black/60 p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.5)] backdrop-blur-md transition-transform duration-300 hover:scale-105 active:scale-95"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <img
              src={KEY_ASSET}
              alt="Klíč od vozu"
              className="h-full w-full object-contain"
              draggable={false}
            />

            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/80 px-3 py-1.5 text-[10px] font-medium tracking-wide text-white shadow-lg backdrop-blur-md">
              Náhled interiéru
            </span>
          </button>
        ) : (
          <div className="pointer-events-auto relative">
            <div className="relative h-[270px] w-[172px]">
              <img
                src={KEY_ASSET}
                alt="Klíč od vozu"
                className="h-full w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.6)]"
                draggable={false}
              />

              {/*
               * HOTSPOT PŘÍMO NA IKONĚ ODEMKNOUT
               *
               * Pozice odpovídá skutečnému umístění tlačítka
               * odemknutí na připraveném PNG.
               */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(hotspot);
                }}
                aria-label="Odemknout vůz a vstoupit do interiéru"
                className="absolute left-[53%] top-[19%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {/* Vnější pulz */}
                <span className="absolute h-16 w-16 animate-ping rounded-full bg-primary/30" />

                {/* Druhý pulzující kruh */}
                <span className="absolute h-12 w-12 animate-pulse rounded-full border-2 border-primary bg-primary/20 shadow-[0_0_30px_hsl(var(--primary))]" />

                {/* Střed hotspotu */}
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_22px_hsl(var(--primary))]">
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

              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/30 bg-black/85 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white shadow-lg backdrop-blur-md">
                Odemknout interiér
              </span>
            </div>
          </div>
        )}
      </Html>
    );
  }

  /*
   * STANDARDNÍ EXTERIÉROVÉ HOTSPOTY
   */
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

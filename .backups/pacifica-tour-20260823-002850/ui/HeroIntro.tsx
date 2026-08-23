import { ArrowRight, X } from "lucide-react";

type Props = {
  onStart: () => void;
  onClose: () => void;
};

/**
 * Úvodní hero obrazovka prohlídky — fotografie konkrétního vozu
 * Chrysler Pacifica v cinematic tmavém prostředí. Fotografie je dominantní,
 * UI minimální, CTA spouští skutečný WebGL showroom.
 */
export const HeroIntro = ({ onStart, onClose }: Props) => (
  <div className="fixed inset-0 z-50 bg-[#05070b] overflow-hidden animate-in fade-in duration-500">
    {/* Fotografie konkrétního vozu — na mobilu v horní části, aby byl vůz celý vidět */}
    <div className="absolute inset-x-0 top-0 h-[62%] md:inset-0 md:h-full">
      <img
        src="/pacifica-hero.webp"
        alt="Chrysler Pacifica — konkrétní vůz v nabídce Chrysler Pardubice"
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover object-[54%_46%] md:object-[58%_62%]"
      />
    </div>

    {/* Jemné cinematic ztmavení pro čitelnost textu */}
    <div className="absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/50 to-[#05070b]/20 md:bg-gradient-to-r md:from-[#05070b]/92 md:via-[#05070b]/35 md:to-transparent" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,transparent_38%,rgba(5,7,11,0.9)_100%)]" />

    <button
      type="button"
      onClick={onClose}
      aria-label="Zavřít prohlídku"
      className="absolute top-[max(0.9rem,env(safe-area-inset-top))] right-4 z-10 h-11 w-11 rounded-full border border-white/15 bg-white/10 backdrop-blur-md text-white/90 grid place-items-center transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
    >
      <X className="h-4 w-4" />
    </button>

    <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:right-auto md:w-[52%] md:max-w-xl flex flex-col justify-end md:justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-14 md:pb-0">
      <p className="text-[10px] uppercase tracking-[0.42em] text-primary">Digitální showroom</p>
      <h1 className="mt-2 font-serif text-[2.1rem] leading-[1.05] md:text-6xl text-white">
        Chrysler <span className="italic">Pacifica</span>
      </h1>
      <p className="mt-3 max-w-md text-sm md:text-base leading-relaxed text-white/70">
        Prémiový rodinný van pro sedm až osm cestujících. Prohlédněte si vůz ve 3D — otevřete posuvné dveře,
        páté dveře i kapotu a projděte si interiér řada po řadě.
      </p>

      <button
        type="button"
        onClick={onStart}
        className="group mt-7 md:mt-9 inline-flex h-14 w-full md:w-auto md:px-9 items-center justify-center gap-3 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold uppercase tracking-[0.16em] shadow-[0_18px_50px_hsl(var(--primary)/0.45)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.985]"
      >
        Spustit 3D prohlídku
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>

      <p className="mt-4 mb-1 text-[10px] uppercase tracking-[0.2em] text-white/35">
        Fotografie konkrétního vozu — Chrysler Pardubice
      </p>
    </div>
  </div>
);

export default HeroIntro;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Play, RotateCcw, X } from "lucide-react";
import {
  CONFIG_MODES,
  INTERIOR_STEPS,
  type InteriorStep,
  type PhotoHotspot,
  type TourCard,
} from "../data/interiorTour";

type Props = {
  /** Zpět na 3D exteriér (z prvního kroku). */
  onExitToExterior: () => void;
  /** Úplné ukončení prohlídky. */
  onClose: () => void;
};

const btnPrimary =
  "h-12 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold px-6 flex items-center justify-center gap-2 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.985]";
const btnGhost =
  "h-12 rounded-full border border-white/15 bg-white/8 text-white text-[13px] font-semibold px-5 flex items-center justify-center gap-2 backdrop-blur-md transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.985]";

/** Informační karta — bottom sheet na mobilu, panel vpravo na desktopu. */
const InfoCard = ({ card, onClose }: { card: TourCard; onClose?: () => void }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 md:inset-y-0 md:left-auto md:right-0 md:flex md:items-center md:p-5">
    <section
      aria-label={card.title}
      className="pointer-events-auto w-full md:w-[420px] max-h-[62vh] md:max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-[26px] md:rounded-3xl border border-white/10 bg-[hsl(var(--card)/0.9)] backdrop-blur-xl shadow-[0_-16px_60px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom md:slide-in-from-right duration-400 px-5 md:px-6 pt-5 pb-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.28em] text-primary">{card.eyebrow}</p>
          <h2 className="mt-1 font-serif text-lg md:text-xl leading-tight text-foreground">{card.title}</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít kartu"
            className="h-9 w-9 shrink-0 rounded-full border border-white/12 bg-white/8 grid place-items-center text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{card.text}</p>

      {card.bullets && card.bullets.length > 0 && (
        <ul className="mt-3.5 space-y-2">
          {card.bullets.map((b) => (
            <li key={b} className="flex gap-2.5 text-[12.5px] leading-snug text-foreground/85">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {card.sections?.map((s) => (
        <div key={s.title} className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/90">{s.title}</p>
          <ul className="mt-2.5 space-y-1.5">
            {s.items.map((i) => (
              <li key={i} className="text-[12px] leading-snug text-foreground/80">
                {i}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {card.note && <p className="mt-4 text-[11px] leading-relaxed text-white/45">{card.note}</p>}
    </section>
  </div>
);

/** Fotografický krok — reálná fotka vozu s jemnými hotspoty a zoomem k detailu. */
const PhotoStep = ({
  step,
  onAdvance,
}: {
  step: Extract<InteriorStep, { kind: "photo" }>;
  onAdvance: () => void;
}) => {
  const [openCard, setOpenCard] = useState<TourCard | null>(step.intro ?? null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState(CONFIG_MODES[0].key);

  useEffect(() => {
    setOpenCard(step.intro ?? null);
    setZoom(null);
  }, [step]);

  const pick = (h: PhotoHotspot) => {
    if (h.advance && !h.card) {
      onAdvance();
      return;
    }
    setZoom({ x: h.x, y: h.y });
    if (h.card) setOpenCard(h.card);
  };

  const activeMode = CONFIG_MODES.find((m) => m.key === mode)!;

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center p-2 md:p-6">
        <div
          className="relative w-full max-h-full overflow-hidden rounded-2xl border border-white/8 bg-black/40 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          style={{ aspectRatio: "4 / 3", maxWidth: "min(100%, calc((100vh - 9rem) * 4 / 3))" }}
        >
          <div
            className="absolute inset-0 transition-transform duration-700 ease-out will-change-transform"
            style={{
              transform: zoom ? "scale(1.45)" : "scale(1)",
              transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "center",
            }}
          >
            <img
              src={step.src}
              alt={step.alt}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {step.hotspots.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => pick(h)}
                aria-label={h.label}
                className="group absolute -translate-x-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center gap-2 p-2"
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
              >
                <span className="relative grid h-5 w-5 place-items-center">
                  <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/25 shadow-[0_0_16px_hsl(var(--primary))]" />
                </span>
                <span className="whitespace-nowrap rounded-full border border-white/15 bg-black/65 px-2.5 py-1 text-[10px] tracking-wide text-white backdrop-blur-md">
                  {h.label}
                </span>
              </button>
            ))}
          </div>

          {zoom && (
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="absolute left-3 top-3 z-10 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-md"
            >
              Zmenšit
            </button>
          )}
        </div>
      </div>

      {step.configurator && (
        <div className="pointer-events-auto absolute inset-x-0 top-[max(4.2rem,calc(env(safe-area-inset-top)+4rem))] z-20 px-3">
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-black/55 p-2.5 backdrop-blur-xl">
            <div className="flex gap-1.5">
              {CONFIG_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  aria-pressed={m.key === mode}
                  className={`flex-1 rounded-full px-2 py-2 text-[10.5px] font-semibold transition ${
                    m.key === mode ? "bg-primary text-primary-foreground" : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[11px] leading-snug text-white/65">{activeMode.text}</p>
          </div>
        </div>
      )}

      {openCard && <InfoCard card={openCard} onClose={() => setOpenCard(null)} />}
    </>
  );
};

/** Video krok — přehraje se až po kliknutí uživatele, po dohrání otevře kartu. */
const VideoStep = ({ step }: { step: Extract<InteriorStep, { kind: "video" }> }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    setEnded(false);
    setNeedsPlay(false);
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => setNeedsPlay(true));
  }, [step]);

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center p-2 md:p-6">
        <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/8 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <video
            ref={ref}
            key={step.src}
            src={step.src}
            muted
            playsInline
            preload="metadata"
            onEnded={() => setEnded(true)}
            className="h-auto w-full"
          />
          {needsPlay && (
            <button
              type="button"
              onClick={() => {
                void ref.current?.play();
                setNeedsPlay(false);
              }}
              aria-label="Přehrát video"
              className="absolute inset-0 grid place-items-center bg-black/45"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary">
                <Play className="h-6 w-6 text-primary-foreground" />
              </span>
            </button>
          )}
        </div>
      </div>
      {ended && <InfoCard card={step.card} />}
    </>
  );
};

/**
 * Interiérová část prohlídky — krokový flow (Back/Next) postavený výhradně
 * na dodaných reálných fotografiích a videích vozu.
 */
export const InteriorTour = ({ onExitToExterior, onClose }: Props) => {
  const [index, setIndex] = useState(0);
  const step = INTERIOR_STEPS[index];
  const total = useMemo(() => INTERIOR_STEPS.length - 1, []);

  const next = useCallback(() => setIndex((i) => Math.min(INTERIOR_STEPS.length - 1, i + 1)), []);
  const back = useCallback(() => {
    if (index === 0) onExitToExterior();
    else setIndex((i) => i - 1);
  }, [index, onExitToExterior]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  if (step.kind === "done") {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#05070b] px-6 animate-in fade-in duration-500">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/40">
            <Check className="h-6 w-6 text-primary" />
          </span>
          <h2 className="mt-5 font-serif text-2xl text-white">Virtuální prohlídka dokončena</h2>
          <p className="mt-3 text-[13px] leading-relaxed text-white/60">
            Prošli jste hlavní exteriérové, komfortní a praktické funkce vozu.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <button type="button" onClick={() => setIndex(0)} className={`${btnPrimary} w-full`}>
              <RotateCcw className="h-4 w-4" />
              Projít znovu
            </button>
            <button type="button" onClick={onClose} className={`${btnGhost} w-full`}>
              <X className="h-4 w-4" />
              Ukončit prohlídku
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#05070b] animate-in fade-in duration-400">
      {step.kind === "photo" ? <PhotoStep step={step} onAdvance={next} /> : <VideoStep step={step} />}

      {/* Horní lišta */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-primary">Interiér</p>
          <h1 className="font-serif text-base text-white leading-tight">
            Chrysler <span className="italic">Pacifica</span>
          </h1>
          <p className="mt-0.5 text-[9px] tracking-wider text-white/40">
            Krok {index + 1} / {total}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Ukončit prohlídku"
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/8 text-white/85 backdrop-blur-md"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Spodní navigace */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] md:pr-[452px]">
        <div className="pointer-events-auto mx-auto flex w-full max-w-lg items-center gap-2">
          <button type="button" onClick={back} className={btnGhost}>
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </button>
          <button type="button" onClick={next} className={`${btnPrimary} flex-1`}>
            {step.nextLabel ?? "Pokračovat"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteriorTour;

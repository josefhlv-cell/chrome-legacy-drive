import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Play,
  X,
} from "lucide-react";
import {
  CONFIG_MODES,
  INTERIOR_STEPS,
  type InteriorStep,
  type PhotoHotspot,
  type TourCard,
  type TourVideo,
} from "../data/interiorTour";

type Props = {
  onExitToExterior: () => void;
  onClose: () => void;
};

const KEY_ASSET = "/pacifica/virtual-tour/interior-key.png";

const btnPrimary =
  "h-12 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold px-6 flex items-center justify-center gap-2 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.985]";

const btnGhost =
  "h-12 rounded-full border border-white/15 bg-black/35 text-white text-[13px] font-semibold px-5 flex items-center justify-center gap-2 backdrop-blur-md transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.985]";

/* -------------------------------------------------------------------------- */
/* KEY — FINISH / EXIT                                                       */
/* -------------------------------------------------------------------------- */

const FinishKey = ({
  onLock,
}: {
  onLock: () => void;
}) => {
  return (
    <div className="mt-8 flex flex-col items-center">
      <div
        className="
          mb-3
          whitespace-nowrap
          rounded-full
          border
          border-white/10
          bg-black/70
          px-4
          py-2
          text-[9px]
          font-medium
          uppercase
          tracking-[0.18em]
          text-white/85
          shadow-lg
          backdrop-blur-md
        "
      >
        Ukonči prohlídku
      </div>

      <div className="relative h-[240px] w-[155px]">
        <img
          src={KEY_ASSET}
          alt="Klíč od vozu"
          draggable={false}
          className="
            h-full
            w-full
            object-contain
            drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)]
          "
        />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onLock();
          }}
          aria-label="Zamknout a ukončit prohlídku"
          className="
            absolute
            left-[8%]
            top-[7%]
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-full
            touch-manipulation
          "
          style={{
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span
            className="
              absolute
              h-14
              w-14
              animate-ping
              rounded-full
              bg-primary/25
            "
          />

          <span
            className="
              absolute
              h-11
              w-11
              animate-pulse
              rounded-full
              border-2
              border-primary
              bg-primary/15
              shadow-[0_0_30px_hsl(var(--primary))]
            "
          />

          <span
            className="
              relative
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              bg-primary
              text-primary-foreground
              shadow-[0_0_22px_hsl(var(--primary))]
            "
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
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
      </div>

      <p className="mt-2 text-center text-[11px] text-white/40">
        Zamkni prohlídku
      </p>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* VIDEO CARD                                                                 */
/* -------------------------------------------------------------------------- */

const VideoCardMedia = ({
  videos,
}: {
  videos: TourVideo[];
}) => (
  <div className="mt-5 space-y-4">
    {videos.map((video) => (
      <div
        key={video.src}
        className="overflow-hidden rounded-2xl border border-white/10 bg-black/60"
      >
        <video
          className="block max-h-[38vh] w-full bg-black object-contain"
          src={video.src}
          poster={video.poster}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          aria-label={video.caption ?? "Video"}
        />

        {video.caption && (
          <div className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/45">
            {video.caption}
          </div>
        )}
      </div>
    ))}
  </div>
);

/* -------------------------------------------------------------------------- */
/* INFO CARD — VŽDY ROZBALENÁ                                                */
/* -------------------------------------------------------------------------- */

const InfoCard = ({
  card,
  onClose,
}: {
  card: TourCard;
  onClose: () => void;
}) => {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-[5.9rem] z-50 max-h-[78vh] overflow-y-auto overscroll-contain rounded-t-[28px] border border-white/10 bg-[#111925]/98 p-5 pb-6 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[min(560px,calc(100vw-48px))] sm:max-h-[78vh] sm:rounded-[28px]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Zavřít kartu"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.02] text-2xl text-white/70"
      >
        ×
      </button>

      <div className="pr-12">
        <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#6b96e8]">
          {card.eyebrow}
        </div>

        <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight text-white">
          {card.title}
        </h2>

        <p className="mt-3 text-[15px] leading-6 text-white/65">
          {card.text}
        </p>
      </div>

      {card.videos && card.videos.length > 0 && (
        <VideoCardMedia videos={card.videos} />
      )}

      {card.bullets && card.bullets.length > 0 && (
        <ul className="mt-5 space-y-2 text-[14px] leading-6 text-white/70">
          {card.bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4d80d8]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {card.sections?.map((section) => (
        <section
          key={section.title}
          className="mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
        >
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#6b96e8]">
            {section.title}
          </div>

          <div className="mt-3 space-y-3 text-[14px] leading-6 text-white/70">
            {section.items.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      ))}

      {card.note && (
        <p className="mt-5 border-t border-white/8 pt-4 text-[11px] leading-5 text-white/45">
          {card.note}
        </p>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* PHOTO STEP                                                                 */
/* -------------------------------------------------------------------------- */

const PhotoStep = ({
  step,
  onAdvance,
}: {
  step: Extract<InteriorStep, { kind: "photo" }>;
  onAdvance: () => void;
}) => {
  const [openCard, setOpenCard] =
    useState<TourCard | null>(null);

  const [zoom, setZoom] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [mode, setMode] = useState(
    CONFIG_MODES[0].key,
  );

  useEffect(() => {
    /*
     * Front-console intro se otevře automaticky.
     * Všechny ostatní karty se otevřou po kliknutí
     * na příslušný hotspot.
     *
     * Karta je nyní vždy kompletně rozbalená.
     */
    setOpenCard(
      step.id === "front-console"
        ? step.intro ?? null
        : null,
    );

    setZoom(null);
    setMode(CONFIG_MODES[0].key);
  }, [step]);

  const pick = useCallback(
    (hotspot: PhotoHotspot) => {
      if (hotspot.card) {
        /*
         * DŮLEŽITÉ:
         * Karta se vždy otevře rovnou v plném režimu.
         * Už zde není setExpanded(false).
         */
        setOpenCard(hotspot.card);
        setZoom(null);
        return;
      }

      if (hotspot.advance) {
        onAdvance();
      }
    },
    [onAdvance],
  );

  const activeMode =
    CONFIG_MODES.find(
      (item) => item.key === mode,
    ) ?? CONFIG_MODES[0];

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center p-2 pb-24 md:p-6 md:pb-28">
        <div
          className="relative w-full max-h-full overflow-hidden rounded-2xl border border-white/8 bg-black/40 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          style={{
            aspectRatio: "4 / 3",
            maxWidth:
              "min(100%, calc((100vh - 9rem) * 4 / 3))",
          }}
        >
          <div className="absolute inset-0">
            <img
              src={step.src}
              alt={step.alt}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />

            {step.hotspots.map((hotspot) => (
              <button
                key={hotspot.id}
                type="button"
                onClick={() => pick(hotspot)}
                aria-label={hotspot.label}
                className="group absolute -translate-x-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center gap-2 p-2"
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                }}
              >
                <span className="relative grid h-5 w-5 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />

                  <span className="relative h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/25 shadow-[0_0_16px_hsl(var(--primary))]" />
                </span>

                <span className="whitespace-nowrap rounded-full border border-white/15 bg-black/65 px-2.5 py-1 text-[10px] tracking-wide text-white backdrop-blur-md">
                  {hotspot.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {step.configurator && (
        <div className="pointer-events-auto absolute inset-x-0 top-[max(4.2rem,calc(env(safe-area-inset-top)+4rem))] z-20 px-3">
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-black/55 p-2.5 backdrop-blur-xl">
            <div className="flex gap-1.5">
              {CONFIG_MODES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMode(item.key)}
                  aria-pressed={item.key === mode}
                  className={`flex-1 rounded-full px-2 py-2 text-[10.5px] font-semibold transition ${
                    item.key === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="mt-2 px-1 text-[11px] leading-snug text-white/65">
              {activeMode.text}
            </p>
          </div>
        </div>
      )}

      {openCard && (
        <InfoCard
          card={openCard}
          onClose={() => {
            setOpenCard(null);
            setZoom(null);
          }}
        />
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* VIDEO STEP                                                                 */
/* -------------------------------------------------------------------------- */

const VideoStep = ({
  step,
}: {
  step: Extract<InteriorStep, { kind: "video" }>;
}) => {
  const [needsPlay, setNeedsPlay] =
    useState(true);

  const [ended, setEnded] =
    useState(false);

  useEffect(() => {
    setNeedsPlay(true);
    setEnded(false);
  }, [step]);

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center p-2 pb-24 md:p-6 md:pb-28">
        <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/8 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <video
            key={step.src}
            src={step.src}
            controls
            playsInline
            preload="metadata"
            onPlay={() => setNeedsPlay(false)}
            onEnded={() => setEnded(true)}
            className="h-auto w-full"
          />

          {needsPlay && (
            <button
              type="button"
              onClick={(event) => {
                const video =
                  event.currentTarget
                    .previousElementSibling as
                    | HTMLVideoElement
                    | null;

                void video?.play();
                setNeedsPlay(false);
              }}
              aria-label="Přehrát video"
              className="pointer-events-none absolute inset-0 grid place-items-center bg-transparent"
            >
              <span className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-primary shadow-xl">
                <Play className="h-6 w-6 text-primary-foreground" />
              </span>
            </button>
          )}
        </div>
      </div>

      {ended && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-[5.9rem] z-50 sm:bottom-24">
          <div className="mx-2 sm:mx-auto sm:w-[min(560px,calc(100vw-48px))]">
            <InfoCard
              card={step.card}
              onClose={() => undefined}
            />
          </div>
        </div>
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* INTERIOR TOUR                                                              */
/* -------------------------------------------------------------------------- */

export const InteriorTour = ({
  onExitToExterior,
  onClose,
}: Props) => {
  const [index, setIndex] = useState(0);

  const step = INTERIOR_STEPS[index];

  const visibleSteps = useMemo(
    () =>
      INTERIOR_STEPS.filter(
        (item) => item.kind !== "done",
      ),
    [],
  );

  const progress = Math.min(
    index + 1,
    visibleSteps.length,
  );

  const next = useCallback(() => {
    setIndex((current) =>
      Math.min(
        INTERIOR_STEPS.length - 1,
        current + 1,
      ),
    );
  }, []);

  const back = useCallback(() => {
    if (index === 0) {
      onExitToExterior();
      return;
    }

    setIndex((current) =>
      Math.max(0, current - 1),
    );
  }, [index, onExitToExterior]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") back();
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener(
        "keydown",
        onKey,
      );
  }, [next, back, onClose]);

  /* ---------------------------------------------------------------------- */
  /* FINISH PAGE                                                             */
  /* ---------------------------------------------------------------------- */

  if (step.kind === "done") {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-[#05070b] px-6 animate-in fade-in duration-500">
        <div className="flex min-h-full flex-col items-center justify-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/40">
            <Check className="h-6 w-6 text-primary" />
          </span>

          <h2 className="mt-5 text-center font-serif text-2xl text-white">
            Virtuální prohlídka dokončena
          </h2>

          <p className="mt-3 max-w-md text-center text-[13px] leading-relaxed text-white/60">
            Prošli jste hlavní exteriérové,
            komfortní a praktické funkce vozu.
          </p>

          <FinishKey
            onLock={onExitToExterior}
          />

          <button
            type="button"
            onClick={() => setIndex(0)}
            className="
              mt-7
              flex
              h-11
              items-center
              justify-center
              gap-2
              rounded-full
              border
              border-white/10
              bg-white/[0.04]
              px-6
              text-xs
              font-semibold
              text-white/65
              transition
              hover:bg-white/[0.08]
              hover:text-white
            "
          >
            Projít znovu
          </button>

          <button
            type="button"
            onClick={onClose}
            className="
              mt-3
              flex
              items-center
              justify-center
              gap-2
              text-[10px]
              uppercase
              tracking-[0.2em]
              text-white/35
              transition
              hover:text-white/60
            "
          >
            <X className="h-3.5 w-3.5" />
            Zavřít
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* NORMAL INTERIOR                                                        */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#05070b] text-white animate-in fade-in duration-400">
      {step.kind === "photo" ? (
        <PhotoStep
          step={step}
          onAdvance={next}
        />
      ) : (
        <VideoStep step={step} />
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 px-4 pt-[max(0.9rem,env(safe-area-inset-top))] md:px-5 md:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.35em] text-[#6b96e8]">
              Interiér
            </div>

            <h1 className="mt-1 font-serif text-2xl font-semibold">
              Chrysler <i>Pacifica</i>
            </h1>

            <div className="mt-1 text-xs text-white/40">
              Krok {progress} / {visibleSteps.length}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Ukončit prohlídku"
            className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-black/20 text-2xl text-white/75 backdrop-blur-md"
          >
            ×
          </button>
        </div>
      </header>

      <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] md:px-5">
        <div className="pointer-events-auto mx-auto flex w-full max-w-lg items-center gap-2">
          <button
            type="button"
            onClick={back}
            className={btnGhost}
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </button>

          <button
            type="button"
            onClick={next}
            className={`${btnPrimary} flex-1`}
          >
            {step.nextLabel ?? "Další"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onExitToExterior}
          className="pointer-events-auto mx-auto mt-2 block text-[10px] uppercase tracking-[0.22em] text-white/40"
        >
          Zpět k 3D vozu
        </button>
      </nav>
    </div>
  );
};

export default InteriorTour;

import type {} from "@react-three/fiber";
import { useCallback, useMemo, useState } from "react";
import {
  INTERIOR_STEPS,
  type InteriorStep,
  type PhotoHotspot,
  type TourCard,
} from "./interiorTourData";

type Props = {
  onExitToExterior: () => void;
  onClose: () => void;
};

const VideoCardMedia = ({
  videos,
}: {
  videos: NonNullable<TourCard["videos"]>;
}) => (
  <div className="mt-5 space-y-4">
    {videos.map((video) => (
      <div
        key={video.src}
        className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
      >
        <video
          className="block max-h-[42vh] w-full bg-black object-contain"
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

const Card = ({
  card,
  expanded,
  onToggleExpanded,
  onClose,
}: {
  card: TourCard;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) => {
  const collapsible = !!card.collapsible;

  /*
   * Uconnect 360 a Přední konzole:
   * po klepnutí na hotspot překryjí celý fotografický vizuál.
   * Obsah je záměrně sbalený a uživatel jej rozbalí ručně.
   */
  if (collapsible && !expanded) {
    return (
      <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col bg-[#07101b]/96 backdrop-blur-md">
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-xl text-center">
            <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#6b96e8]">
              {card.eyebrow}
            </div>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-white">
              {card.title}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/55">
              Detail je připraven. Rozbalte kartu a zobrazte text, informace a
              reálné video.
            </p>

            <button
              type="button"
              onClick={onToggleExpanded}
              className="mt-7 rounded-full bg-[#3f7bd7] px-8 py-4 text-sm font-semibold text-white shadow-lg"
            >
              Rozbalit detail ↓
            </button>
          </div>
        </div>

        <div className="flex justify-center px-5 pb-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít detail"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-2xl text-white/70"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 max-h-[82vh] overflow-y-auto overscroll-contain rounded-t-[28px] border border-white/10 bg-[#111925]/97 p-5 pb-28 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(560px,calc(100vw-48px))] sm:max-h-[82vh] sm:rounded-[28px] sm:pb-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Zavřít detail"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70"
      >
        ×
      </button>

      <div className="pr-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#6b96e8]">
          {card.eyebrow}
        </div>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-white">
          {card.title}
        </h2>
        <p className="mt-3 text-[16px] leading-7 text-white/65">
          {card.text}
        </p>
      </div>

      {card.videos && card.videos.length > 0 && (
        <VideoCardMedia videos={card.videos} />
      )}

      {card.bullets && card.bullets.length > 0 && (
        <ul className="mt-5 space-y-2 text-[15px] leading-6 text-white/70">
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
          <div className="text-[11px] uppercase tracking-[0.25em] text-[#6b96e8]">
            {section.title}
          </div>
          <div className="mt-3 space-y-3 text-[15px] leading-6 text-white/70">
            {section.items.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      ))}

      {card.note && (
        <p className="mt-5 border-t border-white/8 pt-4 text-xs leading-5 text-white/45">
          {card.note}
        </p>
      )}

      {collapsible && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-5 w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-semibold text-white/70"
        >
          Sbalit detail ↑
        </button>
      )}
    </div>
  );
};

const StepMedia = ({
  step,
  onHotspot,
}: {
  step: InteriorStep;
  onHotspot: (hotspot: PhotoHotspot) => void;
}) => {
  if (step.kind === "done") return null;

  if (step.kind === "video") {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-4 pb-32">
        <video
          className="max-h-[72vh] w-full max-w-5xl rounded-2xl bg-black object-contain shadow-2xl"
          src={step.src}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 pb-32">
      <div className="relative max-h-[72vh] max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-2xl">
        <img
          src={step.src}
          alt={step.alt}
          className="block max-h-[72vh] max-w-full object-contain"
          draggable={false}
        />

        {step.hotspots.map((hotspot) => (
          <button
            key={hotspot.id}
            type="button"
            onClick={() => onHotspot(hotspot)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-[#2f6bd8]/80 p-2 shadow-[0_0_24px_rgba(47,107,216,.55)]"
            style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
            aria-label={hotspot.label}
          >
            <span className="block h-2.5 w-2.5 rounded-full bg-white" />
          </button>
        ))}
      </div>
    </div>
  );
};

export const InteriorTour = ({ onExitToExterior, onClose }: Props) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedCard, setSelectedCard] = useState<TourCard | null>(null);
  const [cardExpanded, setCardExpanded] = useState(false);

  const step = INTERIOR_STEPS[stepIndex];

  const next = useCallback(() => {
    setSelectedCard(null);
    setCardExpanded(false);
    setStepIndex((index) => Math.min(index + 1, INTERIOR_STEPS.length - 1));
  }, []);

  const back = useCallback(() => {
    setSelectedCard(null);
    setCardExpanded(false);
    setStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  const selectHotspot = useCallback(
    (hotspot: PhotoHotspot) => {
      if (hotspot.card) {
        setSelectedCard(hotspot.card);
        setCardExpanded(!hotspot.card.collapsible);
        return;
      }

      if (hotspot.advance) next();
    },
    [next],
  );

  const progressLabel = useMemo(() => {
    const visibleSteps = INTERIOR_STEPS.filter(
      (item) => item.kind !== "done",
    );
    const current = Math.min(stepIndex + 1, visibleSteps.length);
    return `Krok ${current} / ${visibleSteps.length}`;
  }, [stepIndex]);

  if (step.kind === "done") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05070b] px-6 text-center text-white">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#6b96e8]">
          Digitální showroom
        </div>
        <h1 className="mt-3 font-serif text-3xl">
          Prohlídka dokončena
        </h1>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onExitToExterior}
            className="rounded-full border border-white/15 px-6 py-3 text-sm"
          >
            Zpět k vozu
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#3d78d6] px-6 py-3 text-sm font-semibold"
          >
            Zavřít
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#05070b] text-white select-none">
      <header className="absolute inset-x-0 top-0 z-40 px-5 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-[#6b96e8]">
              Interiér
            </div>
            <h1 className="mt-1 font-serif text-2xl font-semibold">
              Chrysler <i>Pacifica</i>
            </h1>
            <div className="mt-1 text-xs text-white/40">
              {progressLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít prohlídku"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-2xl text-white/75"
          >
            ×
          </button>
        </div>
      </header>

      <StepMedia step={step} onHotspot={selectHotspot} />

      {selectedCard && (
        <Card
          card={selectedCard}
          expanded={cardExpanded}
          onToggleExpanded={() => setCardExpanded((value) => !value)}
          onClose={() => {
            setSelectedCard(null);
            setCardExpanded(false);
          }}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={stepIndex === 0}
            className="pointer-events-auto rounded-full border border-white/10 bg-black/30 px-6 py-4 text-sm font-semibold backdrop-blur-md disabled:opacity-35"
          >
            ← Zpět
          </button>

          <button
            type="button"
            onClick={next}
            className="pointer-events-auto min-w-[190px] rounded-full bg-[#3f7bd7] px-6 py-4 text-sm font-semibold shadow-lg"
          >
            {step.nextLabel ?? "Pokračovat →"}
          </button>
        </div>

        <button
          type="button"
          onClick={onExitToExterior}
          className="pointer-events-auto mx-auto mt-3 block text-[11px] uppercase tracking-[0.22em] text-white/40"
        >
          Zpět k 3D vozu
        </button>
      </div>
    </div>
  );
};

export default InteriorTour;

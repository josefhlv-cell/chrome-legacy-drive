import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Play } from "lucide-react";
import type { TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
  /** Akce karty (např. přechod do interiérové části prohlídky). */
  onCta?: () => void;
};


/** Médium karty — reálná fotografie detailu nebo krátké video vozu. */
const Media = ({ media, title }: { media: NonNullable<TourHotspot["detail"]["media"]>; title: string }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);

  useEffect(() => {
    if (media.type !== "video") return;
    const el = video.current;
    if (!el) return;
    setNeedsPlay(false);
    el.play().catch(() => setNeedsPlay(true));
    return () => el.pause();
  }, [media]);

  return (
    <div className="mt-4 relative aspect-[16/10] max-h-44 md:max-h-52 overflow-hidden rounded-2xl border border-white/8 bg-black/40">
      {media.type === "video" ? (
        <>
          <video
            ref={video}
            key={media.src}
            src={media.src}
            poster={media.poster}
            muted
            loop
            playsInline
            preload="none"
            className="h-full w-full object-cover"
          />
          {needsPlay && (
            <button
              type="button"
              onClick={() => {
                void video.current?.play();
                setNeedsPlay(false);
              }}
              aria-label="Přehrát video"
              className="absolute inset-0 grid place-items-center bg-black/40"
            >
              <span className="h-12 w-12 rounded-full bg-primary grid place-items-center">
                <Play className="h-5 w-5 text-primary-foreground" />
              </span>
            </button>
          )}
        </>
      ) : (
        <img
          src={media.src}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-95"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(var(--card))]/70 to-transparent" />
      {media.caption && (
        <p className="pointer-events-none absolute bottom-1.5 left-3 text-[8px] uppercase tracking-[0.22em] text-white/60">
          {media.caption}
        </p>
      )}
    </div>
  );
};

/**
 * Detail hotspotu — bottom sheet na mobilu (collapsed / expanded),
 * decentní side panel na desktopu. Vůz musí zůstat vidět.
 */
export const DetailPanel = ({ hotspot, expanded, onToggleExpanded, onClose }: Props) => {
  const d = hotspot.detail;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:inset-y-0 md:left-auto md:right-0 md:flex md:items-center md:p-5">
      <section
        aria-label={d.title}
        className="pointer-events-auto w-full md:w-[400px] rounded-t-[26px] md:rounded-3xl border border-white/10 bg-[hsl(var(--card)/0.82)] backdrop-blur-xl shadow-[0_-16px_60px_rgba(0,0,0,0.55)] md:shadow-[0_30px_70px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom md:slide-in-from-right duration-500 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pb-0"
      >
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Zmenšit detail" : "Rozbalit detail"}
          aria-expanded={expanded}
          className="md:hidden w-full pt-2.5 pb-1 flex flex-col items-center gap-1"
        >
          <span className="h-1 w-10 rounded-full bg-white/25" />
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-white/40" />
          )}
        </button>

        <div className="px-5 pt-2 md:pt-5 md:px-6">
          <p className="text-[9px] uppercase tracking-[0.28em] text-primary">{d.eyebrow}</p>
          <h2 className="mt-1 font-serif text-lg md:text-xl leading-tight text-foreground">{d.title}</h2>
          {!expanded && (
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground md:hidden">{d.text}</p>
          )}
        </div>

        <div
          className={`px-5 md:px-6 overflow-y-auto overscroll-contain ${
            expanded ? "max-h-[50vh]" : "max-h-0 md:max-h-[60vh]"
          } transition-[max-height] duration-500`}
        >
          {d.media && <Media media={d.media} title={d.title} />}

          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{d.text}</p>

          {d.bullets.length > 0 && (
            <ul className="mt-3.5 space-y-2">
              {d.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-[12.5px] leading-snug text-foreground/85">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {d.specs && (
            <dl className="mt-4 grid grid-cols-2 gap-2.5">
              {d.specs.map((s) => (
                <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.04] p-3">
                  <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                  <dd className="mt-0.5 text-[13px] text-foreground">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="h-3" />
        </div>

        <div className="px-5 md:px-6 pt-3 pb-4 md:pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-full border border-white/15 bg-white/8 text-foreground text-[13px] font-semibold flex items-center justify-center gap-2 transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.985]"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět k autu
          </button>
        </div>
      </section>
    </div>
  );
};

export default DetailPanel;

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Play } from "lucide-react";
import type { TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
  onCta?: () => void;
};

const Media = ({
  media,
  title,
}: {
  media: NonNullable<TourHotspot["detail"]["media"]>;
  title: string;
}) => {
  const video = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);

  useEffect(() => {
    if (media.type !== "video") return;
    const element = video.current;
    if (!element) return;

    setNeedsPlay(false);

    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [media]);

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/8 bg-black/40">
      {media.type === "video" ? (
        <>
          <video
            ref={video}
            key={media.src}
            src={media.src}
            poster={media.poster}
            controls
            playsInline
            preload="metadata"
            className="block max-h-52 w-full bg-black object-contain"
          />
          {needsPlay && (
            <button
              type="button"
              onClick={() => {
                void video.current?.play();
                setNeedsPlay(false);
              }}
              aria-label="Přehrát video"
              className="absolute inset-0 grid place-items-center bg-black/30"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-primary">
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
          className="block max-h-52 w-full object-contain"
        />
      )}

      {media.caption && (
        <p className="pointer-events-none absolute bottom-2 left-3 right-3 text-[8px] uppercase tracking-[0.22em] text-white/65">
          {media.caption}
        </p>
      )}
    </div>
  );
};

export const DetailPanel = ({
  hotspot,
  expanded,
  onToggleExpanded,
  onClose,
  onCta,
}: Props) => {
  const detail = hotspot.detail;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:inset-y-0 md:left-auto md:right-0 md:flex md:items-center md:p-5">
      <section
        aria-label={detail.title}
        className="pointer-events-auto w-full rounded-t-[26px] border border-white/10 bg-[hsl(var(--card)/0.88)] shadow-[0_-16px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl md:w-[420px] md:rounded-3xl md:shadow-[0_30px_70px_rgba(0,0,0,0.55)]"
      >
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Sbalit detail" : "Rozbalit detail"}
          aria-expanded={expanded}
          className="flex w-full flex-col items-center gap-1 pb-1 pt-2.5 md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-white/25" />
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-white/40" />
          )}
        </button>

        <div className="px-5 pt-2 md:px-6 md:pt-5">
          <p className="text-[9px] uppercase tracking-[0.28em] text-primary">
            {detail.eyebrow}
          </p>
          <h2 className="mt-1 font-serif text-lg leading-tight text-foreground md:text-xl">
            {detail.title}
          </h2>

          {!expanded && (
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground md:hidden">
              {detail.text}
            </p>
          )}
        </div>

        <div
          className={`overflow-y-auto overscroll-contain px-5 transition-[max-height] duration-500 md:px-6 ${
            expanded ? "max-h-[62vh]" : "max-h-0 md:max-h-[60vh]"
          }`}
        >
          {expanded && detail.media && (
            <Media media={detail.media} title={detail.title} />
          )}

          {expanded && (
            <>
              <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                {detail.text}
              </p>

              {detail.bullets && detail.bullets.length > 0 && (
                <ul className="mt-3.5 space-y-2">
                  {detail.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex gap-2.5 text-[12.5px] leading-snug text-foreground/85"
                    >
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {detail.specs && (
                <dl className="mt-4 grid grid-cols-2 gap-2.5">
                  {detail.specs.map((spec) => (
                    <div
                      key={spec.label}
                      className="rounded-xl border border-white/8 bg-white/[0.04] p-3"
                    >
                      <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {spec.label}
                      </dt>
                      <dd className="mt-0.5 text-[13px] text-foreground">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {detail.note && (
                <p className="mt-4 text-[11px] leading-relaxed text-white/45">
                  {detail.note}
                </p>
              )}
            </>
          )}

          <div className="h-3" />
        </div>

        <div className="space-y-2.5 px-5 pb-4 pt-3 md:px-6 md:pb-6">
          {detail.cta && onCta && (
            <button
              type="button"
              onClick={onCta}
              className="h-12 w-full rounded-full bg-primary text-[13px] font-semibold text-primary-foreground transition hover:brightness-110"
            >
              {detail.cta.label}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/8 text-[13px] font-semibold text-foreground transition hover:bg-white/14"
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

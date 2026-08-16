import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
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

  useEffect(() => {
    if (media.type !== "video") return;

    const element = video.current;
    if (!element) return;

    // Karta se otevřela → video vždy od začátku a hned.
    element.currentTime = 0;
    element.muted = true;
    void element.play().catch(() => undefined);

    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [media]);

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/8 bg-black/40">
      {media.type === "video" ? (
        <video
          ref={video}
          key={media.src}
          src={media.src}
          poster={media.poster}
          controls
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="block max-h-52 w-full bg-black object-contain"
        />
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
  onClose,
  onCta,
}: Props) => {
  const detail = hotspot.detail;

  const [powertrainKey, setPowertrainKey] = useState<
    "gasoline" | "hybrid"
  >("gasoline");

  const activePowertrain = detail.powertrainOptions?.find(
    (option) => option.key === powertrainKey,
  );

  const activeTitle = activePowertrain?.title ?? detail.title;
  const activeText = activePowertrain?.text ?? detail.text;
  const activeBullets =
    activePowertrain?.bullets ?? detail.bullets;
  const activeSpecs = activePowertrain?.specs ?? detail.specs;

  // Panel je vždy rozbalený.
  // Platí pro exteriér i interiér.
  const isExpanded = true;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:inset-y-0 md:left-auto md:right-0 md:flex md:items-center md:p-5">
      <section
        aria-label={activeTitle}
        className="pointer-events-auto w-full rounded-t-[26px] border border-white/10 bg-[hsl(var(--card)/0.88)] shadow-[0_-16px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl md:w-[420px] md:rounded-3xl md:shadow-[0_30px_70px_rgba(0,0,0,0.55)]"
      >
        <div className="px-5 pt-4 md:px-6 md:pt-5">
          <p className="text-[9px] uppercase tracking-[0.28em] text-primary">
            {detail.eyebrow}
          </p>

          <h2 className="mt-1 font-serif text-lg leading-tight text-foreground md:text-xl">
            {activeTitle}
          </h2>

          {detail.powertrainOptions && (
            <div
              className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/25 p-1"
              role="tablist"
              aria-label="Volba pohonu"
            >
              {detail.powertrainOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={option.key === powertrainKey}
                  onClick={() => setPowertrainKey(option.key)}
                  className={`h-9 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                    option.key === powertrainKey
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-white/55 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="max-h-[62vh] overflow-y-auto overscroll-contain px-5 md:max-h-[70vh] md:px-6">
          {isExpanded && detail.media && !activePowertrain && (
            <Media media={detail.media} title={activeTitle} />
          )}

          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            {activeText}
          </p>

          {activeBullets && activeBullets.length > 0 && (
            <ul className="mt-3.5 space-y-2">
              {activeBullets.map((bullet) => (
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

          {activeSpecs && (
            <dl className="mt-4 grid grid-cols-2 gap-2.5">
              {activeSpecs.map((spec) => (
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

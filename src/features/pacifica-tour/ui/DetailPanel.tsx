import { ChevronDown, ChevronUp, Play, X } from "lucide-react";
import type { HotspotAction, TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  /** Aktuální stav akce (otevřeno / zavřeno / rozsvíceno). */
  actionActive: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onAction: (action: HotspotAction) => void;
  onClose: () => void;
  variant: number;
  onVariant: (i: number) => void;
};

/**
 * Detail hotspotu — moderní bottom sheet na mobilu (collapsed / expanded,
 * max 60 % výšky) a decentní side panel na desktopu. Vůz musí zůstat vidět.
 */
export const DetailPanel = ({
  hotspot,
  actionActive,
  expanded,
  onToggleExpanded,
  onAction,
  onClose,
  variant,
  onVariant,
}: Props) => {
  const d = hotspot.detail;
  if (!d) return null;

  const v = d.variants?.[variant];
  const text = v?.text ?? d.text;
  const bullets = v?.bullets ?? d.bullets;
  const action = hotspot.action;
  const actionLabel =
    action && action.type !== "goToView" ? (actionActive ? action.labelOff : action.labelOn) : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:inset-y-0 md:left-auto md:right-0 md:flex md:items-center md:p-5">
      <section
        aria-label={d.title}
        className="pointer-events-auto w-full md:w-[400px] rounded-t-[26px] md:rounded-3xl border border-white/10 bg-[hsl(var(--card)/0.78)] backdrop-blur-xl shadow-[0_-16px_60px_rgba(0,0,0,0.55)] md:shadow-[0_30px_70px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom md:slide-in-from-right duration-400 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pb-0"
      >
        {/* Drag handle / přepínač rozbalení (mobil) */}
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.28em] text-primary">{d.eyebrow}</p>
              <h2 className="mt-1 font-serif text-lg md:text-xl leading-tight text-foreground truncate md:whitespace-normal">
                {d.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zavřít detail"
              className="shrink-0 h-9 w-9 rounded-full border border-white/12 bg-white/8 grid place-items-center text-foreground/80 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!expanded && (
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground md:hidden">{text}</p>
          )}
        </div>

        {/* Rozbalený obsah — na desktopu vždy, na mobilu max 58 vh */}
        <div
          className={`px-5 md:px-6 overflow-y-auto overscroll-contain ${
            expanded ? "max-h-[52vh]" : "max-h-0 md:max-h-[62vh]"
          } transition-[max-height] duration-400`}
        >
          {(d.clip || d.image) && (
            <div className="mt-4 relative aspect-[16/10] max-h-44 md:max-h-52 overflow-hidden rounded-2xl border border-white/8 bg-black/40">
              {d.clip ? (
                <video
                  key={d.clip}
                  src={`/pacifica/clips/${d.clip}.mp4`}
                  poster={`/pacifica/clips/${d.clip}.jpg`}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={d.image}
                  alt={d.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover opacity-95"
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(var(--card))]/70 to-transparent" />
              <p className="pointer-events-none absolute bottom-1.5 left-3 text-[8px] uppercase tracking-[0.22em] text-white/60">
                {d.clip ? "Reálné video vozu" : "Fotografie vozu — Chrysler Pardubice"}
              </p>
            </div>
          )}


          {d.variants && (
            <div className="mt-4 inline-flex rounded-full border border-white/12 bg-black/30 p-1">
              {d.variants.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onVariant(i)}
                  aria-pressed={i === variant}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    i === variant ? "bg-primary text-primary-foreground" : "text-foreground/70"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{text}</p>

          {bullets.length > 0 && (
            <ul className="mt-3.5 space-y-2">
              {bullets.map((b) => (
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
          <div className="h-4" />
        </div>

        {action && actionLabel && (
          <div className="px-5 md:px-6 pt-3 pb-4 md:pb-6">
            <button
              type="button"
              onClick={() => onAction(action)}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-2 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.985]"
            >
              <Play className="h-3.5 w-3.5" />
              {actionLabel}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default DetailPanel;

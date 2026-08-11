import { useState } from "react";
import { X, Play } from "lucide-react";
import type { HotspotAction, TourHotspot } from "../data/tourData";

type Props = {
  hotspot: TourHotspot;
  /** Aktuální stav akce (otevřeno / zavřeno / rozsvíceno). */
  actionActive: boolean;
  onAction: (action: HotspotAction) => void;
  onClose: () => void;
};

/** Prémiový glass panel s detailem — bottom-sheet na mobilu, karta na desktopu. */
export const DetailPanel = ({ hotspot, actionActive, onAction, onClose }: Props) => {
  const [variant, setVariant] = useState(0);
  const d = hotspot.detail;
  if (!d) return null;

  const v = d.variants?.[variant];
  const text = v?.text ?? d.text;
  const bullets = v?.bullets ?? d.bullets;
  const action = hotspot.action;
  const actionLabel =
    action && action.type !== "goToView"
      ? actionActive
        ? action.labelOff
        : action.labelOn
      : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-end md:items-center md:justify-end md:p-8">
      <div className="pointer-events-auto w-full md:max-w-md max-h-[82vh] overflow-y-auto rounded-t-3xl md:rounded-3xl border border-white/12 bg-[hsl(var(--card)/0.72)] backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom md:slide-in-from-right duration-500">
        {d.image && (
          <div className="relative h-40 md:h-44 overflow-hidden rounded-t-3xl">
            <img
              src={d.image}
              alt={d.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--card))] via-transparent to-transparent" />
            <p className="absolute bottom-2 left-4 text-[9px] uppercase tracking-[0.25em] text-white/60">
              Ilustrační materiál
            </p>
          </div>
        )}

        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">{d.eyebrow}</p>
              <h2 className="mt-1 font-serif text-xl md:text-2xl text-foreground">{d.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zavřít detail"
              className="shrink-0 w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-foreground/90 active:scale-95 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {d.variants && (
            <div className="mt-4 inline-flex rounded-full border border-white/15 bg-black/30 p-1">
              {d.variants.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setVariant(i)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    i === variant ? "bg-primary text-primary-foreground" : "text-foreground/70"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{text}</p>

          {bullets.length > 0 && (
            <ul className="mt-4 space-y-2">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-[13px] text-foreground/85">
                  <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {d.specs && (
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {d.specs.map((s) => (
                <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {action && actionLabel && (
            <button
              type="button"
              onClick={() => onAction(action)}
              className="mt-5 w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Play className="w-4 h-4" />
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailPanel;

import { Pause, Play } from "lucide-react";

type Props = {
  visited: number;
  total: number;
  guided: boolean;
  onToggleGuided: () => void;
  /** Skryje se, když je otevřený detail (mobil), aby nic nepřekrývalo panel. */
  dimmed: boolean;
};

/**
 * Ukazatel postupu prohlídky (např. „4 / 10 prohlédnuto“) + spuštění
 * automatické prohlídky. Postup výrazně zvyšuje dokončení prohlídky —
 * uživatel vidí, že ještě něco zbývá.
 */
export const TourProgress = ({
  visited,
  total,
  guided,
  onToggleGuided,
  dimmed,
}: Props) => {
  const percent = total > 0 ? Math.round((visited / total) * 100) : 0;

  return (
    <div
      className={`pointer-events-none absolute left-3 z-30 transition-opacity duration-300 ${
        dimmed ? "opacity-0 md:opacity-100" : "opacity-100"
      }`}
      style={{ top: "calc(env(safe-area-inset-top) + 5.75rem)" }}
    >
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={onToggleGuided}
          aria-label={
            guided ? "Zastavit automatickou prohlídku" : "Spustit automatickou prohlídku"
          }
          aria-pressed={guided}
          className={`grid h-8 w-8 place-items-center rounded-full transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            guided
              ? "bg-primary text-primary-foreground"
              : "bg-white/10 text-white/85 hover:bg-white/18"
          }`}
        >
          {guided ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>

        <div className="pr-1">
          <p className="text-[8px] uppercase tracking-[0.2em] text-white/45">
            {guided ? "Automatická prohlídka" : "Postup prohlídky"}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <div
              className="h-1 w-20 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuenow={visited}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Prohlédnuté body zájmu"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            <span className="text-[10px] font-semibold tabular-nums text-white/80">
              {visited}/{total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourProgress;

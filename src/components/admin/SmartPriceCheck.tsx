// SmartPriceCheck — AI doporučení ceny vozu.
// Vyvolá edge funkci ai-price-check po validním VIN dekódování a zobrazí
// elegantní kartu s doporučenou cenou, rozsahem trhu, rychlostí prodeje
// a důvody. Zároveň pošle krátkou zprávu Máře (bottom-left).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, TrendingDown, Gauge, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMara } from "./MaraAssistant";

interface PriceInput {
  vin?: string;
  vehicleId?: string;
  make: string;
  model: string;
  year?: number;
  mileage?: number;
  fuel?: string;
  engine?: string;
  power?: string;
  equipment?: string;
  gallery?: { count: number; hasShowroom: boolean };
}

interface PriceResult {
  recommended: number | null;
  market_avg: number | null;
  market_low: number | null;
  market_high: number | null;
  sell_speed: "fast" | "medium" | "slow";
  confidence: number;
  reasons_up: string[];
  reasons_down: string[];
  mara_message?: string;
}

const fmt = (n: number | null | undefined) =>
  typeof n === "number" && n > 0 ? new Intl.NumberFormat("cs-CZ").format(n) + " Kč" : "—";

const speedLabel: Record<PriceResult["sell_speed"], { label: string; color: string }> = {
  fast: { label: "🟢 Rychlý prodej", color: "text-emerald-500" },
  medium: { label: "🟡 Standardní doba", color: "text-amber-500" },
  slow: { label: "🟠 Delší doba", color: "text-orange-500" },
};

interface Props {
  input: PriceInput | null;
  /** Trigger key — když se změní, znovu se spustí analýza. */
  triggerKey: string | number;
  onApply?: (price: number) => void;
}

const SmartPriceCheck = ({ input, triggerKey, onApply }: Props) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PriceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { say } = useMara();

  useEffect(() => {
    if (!input || !input.make || !input.model) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    supabase.functions
      .invoke("ai-price-check", { body: input })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) throw err;
        if (data?.error) throw new Error(data.error);
        const r = data as PriceResult;
        setResult(r);
        // Mára oznámí výsledek
        const msg = r.mara_message
          ? r.mara_message
          : `Mrkni, podle trhu by tahle ${input.make} ${input.model} mohla letět za ${fmt(r.recommended)}.`;
        say(msg, { title: "Cenový tip" });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Neznámá chyba";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  if (!input) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4 mt-3"
    >
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
          AI Smart Price Check
        </h4>
        {result && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            spolehlivost {result.confidence}%
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzuji trh, podobné vozy a vlastní paměť prodejů…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5" /> Analýza selhala: {error}
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 rounded-lg bg-background/60 border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">✅ Doporučená cena</div>
            <div className="text-2xl font-bold text-primary">{fmt(result.recommended)}</div>
            <div className={`text-xs mt-1 ${speedLabel[result.sell_speed].color}`}>
              {speedLabel[result.sell_speed].label}
            </div>
            {onApply && result.recommended ? (
              <button
                type="button"
                onClick={() => onApply(result.recommended!)}
                className="mt-2 chrome-button inline-flex items-center gap-1.5 text-[11px] !px-3 !py-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Použít doporučenou cenu
              </button>
            ) : null}
          </div>

          <div className="rounded-lg bg-background/60 border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">📈 Průměr trhu</div>
            <div className="text-base font-semibold text-foreground">{fmt(result.market_avg)}</div>
            <div className="text-[10px] text-muted-foreground mt-2">📉 Spodní hranice</div>
            <div className="text-sm text-foreground">{fmt(result.market_low)}</div>
          </div>

          <div className="rounded-lg bg-background/60 border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">📈 Horní hranice</div>
            <div className="text-base font-semibold text-foreground">{fmt(result.market_high)}</div>
          </div>

          {result.reasons_up.length > 0 && (
            <div className="sm:col-span-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase text-emerald-500 font-semibold mb-1.5">
                <TrendingUp className="w-3 h-3" /> Cena nahoru, protože:
              </div>
              <ul className="text-xs text-foreground/90 space-y-0.5">
                {result.reasons_up.map((r, i) => (<li key={i}>• {r}</li>))}
              </ul>
            </div>
          )}

          {result.reasons_down.length > 0 && (
            <div className="sm:col-span-2 rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase text-orange-500 font-semibold mb-1.5">
                <TrendingDown className="w-3 h-3" /> Cena dolů, protože:
              </div>
              <ul className="text-xs text-foreground/90 space-y-0.5">
                {result.reasons_down.map((r, i) => (<li key={i}>• {r}</li>))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default SmartPriceCheck;

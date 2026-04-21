import { useState, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Fuel, TrendingDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";

const BENZIN_PRICE = 38.5;
const LPG_PRICE = 16.5;
const LPG_INVESTMENT = 45000;

const LPGCalculator = () => {
  const [km, setKm] = useState(25000);
  const [consumption, setConsumption] = useState(12);
  const rafKm = useRef<number | null>(null);
  const rafCons = useRef<number | null>(null);

  // Throttle slider updates to one per animation frame to avoid layout thrash
  const onKmChange = useCallback((v: number[]) => {
    if (rafKm.current !== null) cancelAnimationFrame(rafKm.current);
    rafKm.current = requestAnimationFrame(() => setKm(v[0]));
  }, []);
  const onConsChange = useCallback((v: number[]) => {
    if (rafCons.current !== null) cancelAnimationFrame(rafCons.current);
    rafCons.current = requestAnimationFrame(() => setConsumption(v[0]));
  }, []);

  const { savings, paybackMonths } = useMemo(() => {
    const litresBenzin = (km / 100) * consumption;
    const litresLpg = (km / 100) * (consumption * 1.15); // LPG ~15% higher consumption
    const costBenzin = litresBenzin * BENZIN_PRICE;
    const costLpg = litresLpg * LPG_PRICE;
    const s = Math.round(costBenzin - costLpg);
    const p = s > 0 ? Math.round(LPG_INVESTMENT / (s / 12)) : 0;
    return { savings: s, paybackMonths: p };
  }, [km, consumption]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass-card p-6 mt-12"
    >
      <div className="flex items-center gap-3 mb-6">
        <Fuel className="w-6 h-6 text-emerald-400" />
        <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">LPG Kalkulačka úspor</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-3">
              Roční nájezd: <span className="text-primary">{km.toLocaleString("cs-CZ")} km</span>
            </label>
            <Slider
              value={[km]}
              onValueChange={onKmChange}
              min={5000}
              max={80000}
              step={1000}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>5 000 km</span>
              <span>80 000 km</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-3">
              Průměrná spotřeba: <span className="text-primary">{consumption} l/100km</span>
            </label>
            <Slider
              value={[consumption]}
              onValueChange={onConsChange}
              min={6}
              max={25}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>6 l</span>
              <span>25 l</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6 text-center">
            <TrendingDown className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">S naším LPG systémem ušetříte</p>
            <p className="text-3xl font-black text-emerald-400">{savings.toLocaleString("cs-CZ")} Kč/rok</p>
            <p className="text-sm text-muted-foreground mt-3">
              Návratnost investice: <span className="text-foreground font-semibold">{paybackMonths} měsíců</span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LPGCalculator;

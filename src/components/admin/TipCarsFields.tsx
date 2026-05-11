import { Send } from "lucide-react";

// Body-type codes from CiselnikyXmlImport (subset of common values)
const KAROSERIE_OPTIONS: { kod: string; popis: string }[] = [
  { kod: "", popis: "— Nevybráno —" },
  { kod: "S", popis: "Sedan" },
  { kod: "L", popis: "Liftback" },
  { kod: "H", popis: "Hatchback" },
  { kod: "K", popis: "Kombi" },
  { kod: "C", popis: "Coupé" },
  { kod: "B", popis: "Cabriolet" },
  { kod: "V", popis: "Van" },
  { kod: "M", popis: "MPV" },
  { kod: "U", popis: "SUV" },
  { kod: "P", popis: "Pickup" },
  { kod: "O", popis: "Off-road" },
  { kod: "T", popis: "Terénní" },
  { kod: "X", popis: "Ostatní" },
];

export interface TipCarsFormState {
  tipcars_export_enabled?: boolean;
  tipcars_karoserie_kod?: string | null;
  tipcars_karoserie_popis?: string | null;
  tipcars_pocet_mist?: number | null;
  tipcars_pocet_dveri?: number | null;
  tipcars_prvni_majitel?: boolean | null;
  tipcars_servisni_knizka?: boolean | null;
  tipcars_nebourane?: boolean | null;
  tipcars_stk_do?: string | null;
}

interface Props {
  data: TipCarsFormState;
  onChange: (patch: Partial<TipCarsFormState>) => void;
}

export default function TipCarsFields({ data, onChange }: Props) {
  return (
    <div className="sm:col-span-2 lg:col-span-3 mt-4 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center gap-2 mb-3">
        <Send className="w-4 h-4 text-emerald-400" />
        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Informace pro TipCars</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Tato pole se používají výhradně pro automatický export inzerátu na TipCars. Na webu Chrysler-Pardubice se nezobrazují.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Karoserie</label>
          <select
            value={data.tipcars_karoserie_kod ?? ""}
            onChange={(e) => {
              const opt = KAROSERIE_OPTIONS.find((o) => o.kod === e.target.value);
              onChange({ tipcars_karoserie_kod: opt?.kod || null, tipcars_karoserie_popis: opt?.kod ? opt.popis : null });
            }}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
          >
            {KAROSERIE_OPTIONS.map((o) => (
              <option key={o.kod || "none"} value={o.kod}>{o.popis}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Počet míst</label>
          <input
            type="number"
            min={1}
            max={9}
            value={data.tipcars_pocet_mist ?? 5}
            onChange={(e) => onChange({ tipcars_pocet_mist: Number(e.target.value) })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Počet dveří</label>
          <input
            type="number"
            min={2}
            max={5}
            value={data.tipcars_pocet_dveri ?? 5}
            onChange={(e) => onChange({ tipcars_pocet_dveri: Number(e.target.value) })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">STK platná do</label>
          <input
            type="date"
            value={data.tipcars_stk_do ?? ""}
            onChange={(e) => onChange({ tipcars_stk_do: e.target.value || null })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 text-sm">
          <input
            type="checkbox"
            checked={!!data.tipcars_prvni_majitel}
            onChange={(e) => onChange({ tipcars_prvni_majitel: e.target.checked })}
          />
          <span>1. majitel</span>
        </label>

        <label className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 text-sm">
          <input
            type="checkbox"
            checked={!!data.tipcars_servisni_knizka}
            onChange={(e) => onChange({ tipcars_servisni_knizka: e.target.checked })}
          />
          <span>Servisní knížka</span>
        </label>

        <label className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 text-sm">
          <input
            type="checkbox"
            checked={data.tipcars_nebourane !== false}
            onChange={(e) => onChange({ tipcars_nebourane: e.target.checked })}
          />
          <span>Nebourané</span>
        </label>

        <label className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm sm:col-span-2 lg:col-span-3">
          <input
            type="checkbox"
            checked={data.tipcars_export_enabled !== false}
            onChange={(e) => onChange({ tipcars_export_enabled: e.target.checked })}
          />
          <span className="font-semibold">Zařadit tento vůz do automatického denního exportu na TipCars</span>
        </label>
      </div>
    </div>
  );
}

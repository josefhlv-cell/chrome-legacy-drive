import { useEffect } from "react";
import { Send, Lock } from "lucide-react";
import { detectTipCarsCode } from "@/lib/tipcarsCodebook";

// Karoserie codes from TipCars CiselnikyXmlImport.xml — skupina A "Osobní".
// POZOR: kódy jsou case-sensitive a TipCars používá u některých malá písmena!
const KAROSERIE_OPTIONS: { kod: string; popis: string }[] = [
  { kod: "",   popis: "— Nevybráno —" },
  { kod: "a",  popis: "Hatchback" },
  { kod: "w",  popis: "Liftback" },
  { kod: "b",  popis: "Sedan" },
  { kod: "A",  popis: "Limuzína" },
  { kod: "C",  popis: "Kabriolet" },
  { kod: "D",  popis: "Kupé" },
  { kod: "B",  popis: "Kombi" },
  { kod: "G",  popis: "VAN" },
  { kod: "c",  popis: "MPV" },
  { kod: "d",  popis: "SUV" },
  { kod: "A1", popis: "CUV" },
  { kod: "}",  popis: "Pick up" },
  { kod: "[",  popis: "Terénní" },
  { kod: "A2", popis: "Minibus" },
];

// Značka & model se odvozuje automaticky z názvu vozu podle TipCars číselníku
// (CiselnikyXmlImport.xml). Admin nemusí nic vybírat — sleduje to název.

// Emission norms (Euro 1–6)
const EMISNI_OPTIONS = ["", "Euro 1", "Euro 2", "Euro 3", "Euro 4", "Euro 5", "Euro 6", "Euro 6d"];
const POHON_OPTIONS = [
  { v: "", l: "— Nevybráno —" },
  { v: "FWD", l: "Přední (FWD)" },
  { v: "RWD", l: "Zadní (RWD)" },
  { v: "AWD", l: "4×4 (AWD)" },
];
const KLIMA_OPTIONS = [
  { v: "", l: "— Nevybráno —" },
  { v: "manual", l: "Manuální" },
  { v: "auto", l: "Automatická" },
  { v: "dual", l: "Dvouzónová" },
  { v: "tri", l: "Tříznová" },
  { v: "none", l: "Žádná" },
];

export interface TipCarsFormState {
  tipcars_export_enabled?: boolean;
  tipcars_znacka_kod?: string | null;
  tipcars_model_kod?: string | null;
  tipcars_karoserie_kod?: string | null;
  tipcars_karoserie_popis?: string | null;
  tipcars_pocet_mist?: number | null;
  tipcars_pocet_dveri?: number | null;
  tipcars_prvni_majitel?: boolean | null;
  tipcars_servisni_knizka?: boolean | null;
  tipcars_nebourane?: boolean | null;
  tipcars_stk_do?: string | null;
  tipcars_emisni_norma?: string | null;
  tipcars_pohon?: string | null;
  tipcars_prevodovka_pocet?: number | null;
  tipcars_garantovany_najezd?: boolean | null;
  tipcars_klimatizace?: string | null;
  tipcars_airbagy?: number | null;
}

// Data already filled higher up in the form — shown read-only in this section
// so the admin can see at a glance what TipCars will receive.
export interface TipCarsMirroredData {
  name?: string;
  vin?: string;
  year?: number;
  mileage?: number;
  fuel?: string;
  color?: string;
  engine?: string;
  power?: string;
  transmission?: string;
  price_with_vat?: number;
  show_vat?: boolean;
}

interface Props {
  data: TipCarsFormState;
  mirrored?: TipCarsMirroredData;
  onChange: (patch: Partial<TipCarsFormState>) => void;
}

function MirrorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-secondary/30 border border-border/40 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Lock className="w-3 h-3" />
        {label}
      </span>
      <span className="font-medium text-foreground text-right truncate">{value || "—"}</span>
    </div>
  );
}

export default function TipCarsFields({ data, mirrored, onChange }: Props) {
  const m = mirrored ?? {};
  const cenaCelkem =
    typeof m.price_with_vat === "number"
      ? m.show_vat
        ? Math.round(m.price_with_vat * 1.21)
        : m.price_with_vat
      : 0;

  const detected = detectTipCarsCode(m.name);
  const selectedModel = detected ?? { znacka_kod: "", znacka: "—", model_kod: "", model: "Nerozpoznáno (uveď značku v názvu)" };

  // Synchronizuj odvozenou značku/model do formData, aby se uložily do DB při Save
  useEffect(() => {
    if (!detected) return;
    if (data.tipcars_znacka_kod !== detected.znacka_kod || data.tipcars_model_kod !== detected.model_kod) {
      onChange({ tipcars_znacka_kod: detected.znacka_kod, tipcars_model_kod: detected.model_kod });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected?.znacka_kod, detected?.model_kod]);


  return (
    <div className="sm:col-span-2 lg:col-span-3 mt-4 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center gap-2 mb-3">
        <Send className="w-4 h-4 text-emerald-400" />
        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Informace pro TipCars</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Pole se zámkem se přebírají automaticky z údajů zadaných výše — nemusíte je vyplňovat dvakrát.
        Zbylá pole jsou specifická pro TipCars a do běžného inzerátu na webu se nezobrazují.
      </p>

      {/* ─── Auto-copied from main form (read-only mirrors) ─── */}
      <div className="mb-4">
        <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-2">Přebráno z inzerátu</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <MirrorRow label="Název" value={m.name || ""} />
          <MirrorRow label="VIN" value={m.vin || ""} />
          <MirrorRow label="Rok výroby" value={m.year ? String(m.year) : ""} />
          <MirrorRow label="Najeto km" value={m.mileage ? `${m.mileage.toLocaleString("cs-CZ")} km` : ""} />
          <MirrorRow label="Palivo" value={m.fuel || ""} />
          <MirrorRow label="Barva" value={m.color || ""} />
          <MirrorRow label="Motor" value={m.engine || ""} />
          <MirrorRow label="Výkon" value={m.power || ""} />
          <MirrorRow label="Převodovka" value={m.transmission || ""} />
          <MirrorRow label="Cena (vč. DPH)" value={cenaCelkem ? `${cenaCelkem.toLocaleString("cs-CZ")} Kč` : ""} />
        </div>
      </div>

      {/* ─── TipCars-only editable fields ─── */}
      <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-2">Doplňující údaje pro TipCars</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">
            Značka / model (číselník TipCars)
          </label>
          <div className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm font-semibold">
            {selectedModel.znacka} {selectedModel.model} ({selectedModel.model_kod})
          </div>
          {selectedModel && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Odešle se: značka <code>{selectedModel.znacka_kod}</code> · model <code>{selectedModel.model_kod}</code>
            </p>
          )}
        </div>

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
          <input type="number" min={1} max={9} value={data.tipcars_pocet_mist ?? 5}
            onChange={(e) => onChange({ tipcars_pocet_mist: Number(e.target.value) })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Počet dveří</label>
          <input type="number" min={2} max={5} value={data.tipcars_pocet_dveri ?? 5}
            onChange={(e) => onChange({ tipcars_pocet_dveri: Number(e.target.value) })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">STK platná do</label>
          <input type="date" value={data.tipcars_stk_do ?? ""}
            onChange={(e) => onChange({ tipcars_stk_do: e.target.value || null })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Emisní norma</label>
          <select value={data.tipcars_emisni_norma ?? ""}
            onChange={(e) => onChange({ tipcars_emisni_norma: e.target.value })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm">
            {EMISNI_OPTIONS.map((o) => <option key={o || "none"} value={o}>{o || "— Nevybráno —"}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Pohon</label>
          <select value={data.tipcars_pohon ?? ""}
            onChange={(e) => onChange({ tipcars_pohon: e.target.value })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm">
            {POHON_OPTIONS.map((o) => <option key={o.v || "none"} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Počet rychlostních stupňů</label>
          <input type="number" min={3} max={10} value={data.tipcars_prevodovka_pocet ?? ""}
            onChange={(e) => onChange({ tipcars_prevodovka_pocet: e.target.value ? Number(e.target.value) : null })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
            placeholder="např. 6" />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Klimatizace</label>
          <select value={data.tipcars_klimatizace ?? ""}
            onChange={(e) => onChange({ tipcars_klimatizace: e.target.value })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm">
            {KLIMA_OPTIONS.map((o) => <option key={o.v || "none"} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Počet airbagů</label>
          <input type="number" min={0} max={20} value={data.tipcars_airbagy ?? ""}
            onChange={(e) => onChange({ tipcars_airbagy: e.target.value ? Number(e.target.value) : null })}
            className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
            placeholder="např. 6" />
        </div>

        <label className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 text-sm">
          <input type="checkbox" checked={!!data.tipcars_prvni_majitel}
            onChange={(e) => onChange({ tipcars_prvni_majitel: e.target.checked })} />
          <span>1. majitel</span>
        </label>

        <label className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 text-sm">
          <input type="checkbox" checked={!!data.tipcars_servisni_knizka}
            onChange={(e) => onChange({ tipcars_servisni_knizka: e.target.checked })} />
          <span>Servisní knížka</span>
        </label>

        <label className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 text-sm">
          <input type="checkbox" checked={data.tipcars_nebourane !== false}
            onChange={(e) => onChange({ tipcars_nebourane: e.target.checked })} />
          <span>Nebourané</span>
        </label>

        <label className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 text-sm">
          <input type="checkbox" checked={data.tipcars_garantovany_najezd !== false}
            onChange={(e) => onChange({ tipcars_garantovany_najezd: e.target.checked })} />
          <span>Garantovaný nájezd</span>
        </label>

        <label className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm sm:col-span-2 lg:col-span-3">
          <input type="checkbox" checked={data.tipcars_export_enabled !== false}
            onChange={(e) => onChange({ tipcars_export_enabled: e.target.checked })} />
          <span className="font-semibold">Zařadit tento vůz do automatického denního exportu na TipCars</span>
        </label>
      </div>
    </div>
  );
}

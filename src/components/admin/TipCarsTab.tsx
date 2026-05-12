import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Send, Save, Settings as SettingsIcon, AlertTriangle, CheckCircle2, Clock,
  PlayCircle, RefreshCw, Loader2, FileText, Server, ListChecks, Bug, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVehicles, type DbVehicle } from "@/hooks/useVehicles";

type Settings = {
  id?: string;
  // TEST environment (currently provided by TipCars for testing)
  kod_firmy: string;
  heslo: string;
  sftp_host: string;
  sftp_port: number;
  sftp_user: string;
  sftp_password: string;
  // LIVE environment (production credentials — supplied later by TipCars)
  live_kod_firmy: string;
  live_heslo: string;
  live_sftp_host: string;
  live_sftp_port: number;
  live_sftp_user: string;
  live_sftp_password: string;
  // Company info
  firma_nazev: string;
  firma_email: string | null;
  firma_telefon: string | null;
  firma_www: string | null;
  firma_ulice: string | null;
  firma_psc: string | null;
  firma_mesto: string | null;
  // Automation
  auto_export_enabled: boolean;
  test_mode: boolean; // true = use TEST creds, false = use LIVE creds
  test_mode_locked: boolean; // hard lock — server-side enforced safety against accidental LIVE
  cron_schedule: string;
  cron_timezone: string;
  last_auto_run_at: string | null;
};

type LogRow = {
  id: string;
  level: string;
  operation: string;
  message: string;
  context: any;
  created_at: string;
  vehicle_id: string | null;
};

// --- Required field rules for TipCars ---
const REQUIRED_RULES: { key: string; label: string; check: (v: DbVehicle) => boolean }[] = [
  { key: "name", label: "Název / značka & model", check: (v) => !!v.name?.trim() },
  { key: "year", label: "Rok výroby", check: (v) => !!v.year && v.year > 1900 },
  { key: "price", label: "Cena (s DPH)", check: (v) => !!v.price_with_vat && v.price_with_vat > 0 },
  { key: "mileage", label: "Nájezd km", check: (v) => v.mileage !== null && v.mileage !== undefined && v.mileage >= 0 },
  { key: "vin", label: "VIN", check: (v) => !!v.vin?.trim() && v.vin.trim().length >= 11 },
  { key: "fuel", label: "Palivo", check: (v) => !!v.fuel?.trim() },
  { key: "color", label: "Barva", check: (v) => !!v.color?.trim() },
  { key: "engine_or_power", label: "Motor / výkon", check: (v) => !!(v.engine?.trim() || v.power?.trim()) },
  { key: "transmission", label: "Převodovka", check: (v) => !!v.transmission?.trim() },
  { key: "tipcars_karoserie", label: "TipCars: Karoserie", check: (v: any) => !!v.tipcars_karoserie_kod },
  { key: "tipcars_pocet_mist", label: "TipCars: Počet míst", check: (v: any) => !!v.tipcars_pocet_mist },
  { key: "tipcars_pocet_dveri", label: "TipCars: Počet dveří", check: (v: any) => !!v.tipcars_pocet_dveri },
];

function validateVehicle(v: DbVehicle) {
  const missing = REQUIRED_RULES.filter((r) => !r.check(v));
  return { ok: missing.length === 0, missing };
}

// --- Cron preset helpers ---
const HOURS = Array.from({ length: 24 }, (_, i) => i);
function buildDailyCron(localHour: number, tz: string): string {
  // Convert local hour in tz to UTC hour (best effort, ignoring DST shifts beyond date now)
  const now = new Date();
  const probe = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localHour, 0, 0);
  // Using Intl: get UTC offset of tz at probe
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false });
    // Local representation in tz of "now"
    const tzHourNow = parseInt(fmt.format(now), 10);
    const utcHourNow = now.getUTCHours();
    let offset = tzHourNow - utcHourNow;
    if (offset > 12) offset -= 24;
    if (offset < -12) offset += 24;
    let utcHour = (localHour - offset + 24) % 24;
    return `0 ${utcHour} * * *`;
  } catch {
    return `0 ${localHour} * * *`;
  }
}

export default function TipCarsTab() {
  const { toast } = useToast();
  const { data: vehicles = [] } = useVehicles();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [testRunning, setTestRunning] = useState(false);
  const [liveRunning, setLiveRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Load settings
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("tipcars_settings").select("*").limit(1).maybeSingle();
      if (error) toast({ title: "Chyba načtení nastavení", description: error.message, variant: "destructive" });
      setSettings(data as any);
      setLoading(false);
    })();
    refreshLogs();
  }, []);

  const refreshLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from("export_logs")
      .select("*")
      .eq("portal", "tipcars")
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((data as any) || []);
    setLogsLoading(false);
  };

  const eligibleVehicles = useMemo(
    () => vehicles.filter((v: any) => v.tipcars_export_enabled !== false && v.status !== "prodano"),
    [vehicles],
  );

  const validation = useMemo(
    () => eligibleVehicles.map((v) => ({ vehicle: v, ...validateVehicle(v) })),
    [eligibleVehicles],
  );
  const validCount = validation.filter((v) => v.ok).length;
  const invalidCount = validation.length - validCount;

  // Save settings
  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { id, last_auto_run_at, ...rest } = settings;
      const { error } = await supabase.from("tipcars_settings").update(rest).eq("id", id!);
      if (error) throw error;
      // Update cron schedule on server
      const { error: cronErr } = await supabase.rpc("set_tipcars_cron_schedule", { p_schedule: settings.cron_schedule });
      if (cronErr) throw new Error(`Cron: ${cronErr.message}`);
      toast({ title: "Uloženo", description: "Nastavení a plán exportu byly aktualizovány." });
    } catch (e: any) {
      toast({ title: "Chyba ukládání", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Run export. mode "test" = TEST creds + upload; "live" = LIVE creds + upload; "dry" = current env, only XML validation
  const [dryRunning, setDryRunning] = useState(false);
  const runExport = async (mode: "test" | "live" | "dry") => {
    const ids = selectedIds.length > 0 ? selectedIds : eligibleVehicles.map((v) => v.id);
    if (ids.length === 0) {
      toast({ title: "Žádná vozidla", description: "Vyber alespoň jedno vozidlo.", variant: "destructive" });
      return;
    }
    if (mode === "test") setTestRunning(true);
    else if (mode === "live") setLiveRunning(true);
    else setDryRunning(true);
    setLastResult(null);
    try {
      const test_mode = mode === "live" ? false : true; // dry follows test creds by default
      const dry_run = mode === "dry";
      const { data, error } = await supabase.functions.invoke("tipcars-export", {
        body: { vehicle_ids: ids, use_settings: true, use_sftp: false, test_mode, dry_run },
      });
      if (error) throw error;
      setLastResult(data);
      const envLabel = data?.env === "live" ? "OSTRÝ" : "TEST";
      toast({
        title: dry_run ? `Validace XML (${envLabel})` : (mode === "test" ? `TEST upload (${envLabel})` : `OSTRÝ upload`),
        description: data?.success
          ? dry_run
            ? `XML OK · ${data.vehicles_count} voz · ${data.photos_count} foto`
            : `FTP: ${data.ftp_uploaded ? "OK" : "FAIL"} → ${data.ftp_host} · ${data.zip_filename}`
          : data?.error || "Neznámá chyba",
        variant: data?.success ? "default" : "destructive",
      });
      refreshLogs();
    } catch (e: any) {
      setLastResult({ error: e.message });
      toast({ title: "Chyba exportu", description: e.message, variant: "destructive" });
    } finally {
      setTestRunning(false);
      setLiveRunning(false);
      setDryRunning(false);
    }
  };

  if (loading || !settings) {
    return <div className="deep-card p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Načítám nastavení…</div>;
  }

  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="deep-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" /> TipCars — řídící centrum
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Nastavení, plán automatického exportu, validace polí a testovací odeslání.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-3 py-1.5 rounded-full font-semibold ${settings.auto_export_enabled ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
              Auto-export: {settings.auto_export_enabled ? "ZAPNUTO" : "VYPNUTO"}
            </span>
            <span className={`px-3 py-1.5 rounded-full font-semibold ${settings.test_mode ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"}`}>
              Režim: {settings.test_mode ? "TEST (testovací prostředí TipCars)" : "OSTRÝ (produkce)"}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground border border-border">
              Plán: <code className="font-mono">{settings.cron_schedule}</code> UTC
            </span>
            {settings.last_auto_run_at && (
              <span className="px-3 py-1.5 rounded-full bg-secondary text-muted-foreground border border-border">
                Posl. běh: {new Date(settings.last_auto_run_at).toLocaleString("cs-CZ")}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Mode switch */}
      <div className="deep-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Aktivní prostředí (TEST / OSTRÝ)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          TipCars zatím povolil pouze testovací odesílání. Po schválení dostaneš nové přihlašovací údaje pro ostrý provoz — vyplň je dole v sekci „OSTRÝ provoz" a teprve pak přepni přepínač na OSTRÝ.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => set({ test_mode: true })}
            className={`p-4 rounded-lg border text-left transition ${settings.test_mode ? "border-amber-500/60 bg-amber-500/10" : "border-border bg-secondary/40 hover:border-amber-500/40"}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold uppercase tracking-wider text-amber-300">TEST</span>
              {settings.test_mode && <CheckCircle2 className="w-4 h-4 text-amber-300" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Posílá data na testovací server TipCars (<code>{settings.sftp_host || "—"}</code>) přihlašovacími údaji ze sekce „TEST prostředí".
            </p>
          </button>
          <button
            type="button"
            disabled={settings.test_mode_locked}
            onClick={() => !settings.test_mode_locked && set({ test_mode: false })}
            title={settings.test_mode_locked ? "Zámek TEST režimu je aktivní — odemkni ho dole." : undefined}
            className={`p-4 rounded-lg border text-left transition ${!settings.test_mode ? "border-emerald-500/60 bg-emerald-500/10" : "border-border bg-secondary/40 hover:border-emerald-500/40"} ${settings.test_mode_locked ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold uppercase tracking-wider text-emerald-300">OSTRÝ {settings.test_mode_locked && "🔒"}</span>
              {!settings.test_mode && <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Posílá inzeráty na produkční server TipCars (<code>{settings.live_sftp_host || "— nevyplněno —"}</code>) přihlašovacími údaji ze sekce „OSTRÝ provoz".
            </p>
          </button>
        </div>

        {/* Safety lock */}
        <div className={`mt-4 p-3 rounded-lg border ${settings.test_mode_locked ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.test_mode_locked}
              onChange={(e) => set({ test_mode_locked: e.target.checked, ...(e.target.checked ? { test_mode: true } : {}) })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-sm font-bold flex items-center gap-2">
                {settings.test_mode_locked ? "🔒 Zámek TEST režimu zapnutý" : "🔓 Zámek TEST režimu vypnutý"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {settings.test_mode_locked
                  ? "Server vynucuje TEST režim u všech exportů (manuálních i cronových). Nelze přepnout na OSTRÝ ani omylem odeslat ostrá data. Doporučeno nechat zapnuté, dokud TipCars neschválí ostrý import."
                  : "Pojistka je vypnutá. Můžeš ručně přepnout na OSTRÝ a odeslat živá data — používej jen po schválení od TipCars."}
              </p>
            </div>
          </label>
        </div>


        <div className="mt-4">
          <ToggleRow
            label="Automatický denní export na TipCars"
            desc="Pokud je vypnuto, plánovaný cron job se nespustí. Cron používá aktivní prostředí (TEST/OSTRÝ) zvolené výše."
            value={settings.auto_export_enabled}
            onChange={(b) => set({ auto_export_enabled: b })}
          />
        </div>
      </div>

      {/* TEST environment */}
      <div className="deep-card p-6 border-amber-500/30">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">TEST prostředí (aktuálně schválené TipCars)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Kód firmy (TipCars)" value={settings.kod_firmy} onChange={(v) => set({ kod_firmy: v })} />
          <Field label="Heslo (TipCars)" value={settings.heslo} onChange={(v) => set({ heslo: v })} type="password" />
          <Field label="SFTP host" value={settings.sftp_host} onChange={(v) => set({ sftp_host: v })} />
          <Field label="SFTP port" type="number" value={String(settings.sftp_port)} onChange={(v) => set({ sftp_port: Number(v) || 22 })} />
          <Field label="SFTP user" value={settings.sftp_user} onChange={(v) => set({ sftp_user: v })} />
          <Field label="SFTP password" type="password" value={settings.sftp_password} onChange={(v) => set({ sftp_password: v })} />
        </div>
      </div>

      {/* LIVE environment */}
      <div className="deep-card p-6 border-emerald-500/30">
        <div className="flex items-center gap-2 mb-2">
          <Server className="w-4 h-4 text-emerald-300" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">OSTRÝ provoz (produkce)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Pole vyplň, až ti TipCars pošle produkční přístupy. Do té doby nech přepínač nahoře na <strong>TEST</strong>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Kód firmy (LIVE)" value={settings.live_kod_firmy} onChange={(v) => set({ live_kod_firmy: v })} />
          <Field label="Heslo (LIVE)" value={settings.live_heslo} onChange={(v) => set({ live_heslo: v })} type="password" />
          <Field label="SFTP host (LIVE)" value={settings.live_sftp_host} onChange={(v) => set({ live_sftp_host: v })} />
          <Field label="SFTP port (LIVE)" type="number" value={String(settings.live_sftp_port)} onChange={(v) => set({ live_sftp_port: Number(v) || 22 })} />
          <Field label="SFTP user (LIVE)" value={settings.live_sftp_user} onChange={(v) => set({ live_sftp_user: v })} />
          <Field label="SFTP password (LIVE)" type="password" value={settings.live_sftp_password} onChange={(v) => set({ live_sftp_password: v })} />
        </div>
      </div>

      {/* Company info */}
      <div className="deep-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Údaje o firmě (společné pro oba režimy)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Firma — název" value={settings.firma_nazev} onChange={(v) => set({ firma_nazev: v })} />
          <Field label="Firma — email" value={settings.firma_email || ""} onChange={(v) => set({ firma_email: v })} />
          <Field label="Firma — telefon" value={settings.firma_telefon || ""} onChange={(v) => set({ firma_telefon: v })} />
          <Field label="Firma — web" value={settings.firma_www || ""} onChange={(v) => set({ firma_www: v })} />
          <Field label="Ulice" value={settings.firma_ulice || ""} onChange={(v) => set({ firma_ulice: v })} />
          <Field label="PSČ" value={settings.firma_psc || ""} onChange={(v) => set({ firma_psc: v })} />
          <Field label="Město" value={settings.firma_mesto || ""} onChange={(v) => set({ firma_mesto: v })} />
        </div>
      </div>

      {/* Schedule */}
      <div className="deep-card p-6">
        <div className="mt-0 p-4 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold uppercase tracking-wider">Plán automatického exportu</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Časové pásmo</label>
              <select
                value={settings.cron_timezone}
                onChange={(e) => set({ cron_timezone: e.target.value })}
                className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value="Europe/Prague">Europe/Prague</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Spouštět denně v (lokální čas)</label>
              <select
                value={(() => {
                  // best-effort: parse "0 H * * *" as UTC, convert to local hour
                  const m = settings.cron_schedule.match(/^0\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
                  if (!m) return "";
                  const utcH = parseInt(m[1], 10);
                  try {
                    const probe = new Date(Date.UTC(2026, 0, 1, utcH, 0, 0));
                    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: settings.cron_timezone, hour: "2-digit", hour12: false });
                    return String(parseInt(fmt.format(probe), 10));
                  } catch { return String(utcH); }
                })()}
                onChange={(e) => {
                  const localHour = parseInt(e.target.value, 10);
                  set({ cron_schedule: buildDailyCron(localHour, settings.cron_timezone) });
                }}
                className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value="">— Vyber hodinu —</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Cron výraz (UTC)</label>
              <input
                value={settings.cron_schedule}
                onChange={(e) => set({ cron_schedule: e.target.value })}
                className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm font-mono"
                placeholder="0 2 * * *"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            pg_cron běží v UTC. Hodina nad výběrem byla přepočtena pro {settings.cron_timezone}.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={saveSettings} disabled={saving} className="chrome-button inline-flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit nastavení & plán
          </button>
        </div>
      </div>

      {/* Validation */}
      <div className="deep-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Validace polí pro TipCars</h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              <CheckCircle2 className="w-3 h-3 inline mr-1" />{validCount} OK
            </span>
            <span className="px-2 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 font-semibold">
              <AlertTriangle className="w-3 h-3 inline mr-1" />{invalidCount} s chybami
            </span>
          </div>
        </div>
        {validation.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné vozy nejsou označené k exportu na TipCars.</p>
        ) : (
          <div className="overflow-auto max-h-[420px] border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 w-8"></th>
                  <th className="text-left p-2">Vozidlo</th>
                  <th className="text-left p-2">Stav</th>
                  <th className="text-left p-2">Chybí</th>
                </tr>
              </thead>
              <tbody>
                {validation.map(({ vehicle, ok, missing }) => {
                  const checked = selectedIds.includes(vehicle.id);
                  return (
                    <tr key={vehicle.id} className="border-t border-border/40 hover:bg-secondary/30">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, vehicle.id] : prev.filter((x) => x !== vehicle.id),
                            );
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <div className="font-semibold">{vehicle.name}</div>
                        <div className="text-[11px] text-muted-foreground">{vehicle.year} · VIN: {vehicle.vin || "—"}</div>
                      </td>
                      <td className="p-2">
                        {ok ? (
                          <span className="text-emerald-400 font-semibold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                        ) : (
                          <span className="text-destructive font-semibold inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {missing.length}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {missing.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {missing.map((r) => (
                              <span key={r.key} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                                {r.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {selectedIds.length > 0 ? `Vybráno: ${selectedIds.length}` : "Pokud nic nevybereš, test/export poběží na všech zařazených vozech."}
        </p>
      </div>

      {/* Run export */}
      <div className="deep-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <PlayCircle className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Spustit export ručně</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Tlačítka níže ignorují přepínač nahoře — vždy odešlou na zvolené prostředí.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runExport("dry")}
            disabled={testRunning || liveRunning || dryRunning}
            className="outline-button inline-flex items-center gap-2"
          >
            {dryRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
            Pouze validace XML (neodesílá)
          </button>
          <button
            onClick={() => runExport("test")}
            disabled={testRunning || liveRunning || dryRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 font-semibold text-sm"
          >
            {testRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
            Odeslat na TEST server
          </button>
          <button
            onClick={() => runExport("live")}
            disabled={testRunning || liveRunning || dryRunning || !settings.live_sftp_host || !settings.live_sftp_user}
            title={!settings.live_sftp_host ? "Nejprve vyplň přístupové údaje pro OSTRÝ provoz." : undefined}
            className="chrome-button inline-flex items-center gap-2"
          >
            {liveRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
            Odeslat na OSTRÝ server
          </button>
        </div>

        {lastResult && (
          <div className={`mt-4 p-3 rounded-lg border text-xs font-mono whitespace-pre-wrap break-all ${lastResult.error ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-emerald-500/30 bg-emerald-500/5"}`}>
            {JSON.stringify(lastResult, null, 2)}
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="deep-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Posledních 50 záznamů exportu</h3>
          </div>
          <button onClick={refreshLogs} className="outline-button text-xs inline-flex items-center gap-1">
            {logsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Obnovit
          </button>
        </div>
        <div className="overflow-auto max-h-[420px] border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 sticky top-0">
              <tr>
                <th className="text-left p-2">Čas</th>
                <th className="text-left p-2">Úroveň</th>
                <th className="text-left p-2">Operace</th>
                <th className="text-left p-2">Zpráva</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Zatím žádné logy.</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border/40">
                  <td className="p-2 whitespace-nowrap text-muted-foreground">{new Date(l.created_at).toLocaleString("cs-CZ")}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded font-semibold uppercase ${
                      l.level === "error" ? "bg-destructive/15 text-destructive" :
                      l.level === "warn" ? "bg-amber-500/15 text-amber-300" :
                      "bg-emerald-500/15 text-emerald-300"
                    }`}>{l.level}</span>
                  </td>
                  <td className="p-2 font-mono">{l.operation}</td>
                  <td className="p-2">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Small helper components ---
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/40 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}

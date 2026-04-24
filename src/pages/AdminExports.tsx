import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle,
  Trash2, Play, FlaskConical, Filter, Loader2, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Portal = "tipcars" | "sauto";
type ExportRow = {
  id: string;
  vehicle_id: string;
  portal: Portal;
  external_id: string;
  status: "pending" | "online" | "error" | "removed" | "disabled";
  last_export_at: string | null;
  last_success_at: string | null;
  last_error: string;
  attempts: number;
  metadata: Record<string, unknown>;
  updated_at: string;
};

type LogRow = {
  id: string;
  vehicle_id: string | null;
  portal: Portal | null;
  operation: string;
  level: "info" | "warn" | "error" | string;
  message: string;
  context: Record<string, unknown>;
  created_at: string;
};

type Vehicle = { id: string; name: string; status: string; inventory_number: string };

function getCreds() {
  try {
    const t = localStorage.getItem("tipcars_credentials");
    const s = localStorage.getItem("sauto_credentials");
    return {
      tipcars: t ? JSON.parse(t) : null,
      sauto: s ? JSON.parse(s) : null,
    };
  } catch {
    return { tipcars: null, sauto: null };
  }
}

const statusBadge = (s: ExportRow["status"]) => {
  const map = {
    online: "bg-green-500/15 text-green-400 border-green-500/30",
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    error: "bg-red-500/15 text-red-400 border-red-500/30",
    removed: "bg-gray-500/15 text-gray-400 border-gray-500/30",
    disabled: "bg-gray-500/15 text-gray-500 border-gray-500/30",
  } as const;
  const icon = {
    online: <CheckCircle2 className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
    error: <XCircle className="w-3 h-3" />,
    removed: <Trash2 className="w-3 h-3" />,
    disabled: <AlertTriangle className="w-3 h-3" />,
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${map[s]}`}>
      {icon[s]} {s}
    </span>
  );
};

const levelBadge = (l: string) => {
  const map: Record<string, string> = {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
  };
  return <span className={`font-mono text-xs ${map[l] || "text-muted-foreground"}`}>{l.toUpperCase()}</span>;
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
};

export default function AdminExports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [portalFilter, setPortalFilter] = useState<"all" | Portal>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ExportRow["status"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "error" | "warn">("all");
  const [logPortal, setLogPortal] = useState<"all" | Portal>("all");

  const { data: exports = [], refetch: refetchExports } = useQuery({
    queryKey: ["vehicle_exports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_exports")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as unknown) as ExportRow[];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id,name,status,inventory_number");
      if (error) throw error;
      return (data as unknown) as Vehicle[];
    },
    enabled: !!user,
  });

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["export_logs", logFilter, logPortal],
    queryFn: async () => {
      let q = supabase.from("export_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (logFilter !== "all") q = q.eq("level", logFilter);
      if (logPortal !== "all") q = q.eq("portal", logPortal);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown) as LogRow[];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const vehicleMap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const filteredExports = useMemo(() => {
    return exports.filter(e =>
      (portalFilter === "all" || e.portal === portalFilter) &&
      (statusFilter === "all" || e.status === statusFilter)
    );
  }, [exports, portalFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalVehicles = vehicles.length;
    const exported = new Set(exports.filter(e => e.status === "online").map(e => e.vehicle_id)).size;
    const errors = exports.filter(e => e.status === "error").length;
    const last = exports[0]?.last_export_at;
    return { totalVehicles, exported, errors, last };
  }, [exports, vehicles]);

  const toggleAll = () => {
    if (selected.size === filteredExports.length) setSelected(new Set());
    else setSelected(new Set(filteredExports.map(e => e.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const runTipCars = async (vehicleIds: string[], testMode = false) => {
    const creds = getCreds();
    if (!creds.tipcars?.kod_firmy || !creds.tipcars?.heslo) {
      toast({ title: "Chybí přihlašovací údaje TipCars", description: "Vyplňte je v Adminu → Vozidla.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tipcars-export", {
        body: {
          vehicle_ids: vehicleIds,
          tipcars_kod_firmy: creds.tipcars.kod_firmy,
          tipcars_heslo: creds.tipcars.heslo,
          ftp_host: creds.tipcars.ftp_host || "ftp.tipcars.com",
          ftp_user: creds.tipcars.ftp_user,
          ftp_password: creds.tipcars.ftp_password,
          test_mode: testMode,
        },
      });
      if (error) throw error;
      toast({
        title: testMode ? "✅ TipCars TEST OK" : (data?.ftp_uploaded ? "✅ TipCars nahráno" : "⚠️ TipCars dokončeno"),
        description: testMode ? `XML validní, ${data?.vehicles_count} voz., ${data?.photos_count} fotek` : (data?.ftp_message || ""),
      });
    } catch (err) {
      toast({ title: "Chyba TipCars", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["vehicle_exports"] });
      qc.invalidateQueries({ queryKey: ["export_logs"] });
    }
  };

  const runSauto = async (vehicleIds: string[], testMode = false) => {
    const creds = getCreds();
    if (!creds.sauto?.login || !creds.sauto?.password || !creds.sauto?.sw_key) {
      toast({ title: "Chybí přihlašovací údaje Sauto", description: "Vyplňte je v Adminu → Vozidla.", variant: "destructive" });
      return;
    }
    setBusy(true);
    let ok = 0, fail = 0;
    for (const vid of vehicleIds) {
      try {
        const { data, error } = await supabase.functions.invoke("sauto-export", {
          body: {
            vehicle_id: vid,
            sauto_login: creds.sauto.login,
            sauto_password: creds.sauto.password,
            sauto_sw_key: creds.sauto.sw_key,
            test_mode: testMode,
          },
        });
        if (error || data?.error) { fail++; continue; }
        ok++;
      } catch { fail++; }
    }
    toast({
      title: testMode ? `Sauto TEST: ${ok} OK / ${fail} fail` : `Sauto: ${ok} OK / ${fail} fail`,
    });
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["vehicle_exports"] });
    qc.invalidateQueries({ queryKey: ["export_logs"] });
  };

  const deleteFromSauto = async (vehicleId: string) => {
    const creds = getCreds();
    if (!creds.sauto?.login) {
      toast({ title: "Chybí přihlašovací údaje Sauto", variant: "destructive" }); return;
    }
    if (!confirm("Opravdu smazat ze Sauto.cz?")) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("sauto-delete", {
        body: {
          vehicle_id: vehicleId,
          sauto_login: creds.sauto.login,
          sauto_password: creds.sauto.password,
          sauto_sw_key: creds.sauto.sw_key,
        },
      });
      if (error) throw error;
      toast({ title: data?.success ? "✅ Smazáno ze Sauto" : "⚠️ " + (data?.message || "Neúspěch") });
    } catch (err) {
      toast({ title: "Chyba mazání", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["vehicle_exports"] });
    }
  };

  const retryFailed = async () => {
    const failedTip = exports.filter(e => e.status === "error" && e.portal === "tipcars").map(e => e.vehicle_id);
    const failedSauto = exports.filter(e => e.status === "error" && e.portal === "sauto").map(e => e.vehicle_id);
    if (failedTip.length === 0 && failedSauto.length === 0) {
      toast({ title: "Žádné neúspěšné exporty k opakování" }); return;
    }
    if (failedTip.length > 0) await runTipCars(failedTip, false);
    if (failedSauto.length > 0) await runSauto(failedSauto, false);
  };

  const exportSelected = async (portal: Portal, testMode: boolean) => {
    const ids = Array.from(selected)
      .map(id => exports.find(e => e.id === id)?.vehicle_id)
      .filter((x): x is string => !!x);
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) {
      toast({ title: "Není vybráno žádné vozidlo" }); return;
    }
    if (portal === "tipcars") await runTipCars(unique, testMode);
    else await runSauto(unique, testMode);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Pro přístup se přihlaste v adminu.</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-2">
                <ArrowLeft className="w-4 h-4" /> Zpět na admin
              </Link>
              <h1 className="text-3xl font-bold">Export Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sledování a řízení exportů na TipCars a Sauto.cz
              </p>
            </div>
            <button
              onClick={() => { refetchExports(); refetchLogs(); }}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Obnovit
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Vozidla celkem" value={stats.totalVehicles} />
            <StatCard label="Online" value={stats.exported} accent="text-green-400" />
            <StatCard label="Chyby" value={stats.errors} accent="text-red-400" />
            <StatCard label="Poslední export" value={fmtDate(stats.last ?? null)} small />
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy || selected.size === 0}
                onClick={() => exportSelected("tipcars", false)}
                className="px-3 py-1.5 rounded bg-emerald-600/20 border border-emerald-600/40 text-emerald-300 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5" /> Exportovat → TipCars ({selected.size})
              </button>
              <button
                disabled={busy || selected.size === 0}
                onClick={() => exportSelected("sauto", false)}
                className="px-3 py-1.5 rounded bg-orange-600/20 border border-orange-600/40 text-orange-300 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5" /> Exportovat → Sauto ({selected.size})
              </button>
              <div className="w-px bg-border mx-1" />
              <button
                disabled={busy || selected.size === 0}
                onClick={() => exportSelected("tipcars", true)}
                className="px-3 py-1.5 rounded bg-card border border-border text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <FlaskConical className="w-3.5 h-3.5" /> Test TipCars
              </button>
              <button
                disabled={busy || selected.size === 0}
                onClick={() => exportSelected("sauto", true)}
                className="px-3 py-1.5 rounded bg-card border border-border text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <FlaskConical className="w-3.5 h-3.5" /> Test Sauto
              </button>
              <div className="w-px bg-border mx-1" />
              <button
                disabled={busy}
                onClick={retryFailed}
                className="px-3 py-1.5 rounded bg-yellow-600/20 border border-yellow-600/40 text-yellow-300 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Opakovat všechny chyby
              </button>
              {busy && <Loader2 className="w-4 h-4 animate-spin text-primary self-center ml-2" />}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={portalFilter}
              onChange={(e) => setPortalFilter(e.target.value as typeof portalFilter)}
              className="px-3 py-1.5 rounded bg-card border border-border text-sm"
            >
              <option value="all">Všechny portály</option>
              <option value="tipcars">TipCars</option>
              <option value="sauto">Sauto</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-1.5 rounded bg-card border border-border text-sm"
            >
              <option value="all">Všechny statusy</option>
              <option value="online">Online</option>
              <option value="pending">Pending</option>
              <option value="error">Chyba</option>
              <option value="removed">Odebráno</option>
            </select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredExports.length} záznamů
            </span>
          </div>

          {/* Exports table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && selected.size === filteredExports.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="p-3 text-left">Vozidlo</th>
                    <th className="p-3 text-left">Portál</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">External ID</th>
                    <th className="p-3 text-left">Poslední export</th>
                    <th className="p-3 text-left">Pokusy</th>
                    <th className="p-3 text-left">Chyba</th>
                    <th className="p-3 text-left">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExports.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Žádné exporty zatím nejsou. Spusťte první export z Admin → Vozidla.
                    </td></tr>
                  )}
                  {filteredExports.map((e) => {
                    const v = vehicleMap.get(e.vehicle_id);
                    return (
                      <tr key={e.id} className="border-t border-border/50 hover:bg-muted/20">
                        <td className="p-3">
                          <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} />
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{v?.name || "(smazáno)"}</div>
                          {v?.inventory_number && (
                            <div className="text-xs text-muted-foreground">#{v.inventory_number}</div>
                          )}
                        </td>
                        <td className="p-3 capitalize">{e.portal}</td>
                        <td className="p-3">{statusBadge(e.status)}</td>
                        <td className="p-3 font-mono text-xs">{e.external_id || "—"}</td>
                        <td className="p-3 text-xs">{fmtDate(e.last_export_at)}</td>
                        <td className="p-3 text-center">{e.attempts}</td>
                        <td className="p-3 text-xs text-red-400 max-w-xs truncate" title={e.last_error}>
                          {e.last_error || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <button
                              disabled={busy}
                              onClick={() => e.portal === "tipcars" ? runTipCars([e.vehicle_id]) : runSauto([e.vehicle_id])}
                              className="p-1.5 rounded hover:bg-muted text-primary"
                              title="Re-export"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            {e.portal === "sauto" && e.external_id && (
                              <button
                                disabled={busy}
                                onClick={() => deleteFromSauto(e.vehicle_id)}
                                className="p-1.5 rounded hover:bg-muted text-red-400"
                                title="Smazat ze Sauto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Logs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">Logy ({logs.length})</h2>
              <div className="flex gap-2">
                <select
                  value={logPortal}
                  onChange={(e) => setLogPortal(e.target.value as typeof logPortal)}
                  className="px-2 py-1 rounded bg-background border border-border text-xs"
                >
                  <option value="all">Všechny portály</option>
                  <option value="tipcars">TipCars</option>
                  <option value="sauto">Sauto</option>
                </select>
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                  className="px-2 py-1 rounded bg-background border border-border text-xs"
                >
                  <option value="all">Vše</option>
                  <option value="error">Pouze chyby</option>
                  <option value="warn">Warning+</option>
                </select>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {logs.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">Žádné logy.</div>
              )}
              {logs.map((l) => {
                const v = l.vehicle_id ? vehicleMap.get(l.vehicle_id) : null;
                return (
                  <div key={l.id} className="px-4 py-2 border-b border-border/30 hover:bg-muted/20 text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-muted-foreground font-mono">{fmtDate(l.created_at)}</span>
                      {levelBadge(l.level)}
                      <span className="text-muted-foreground">{l.portal || "—"} · {l.operation}</span>
                      {v && <span className="text-primary">{v.name}</span>}
                    </div>
                    <div className="mt-1 font-mono text-xs whitespace-pre-wrap break-words">{l.message}</div>
                    {Object.keys(l.context || {}).length > 0 && (
                      <details className="mt-1 text-muted-foreground">
                        <summary className="cursor-pointer text-[10px]">context</summary>
                        <pre className="text-[10px] overflow-x-auto mt-1">{JSON.stringify(l.context, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatCard({ label, value, accent, small }: { label: string; value: string | number; accent?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`mt-1 font-bold ${small ? "text-base" : "text-2xl"} ${accent || ""}`}>{value}</div>
    </div>
  );
}

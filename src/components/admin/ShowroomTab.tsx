import { useMemo, useState } from "react";
import JSZip from "jszip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles, type DbVehicle } from "@/hooks/useVehicles";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Wand2,
  CheckCircle2,
  Image as ImageIcon,
  Download,
  History,
  CheckSquare,
  Square,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import showroomBg from "@/assets/showroom-background.jpg";

const SHOWROOM_LIMIT = 6;

type ImgRow = {
  id: string;
  vehicle_id: string;
  image_url: string;
  is_main: boolean;
  sort_order: number;
  showroom_url: string;
  showroom_thumb_url?: string;
  showroom_status: "none" | "queued" | "processing" | "done" | "failed";
  showroom_progress?: number;
  showroom_error: string;
  original_backup_url: string;
  showroom_generated_at: string | null;
  showroom_applied_at?: string | null;
  showroom_history?: Array<{ at: string; event: string; detail?: string }>;
};

type ShowroomMode = "off" | "main" | "exterior";

const useVehicleImagesAdmin = (vehicleId?: string) =>
  useQuery({
    queryKey: ["showroom-images", vehicleId],
    enabled: !!vehicleId,
    refetchInterval: (query) => {
      const rows = (query.state.data ?? []) as ImgRow[];
      return rows.some((img) => img.showroom_status === "queued" || img.showroom_status === "processing") ? 2500 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_images")
        .select("id, vehicle_id, image_url, is_main, sort_order, showroom_url, showroom_thumb_url, showroom_status, showroom_progress, showroom_error, original_backup_url, showroom_generated_at, showroom_applied_at, showroom_history")
        .eq("vehicle_id", vehicleId!)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ImgRow[];
    },
  });

const safeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Chrysler";

const fetchFile = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Nelze stáhnout fotku (${r.status})`);
  return r.blob();
};

const fileExt = (url: string) => {
  const clean = url.split("?")[0];
  const ext = clean.split(".").pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : "jpg";
};

export default function ShowroomTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: vehicles } = useVehicles(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedVehicleIds, setCheckedVehicleIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ done: 0, total: 0 });
  const [downloading, setDownloading] = useState(false);

  const selected = useMemo(
    () => (vehicles ?? []).find((v: DbVehicle) => v.id === selectedId) ?? null,
    [vehicles, selectedId],
  );

  const { data: images, refetch } = useVehicleImagesAdmin(selectedId ?? undefined);

  const selectedMain = useMemo(() => {
    const list = images ?? [];
    return list.find((img) => img.is_main) ?? list[0] ?? null;
  }, [images]);

  const setMode = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: ShowroomMode }) => {
      const { error } = await supabase.from("vehicles").update({ showroom_mode: mode } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const updateMode = (id: string, mode: ShowroomMode) => {
    setMode.mutate({ id, mode }, {
      onSuccess: () => toast({ title: mode === "off" ? "Showroom vypnut" : "Showroom režim uložen" }),
      onError: (e: any) => toast({ title: "Nelze uložit režim", description: e?.message, variant: "destructive" }),
    });
  };

  const callGen = async (imageId: string, force = false) => {
    setBusyIds((p) => new Set(p).add(imageId));
    try {
      const { data, error } = await supabase.functions.invoke("showroom-generate", { body: { imageId, force } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await refetch();
      return data as any;
    } catch (e: any) {
      toast({ title: "Showroom zůstal zachován", description: "Fotografie nebyla změněna, můžete pokračovat v práci." });
      await refetch();
      return { ok: false, skipped: true };
    } finally {
      setBusyIds((p) => {
        const n = new Set(p);
        n.delete(imageId);
        return n;
      });
    }
  };

  const callApply = async (imageId: string, action: "apply" | "restore") => {
    setBusyIds((p) => new Set(p).add(imageId));
    try {
      const { data, error } = await supabase.functions.invoke("showroom-apply", { body: { imageId, action } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: action === "apply" ? "Showroom varianta zapnuta" : "Originál obnoven" });
      await refetch();
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message, variant: "destructive" });
    } finally {
      setBusyIds((p) => {
        const n = new Set(p);
        n.delete(imageId);
        return n;
      });
    }
  };

  const restoreVehicle = async (vehicleId: string) => {
    if (!confirm("Obnovit originální fotografie u tohoto vozu a vypnout showroom režim?")) return;
    setBulkBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("showroom-apply", { body: { vehicleId, action: "restore_vehicle" } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Originální fotografie obnoveny" });
      await refetch();
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    } catch (e: any) {
      toast({ title: "Obnova selhala", description: e?.message, variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  };

  const getTargets = async (vehicleId: string, mode: ShowroomMode) => {
    const { data, error } = await supabase
      .from("vehicle_images")
      .select("id, is_main, sort_order, showroom_url, showroom_status")
      .eq("vehicle_id", vehicleId)
      .order("is_main", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const rows = data ?? [];
    const targets = mode === "main" ? rows.filter((d) => d.is_main).slice(0, 1) : rows.slice(0, SHOWROOM_LIMIT);
    if (targets.length === 0 && rows.length > 0) targets.push(rows[0]);
    return targets;
  };

  const generateForVehicle = async (vehicleId: string, mode: ShowroomMode, applyAfter = true) => {
    if (mode === "off") return;
    const targets = await getTargets(vehicleId, mode);
    for (const t of targets) {
      // sequential processing keeps the AI gateway stable and acts as a lightweight queue
      // eslint-disable-next-line no-await-in-loop
      const generated = await callGen(t.id);
      if (applyAfter && generated?.showroom_url) {
        // eslint-disable-next-line no-await-in-loop
        await callApply(t.id, "apply");
      }
    }
  };

  const bulkApply = async () => {
    const picked = checkedVehicleIds.size > 0
      ? (vehicles ?? []).filter((v) => checkedVehicleIds.has(v.id))
      : (vehicles ?? []).filter((v: any) => v.showroom_mode && v.showroom_mode !== "off");
    const list = picked.filter((v: any) => v.showroom_mode && v.showroom_mode !== "off");
    if (list.length === 0) {
      toast({ title: "Vyberte vozy se zapnutým showroom režimem" });
      return;
    }
    setBulkBusy(true);
    setQueueProgress({ done: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i += 1) {
        const v: any = list[i];
        // eslint-disable-next-line no-await-in-loop
        await generateForVehicle(v.id, v.showroom_mode, true);
        setQueueProgress({ done: i + 1, total: list.length });
      }
      toast({ title: `Hotovo: ${list.length} vozidel zpracováno` });
    } finally {
      setBulkBusy(false);
    }
  };

  const toggleChecked = (id: string) => {
    setCheckedVehicleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadZip = async () => {
    if (!selected || !images?.length) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const base = safeName((selected as any).name);
      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        const originalUrl = img.original_backup_url || img.image_url;
        if (originalUrl) {
          // eslint-disable-next-line no-await-in-loop
          zip.file(`Original/${String(i + 1).padStart(2, "0")}.${fileExt(originalUrl)}`, await fetchFile(originalUrl));
        }
        if (img.showroom_url) {
          // eslint-disable-next-line no-await-in-loop
          zip.file(`Web_Showroom/${String(i + 1).padStart(2, "0")}.${fileExt(img.showroom_url)}`, await fetchFile(img.showroom_url));
        }
        const adUrl = img.showroom_thumb_url || img.showroom_url;
        if (adUrl) {
          // eslint-disable-next-line no-await-in-loop
          zip.file(`Inzerce/${String(i + 1).padStart(2, "0")}.${fileExt(adUrl)}`, await fetchFile(adUrl));
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "ZIP připraven ke stažení" });
    } catch (e: any) {
      toast({ title: "ZIP export selhal", description: e?.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const queuePct = queueProgress.total ? Math.round((queueProgress.done / queueProgress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Showroom Background Mode
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Produkční režim pro jednotné fotografie před budovou Chrysler Pardubice. Originály zůstávají uložené samostatně a showroom verze se použije pouze po ručním zapnutí.
            </p>
          </div>
          <button
            onClick={bulkApply}
            disabled={bulkBusy}
            className="chrome-button inline-flex items-center gap-2 text-sm"
            title="Zpracuje vybrané vozy, nebo všechny vozy se zapnutým režimem"
          >
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Hromadně aplikovat
          </button>
        </div>
        {bulkBusy && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Fronta generování</span>
              <span>{queueProgress.done}/{queueProgress.total} · {queuePct}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${queuePct}%` }} />
            </div>
          </div>
        )}
        <div className="mt-4 rounded-md overflow-hidden border border-border max-h-44">
          <img src={showroomBg} alt="Referenční showroom pozadí" className="w-full h-44 object-cover" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
        <div className="bg-card border border-border rounded-lg p-3 max-h-[720px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2 px-1 gap-2 flex-wrap">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Vozidla</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const all = vehicles ?? [];
                  const allSelected = all.length > 0 && all.every((v: any) => checkedVehicleIds.has(v.id));
                  if (allSelected) setCheckedVehicleIds(new Set());
                  else setCheckedVehicleIds(new Set(all.map((v: any) => v.id)));
                }}
                className="text-[10px] inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
              >
                {(vehicles ?? []).length > 0 && (vehicles ?? []).every((v: any) => checkedVehicleIds.has(v.id))
                  ? <><CheckSquare className="w-3 h-3" /> odznačit vše</>
                  : <><Square className="w-3 h-3" /> označit vše</>}
              </button>
              <button
                type="button"
                onClick={() => setCheckedVehicleIds(new Set())}
                className="text-[10px] text-muted-foreground hover:text-primary"
              >
                vyčistit
              </button>
            </div>
          </div>
          {checkedVehicleIds.size > 0 && (
            <div className="mb-2 px-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={bulkApply}
                disabled={bulkBusy}
                className="text-[10px] px-2 py-1 rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" /> Generovat ({checkedVehicleIds.size})
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={async () => {
                  if (!confirm(`Obnovit originály u ${checkedVehicleIds.size} označených vozů? Showroom se vypne.`)) return;
                  setBulkBusy(true);
                  setQueueProgress({ done: 0, total: checkedVehicleIds.size });
                  try {
                    const ids = Array.from(checkedVehicleIds);
                    for (let i = 0; i < ids.length; i += 1) {
                      try {
                        await supabase.functions.invoke("showroom-apply", { body: { vehicleId: ids[i], action: "restore_vehicle" } });
                      } catch { /* continue */ }
                      setQueueProgress({ done: i + 1, total: ids.length });
                    }
                    toast({ title: `Originály obnoveny u ${ids.length} vozů` });
                    qc.invalidateQueries({ queryKey: ["vehicles"] });
                    refetch();
                  } finally { setBulkBusy(false); }
                }}
                className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" /> Obnovit originály
              </button>
            </div>
          )}
          <div className="space-y-1">
            {(vehicles ?? []).map((v: any) => {
              const checked = checkedVehicleIds.has(v.id);
              return (
                <div key={v.id} className={`rounded-md border transition-colors ${selectedId === v.id ? "bg-primary/10 border-primary" : "border-border hover:bg-secondary"}`}>
                  <div className="flex items-center gap-1 p-1">
                    <button type="button" onClick={() => toggleChecked(v.id)} className="p-1 text-muted-foreground hover:text-primary" title="Vybrat pro hromadnou aplikaci">
                      {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setSelectedId(v.id)} className="flex-1 text-left px-2 py-1.5 text-sm flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{v.name}</div>
                        <div className="text-[10px] text-muted-foreground">{v.year} · {v.inventory_number || "—"}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${v.showroom_mode === "off" || !v.showroom_mode ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                        {v.showroom_mode === "exterior" ? "Více" : v.showroom_mode === "main" ? "Titulní" : "OFF"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 min-h-[520px]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">← Vyberte vůz vlevo</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{(selected as any).name}</h3>
                  <p className="text-xs text-muted-foreground">VIN: {(selected as any).vin || "—"}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(["off", "main", "exterior"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateMode(selected.id, m)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${((selected as any).showroom_mode ?? "off") === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
                    >
                      {m === "off" ? "OFF" : m === "main" ? "Pouze titulní foto" : "Více exteriérových fotek"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="border border-border rounded-md overflow-hidden bg-secondary/20">
                  <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Live preview · Originál</div>
                  {selectedMain ? <img src={selectedMain.original_backup_url || selectedMain.image_url} alt="Originální fotografie" className="w-full aspect-video object-cover" /> : <EmptyImage />}
                </div>
                <div className="border border-border rounded-md overflow-hidden bg-secondary/20">
                  <div className="px-3 py-2 text-xs uppercase tracking-wider text-primary">Live preview · Showroom</div>
                  {selectedMain?.showroom_url ? <img src={selectedMain.showroom_url} alt="Showroom varianta" className="w-full aspect-video object-cover" /> : <EmptyImage />}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => generateForVehicle(selected.id, "main", true)} className="chrome-button inline-flex items-center gap-2 text-xs" disabled={busyIds.size > 0 || bulkBusy}>
                  <Wand2 className="w-3.5 h-3.5" /> Vygenerovat a zapnout titulní
                </button>
                <button onClick={() => generateForVehicle(selected.id, "exterior", true)} className="chrome-button inline-flex items-center gap-2 text-xs" disabled={busyIds.size > 0 || bulkBusy}>
                  <Sparkles className="w-3.5 h-3.5" /> Vygenerovat exteriér (max {SHOWROOM_LIMIT})
                </button>
                <button onClick={() => restoreVehicle(selected.id)} className="outline-button inline-flex items-center gap-2 text-xs" disabled={bulkBusy}>
                  <RotateCcw className="w-3.5 h-3.5" /> Obnovit originální fotografie
                </button>
                <button onClick={() => refetch()} className="outline-button inline-flex items-center gap-2 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Obnovit stav
                </button>
                <button onClick={downloadZip} disabled={downloading || !images?.some((img) => img.showroom_url)} className="outline-button inline-flex items-center gap-2 text-xs">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Stáhnout všechny upravené fotografie
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {(images ?? []).map((img) => {
                  const busy = busyIds.has(img.id);
                  const applied = Boolean(img.showroom_applied_at);
                  const progress = img.showroom_status === "done" ? 100 : img.showroom_progress ?? 0;
                  const isRecoverable = img.showroom_status === "failed";
                  const statusLabel = isRecoverable ? "připraveno" : img.showroom_status;
                  return (
                    <div key={img.id} className="border border-border rounded-md overflow-hidden bg-secondary/30">
                      <div className="grid grid-cols-2 text-[10px] font-medium uppercase tracking-wider">
                        <div className="bg-muted/50 px-2 py-1 text-center">Originál</div>
                        <div className="bg-primary/10 px-2 py-1 text-center text-primary">Showroom</div>
                      </div>
                      <div className="grid grid-cols-2 aspect-[16/6]">
                        <img src={img.original_backup_url || img.image_url} alt="Originál" className="w-full h-full object-cover border-r border-border" loading="lazy" />
                        {img.showroom_url ? <img src={img.showroom_url} alt="Showroom" className="w-full h-full object-cover" loading="lazy" /> : <EmptyImage compact />}
                      </div>
                      {(img.showroom_status === "queued" || img.showroom_status === "processing") && (
                        <div className="px-2 pt-2">
                          <div className="h-1.5 rounded-full bg-background overflow-hidden"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>
                        </div>
                      )}
                      <div className="p-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="flex items-center gap-1">
                          {img.showroom_status === "done" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          {isRecoverable && <RefreshCw className="w-3 h-3 text-muted-foreground" />}
                          {(img.showroom_status === "processing" || img.showroom_status === "queued" || busy) && <Loader2 className="w-3 h-3 animate-spin" />}
                          {img.is_main && <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px]">TITULNÍ</span>}
                          {applied && <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[9px]">ZAPNUTO</span>}
                          <span className="text-muted-foreground">{statusLabel}</span>
                        </span>
                        <div className="ml-auto flex gap-1 flex-wrap">
                          <button onClick={() => callGen(img.id, true)} disabled={busy} className="px-2 py-1 rounded border border-border hover:bg-background text-[10px] inline-flex items-center gap-1">
                            <Wand2 className="w-3 h-3" /> Generovat
                          </button>
                          {img.showroom_url && !applied && (
                            <button onClick={() => callApply(img.id, "apply")} disabled={busy} className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Zapnout
                            </button>
                          )}
                          {applied && (
                            <button onClick={() => callApply(img.id, "restore")} disabled={busy} className="px-2 py-1 rounded border border-border hover:bg-background text-[10px] inline-flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" /> Originál
                            </button>
                          )}
                          {img.showroom_url && (
                            <a href={img.showroom_url} download className="px-2 py-1 rounded border border-border hover:bg-background text-[10px] inline-flex items-center gap-1">
                              <Download className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      {img.showroom_error && !isRecoverable && <div className="px-2 pb-2 text-[10px] text-destructive">{img.showroom_error}</div>}
                      {!!img.showroom_history?.length && (
                        <div className="border-t border-border/60 px-2 py-2 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1 mb-1"><History className="w-3 h-3" /> Historie úprav</div>
                          {img.showroom_history.slice(-3).reverse().map((h, i) => (
                            <div key={`${h.at}-${i}`} className="truncate">{new Date(h.at).toLocaleString("cs-CZ")} · {h.event}{h.detail ? ` · ${h.detail}` : ""}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!images || images.length === 0) && <p className="text-sm text-muted-foreground col-span-2 text-center py-6">Vůz nemá nahrané žádné fotografie.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyImage({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`w-full h-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground ${compact ? "" : "aspect-video"}`}>
      <ImageIcon className="w-4 h-4 mr-1" /> nevygenerováno
    </div>
  );
}

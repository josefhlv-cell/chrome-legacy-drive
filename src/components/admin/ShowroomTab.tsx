import { useMemo, useState } from "react";
import JSZip from "jszip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles, type DbVehicle } from "@/hooks/useVehicles";
import {
  Loader2,
  RefreshCw,
  RotateCcw,
  Wand2,
  CheckCircle2,
  Image as ImageIcon,
  Download,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const showroomBg = "/assets/showroom/master_showroom_background.webp";

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
  showroom_placement?: Placement | null;
  showroom_validation?: { score: number; passed: boolean; checks: Array<{ check: string; ok: boolean; detail?: string }> } | null;
  showroom_metadata?: Record<string, unknown> | null;
};

/** Manual admin override — mirrors the placement contract of the edge pipeline. */
type Placement = {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetY: number;
};

const DEFAULT_PLACEMENT: Placement = {
  scale: 0.46,
  offsetX: 0,
  offsetY: 0,
  rotationDeg: 0,
  shadowOpacity: 1,
  shadowBlur: 1,
  shadowOffsetY: 0,
};

type ShowroomMode = "off" | "main";

const normalizeImageRow = (row: unknown): ImgRow => {
  const image = row as ImgRow;
  const rawValidation = image.showroom_validation;
  const hasValidScore = typeof rawValidation?.score === "number";
  const checks = Array.isArray(rawValidation?.checks) ? rawValidation.checks : [];

  return {
    ...image,
    showroom_history: Array.isArray(image.showroom_history) ? image.showroom_history : [],
    showroom_validation: hasValidScore
      ? {
          score: rawValidation.score,
          passed: typeof rawValidation.passed === "boolean" ? rawValidation.passed : false,
          checks,
        }
      : null,
  };
};

const useVehicleImagesAdmin = (vehicleId?: string) =>
  useQuery({
    queryKey: ["showroom-images", vehicleId],
    enabled: !!vehicleId,
    refetchInterval: (query) => {
      const rows = (query.state.data ?? []) as ImgRow[];
      return rows.some((img) => img.showroom_status === "queued" || img.showroom_status === "processing") ? 2500 : false;
    },
    queryFn: async () => {
      if (!vehicleId) return [];
      const { data, error } = await supabase
        .from("vehicle_images")
        .select("id, vehicle_id, image_url, is_main, sort_order, showroom_url, showroom_thumb_url, showroom_status, showroom_progress, showroom_error, original_backup_url, showroom_generated_at, showroom_applied_at, showroom_history, showroom_placement, showroom_validation, showroom_metadata")
        .eq("vehicle_id", vehicleId)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(normalizeImageRow);
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
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  // Manual placement override for the selected vehicle's main photo.
  const [overrideOn, setOverrideOn] = useState(false);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

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

  const callGen = async (imageId: string, force = false, withOverride = false) => {
    setBusyIds((p) => new Set(p).add(imageId));
    try {
      const { data, error } = await supabase.functions.invoke("showroom-generate", {
        body: {
          imageId,
          force,
          ...(withOverride && overrideOn ? { placement, saveAsDefault } : {}),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await refetch();
      return data as any;
    } catch (e: any) {
      // Surface the REAL reason (deploy 404, AI 429/402, validation 422, upload error)
      // instead of a vague message — otherwise every failure looks identical.
      const msg = e?.message || e?.error?.message || "Neznámá chyba";
      toast({
        title: "Showroom generování selhalo",
        description: `${msg} — původní fotografie zůstala nezměněná.`,
        variant: "destructive",
      });
      console.error("showroom-generate failed:", e);
      await refetch();
      return { ok: false, skipped: true, error: msg };
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


  const generateMainPhoto = async (applyAfter = true) => {
    if (!selectedMain) {
      toast({ title: "Vozidlo nemá titulní fotografii", variant: "destructive" });
      return;
    }
    const generated = await callGen(selectedMain.id);
    if (applyAfter && generated?.showroom_url) {
      await callApply(selectedMain.id, "apply");
    }
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
        if (img.id === selectedMain?.id && img.showroom_url) {
          // eslint-disable-next-line no-await-in-loop
          zip.file(`Web_Showroom/${String(i + 1).padStart(2, "0")}.${fileExt(img.showroom_url)}`, await fetchFile(img.showroom_url));
        }
        const adUrl = img.id === selectedMain?.id ? (img.showroom_thumb_url || img.showroom_url) : "";
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
        </div>
        <div className="mt-4 rounded-md overflow-hidden border border-border max-h-44">
          <img src={showroomBg} alt="Referenční showroom pozadí" className="w-full h-44 object-cover" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
        <div className="bg-card border border-border rounded-lg p-3 max-h-[720px] overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1">Vozidla</div>
          <div className="space-y-1">
            {(vehicles ?? []).map((v: any) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`w-full rounded-md border p-2 text-left text-sm transition-colors ${selectedId === v.id ? "bg-primary/10 border-primary" : "border-border hover:bg-secondary"}`}
              >
                <span className="block truncate font-medium">{v.name}</span>
                <span className="text-[10px] text-muted-foreground">{v.year} · {v.inventory_number || "—"}</span>
              </button>
            ))}
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
                  {(["off", "main"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateMode(selected.id, m)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${((selected as any).showroom_mode ?? "off") === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
                    >
                      {m === "off" ? "OFF" : "Pouze titulní foto"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                <div className="border border-border rounded-md overflow-hidden bg-secondary/20 flex flex-col">
                  <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Live preview · Originál</div>
                  <div className="w-full aspect-video bg-background flex items-center justify-center">
                    {selectedMain ? <img src={selectedMain.original_backup_url || selectedMain.image_url} alt="Originální fotografie" className="w-full h-auto max-h-full" /> : <EmptyImage />}
                  </div>
                </div>
                <div className="border border-border rounded-md overflow-hidden bg-secondary/20 flex flex-col">
                  <div className="px-3 py-2 text-xs uppercase tracking-wider text-primary">Live preview · Showroom</div>
                  <div className="w-full aspect-video bg-background flex items-center justify-center">
                    {selectedMain?.showroom_url ? <img src={selectedMain.showroom_url} alt="Showroom varianta" className="w-full h-auto max-h-full" /> : <EmptyImage />}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => generateMainPhoto(true)} className="chrome-button inline-flex items-center gap-2 text-xs" disabled={busyIds.size > 0}>
                  <Wand2 className="w-3.5 h-3.5" /> Vygenerovat a zapnout titulní
                </button>
                <button onClick={() => selectedMain && callApply(selectedMain.id, "restore")} className="outline-button inline-flex items-center gap-2 text-xs" disabled={!selectedMain?.original_backup_url || busyIds.size > 0}>
                  <RotateCcw className="w-3.5 h-3.5" /> Obnovit titulní originál
                </button>
                <button onClick={() => refetch()} className="outline-button inline-flex items-center gap-2 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Obnovit stav
                </button>
                <button onClick={downloadZip} disabled={downloading || !images?.some((img) => img.showroom_url)} className="outline-button inline-flex items-center gap-2 text-xs">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Stáhnout titulní showroom + originální galerii
                </button>
              </div>

              {/* ---- Manuální doladění umístění (bez AI, jen matematika) ---- */}
              <div className="border border-border rounded-md p-3 space-y-3 bg-secondary/10">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input type="checkbox" checked={overrideOn} onChange={(e) => setOverrideOn(e.target.checked)} />
                  Manuální doladění umístění (přepíše naučený profil modelu)
                </label>
                {overrideOn && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {([
                        ["Velikost (šířka plátna)", "scale", 0.34, 0.54, 0.01],
                        ["Posun X (px)", "offsetX", -300, 300, 1],
                        ["Posun Y (px)", "offsetY", -160, 160, 1],
                        ["Rotace (°)", "rotationDeg", -1, 1, 0.1],
                        ["Síla stínu", "shadowOpacity", 0, 2, 0.05],
                        ["Rozostření stínu", "shadowBlur", 0.4, 2, 0.05],
                        ["Posun stínu Y (px)", "shadowOffsetY", -40, 40, 1],
                      ] as Array<[string, keyof Placement, number, number, number]>).map(([label, key, min, max, step]) => (
                        <div key={key}>
                          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                            <span>{label}</span>
                            <span className="text-foreground font-mono">{placement[key]}</span>
                          </div>
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={placement[key]}
                            onChange={(e) => setPlacement((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                            className="w-full accent-primary"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} />
                        Uložit jako výchozí pro tento model
                      </label>
                      <button
                        onClick={() => selectedMain && callGen(selectedMain.id, true, true)}
                        disabled={!selectedMain || busyIds.size > 0}
                        className="chrome-button inline-flex items-center gap-2 text-xs"
                      >
                        <Wand2 className="w-3.5 h-3.5" /> Přegenerovat titulní s tímto nastavením
                      </button>
                      <button onClick={() => setPlacement(DEFAULT_PLACEMENT)} className="outline-button text-xs">
                        Reset
                      </button>
                    </div>
                  </>
                )}
                {selectedMain?.showroom_validation && (
                  <p className="text-[11px] text-muted-foreground">
                    Kontrola kvality: <span className={selectedMain.showroom_validation.passed ? "text-emerald-500" : "text-destructive"}>
                      {(selectedMain.showroom_validation.score * 100).toFixed(0)} %
                    </span>
                    {selectedMain.showroom_validation.checks.filter((c) => !c.ok).length > 0 && (
                      <> · problémy: {selectedMain.showroom_validation.checks.filter((c) => !c.ok).map((c) => c.check).join(", ")}</>
                    )}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {(selectedMain ? [selectedMain] : []).map((img) => {
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
                      <div className="grid grid-cols-2 bg-background">
                        <div className="w-full aspect-video bg-background flex items-center justify-center border-r border-border overflow-hidden">
                          <img src={img.original_backup_url || img.image_url} alt="Originál" className="w-full h-auto max-h-full" loading="lazy" />
                        </div>
                        <div className="w-full aspect-video bg-background flex items-center justify-center overflow-hidden">
                          {img.showroom_url ? <img src={img.showroom_url} alt="Showroom" className="w-full h-auto max-h-full" loading="lazy" /> : <EmptyImage compact />}
                        </div>
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
                          {<span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px]">TITULNÍ</span>}
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


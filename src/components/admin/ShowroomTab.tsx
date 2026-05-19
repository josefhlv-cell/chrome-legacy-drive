import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles, type DbVehicle } from "@/hooks/useVehicles";
import { Loader2, Sparkles, RefreshCw, RotateCcw, Wand2, CheckCircle2, XCircle, Image as ImageIcon, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import showroomBg from "@/assets/showroom-background.jpg";

type ImgRow = {
  id: string;
  vehicle_id: string;
  image_url: string;
  is_main: boolean;
  sort_order: number;
  showroom_url: string;
  showroom_status: "none" | "queued" | "processing" | "done" | "failed";
  showroom_error: string;
  original_backup_url: string;
  showroom_generated_at: string | null;
};

const useVehicleImagesAdmin = (vehicleId?: string) =>
  useQuery({
    queryKey: ["showroom-images", vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_images")
        .select("id, vehicle_id, image_url, is_main, sort_order, showroom_url, showroom_status, showroom_error, original_backup_url, showroom_generated_at")
        .eq("vehicle_id", vehicleId!)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ImgRow[];
    },
  });

export default function ShowroomTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: vehicles } = useVehicles(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const selected = useMemo(
    () => (vehicles ?? []).find((v: DbVehicle) => v.id === selectedId) ?? null,
    [vehicles, selectedId],
  );

  const { data: images, refetch } = useVehicleImagesAdmin(selectedId ?? undefined);

  const setMode = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: "off" | "main" | "exterior" }) => {
      const { error } = await supabase.from("vehicles").update({ showroom_mode: mode } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const callGen = async (imageId: string) => {
    setBusyIds((p) => new Set(p).add(imageId));
    try {
      const { data, error } = await supabase.functions.invoke("showroom-generate", { body: { imageId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Showroom foto vygenerováno" });
      await refetch();
    } catch (e: any) {
      toast({ title: "Generování selhalo", description: e?.message, variant: "destructive" });
      await refetch();
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
      toast({ title: action === "apply" ? "Aplikováno na inzerát" : "Originál obnoven" });
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

  const generateForVehicle = async (vehicleId: string, mode: "main" | "exterior") => {
    const { data, error } = await supabase
      .from("vehicle_images")
      .select("id, is_main, sort_order")
      .eq("vehicle_id", vehicleId)
      .order("is_main", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error || !data) return;
    const targets = mode === "main"
      ? data.filter((d) => d.is_main).slice(0, 1)
      : data.slice(0, 6); // up to 6 exterior shots
    if (targets.length === 0 && data.length > 0) targets.push(data[0]);
    for (const t of targets) {
      // sequential to avoid AI rate limits
      // eslint-disable-next-line no-await-in-loop
      await callGen(t.id);
    }
  };

  const bulkApply = async () => {
    const list = (vehicles ?? []).filter((v: any) => v.showroom_mode && v.showroom_mode !== "off");
    if (list.length === 0) {
      toast({ title: "Žádná vozidla nemají zapnutý Showroom mode" });
      return;
    }
    setBulkBusy(true);
    try {
      for (const v of list as any[]) {
        // eslint-disable-next-line no-await-in-loop
        await generateForVehicle(v.id, v.showroom_mode);
      }
      toast({ title: `Hotovo: ${list.length} vozidel zpracováno` });
    } finally {
      setBulkBusy(false);
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
              AI nahradí pozadí fotografií vozů jednotným showroom backgroundem před budovou Chrysler &amp; Dodge Pardubice. Originální fotky zůstávají zachované — vše je vratné.
            </p>
          </div>
          <button
            onClick={bulkApply}
            disabled={bulkBusy}
            className="chrome-button inline-flex items-center gap-2 text-sm"
            title="Vygeneruje showroom verze pro všechny vozy se zapnutým módem"
          >
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Hromadně aplikovat (zapnuté vozy)
          </button>
        </div>
        <div className="mt-4 rounded-md overflow-hidden border border-border max-h-44">
          <img src={showroomBg} alt="Referenční showroom pozadí" className="w-full h-44 object-cover" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Referenční pozadí — auto se zachová, pouze background bude unifikován.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Vehicle list */}
        <div className="bg-card border border-border rounded-lg p-3 max-h-[640px] overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1">Vozidla</div>
          <div className="space-y-1">
            {(vehicles ?? []).map((v: any) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`w-full text-left px-3 py-2 rounded-md border text-sm flex items-center justify-between gap-2 transition-colors ${
                  selectedId === v.id ? "bg-primary/10 border-primary" : "border-border hover:bg-secondary"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{v.name}</div>
                  <div className="text-[10px] text-muted-foreground">{v.year} · {v.inventory_number || "—"}</div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                    v.showroom_mode === "off" || !v.showroom_mode
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {v.showroom_mode === "exterior" ? "Více fotek" : v.showroom_mode === "main" ? "Titulní" : "OFF"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="bg-card border border-border rounded-lg p-4 min-h-[400px]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              ← Vyberte vůz vlevo
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{(selected as any).name}</h3>
                  <p className="text-xs text-muted-foreground">VIN: {(selected as any).vin || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(["off", "main", "exterior"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode.mutate({ id: selected.id, mode: m })}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        ((selected as any).showroom_mode ?? "off") === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {m === "off" ? "OFF" : m === "main" ? "Titulní foto" : "Více exteriéru"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => generateForVehicle(selected.id, "main")}
                  className="chrome-button inline-flex items-center gap-2 text-xs"
                  disabled={busyIds.size > 0}
                >
                  <Wand2 className="w-3.5 h-3.5" /> Vygenerovat titulní
                </button>
                <button
                  onClick={() => generateForVehicle(selected.id, "exterior")}
                  className="chrome-button inline-flex items-center gap-2 text-xs"
                  disabled={busyIds.size > 0}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Vygenerovat exteriér (max 6)
                </button>
                <button
                  onClick={() => refetch()}
                  className="outline-button inline-flex items-center gap-2 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Obnovit stav
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(images ?? []).map((img) => {
                  const busy = busyIds.has(img.id);
                  const isOriginal = !img.original_backup_url; // currently showing original on web
                  return (
                    <div key={img.id} className="border border-border rounded-md overflow-hidden bg-secondary/30">
                      <div className="grid grid-cols-2 text-[10px] font-medium uppercase tracking-wider">
                        <div className="bg-muted/50 px-2 py-1 text-center">Originál</div>
                        <div className="bg-primary/10 px-2 py-1 text-center text-primary">Showroom</div>
                      </div>
                      <div className="grid grid-cols-2 aspect-[16/6]">
                        <img
                          src={img.original_backup_url || img.image_url}
                          alt="orig"
                          className="w-full h-full object-cover border-r border-border"
                          loading="lazy"
                        />
                        {img.showroom_url ? (
                          <img src={img.showroom_url} alt="showroom" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                            <ImageIcon className="w-4 h-4 mr-1" /> nevygenerováno
                          </div>
                        )}
                      </div>
                      <div className="p-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="flex items-center gap-1">
                          {img.showroom_status === "done" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          {img.showroom_status === "failed" && <XCircle className="w-3 h-3 text-destructive" />}
                          {(img.showroom_status === "processing" || busy) && <Loader2 className="w-3 h-3 animate-spin" />}
                          {img.is_main && <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px]">TITULNÍ</span>}
                          <span className="text-muted-foreground">{img.showroom_status}</span>
                        </span>
                        <div className="ml-auto flex gap-1">
                          <button
                            onClick={() => callGen(img.id)}
                            disabled={busy}
                            className="px-2 py-1 rounded border border-border hover:bg-background text-[10px] inline-flex items-center gap-1"
                          >
                            <Wand2 className="w-3 h-3" /> Generovat
                          </button>
                          {img.showroom_url && isOriginal && (
                            <button
                              onClick={() => callApply(img.id, "apply")}
                              disabled={busy}
                              className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Aplikovat
                            </button>
                          )}
                          {img.original_backup_url && (
                            <button
                              onClick={() => callApply(img.id, "restore")}
                              disabled={busy}
                              className="px-2 py-1 rounded border border-border hover:bg-background text-[10px] inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" /> Obnovit
                            </button>
                          )}
                          {img.showroom_url && (
                            <a
                              href={img.showroom_url}
                              download
                              className="px-2 py-1 rounded border border-border hover:bg-background text-[10px] inline-flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      {img.showroom_error && (
                        <div className="px-2 pb-2 text-[10px] text-destructive">{img.showroom_error}</div>
                      )}
                    </div>
                  );
                })}
                {(!images || images.length === 0) && (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-6">
                    Vůz nemá nahrané žádné fotografie.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

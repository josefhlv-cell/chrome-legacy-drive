import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Download, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pickPrimaryImage } from "@/lib/showroomPrimary";
import { generateVehicleShowroom } from "@/lib/vehicleShowroomGeneration";

export default function VehicleShowroomGenerator({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const lock = useRef(false);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["vehicle-showroom-generator", vehicleId],
    enabled: open,
    refetchInterval: query => query.state.data?.some(image => ["queued", "processing"].includes(image.showroom_status)) ? 2500 : false,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_images")
        .select("id,is_main,sort_order,image_url,original_backup_url,showroom_url,showroom_status,showroom_error")
        .eq("vehicle_id", vehicleId)
        .order("is_main", { ascending: false }).order("sort_order").order("id");
      if (error) throw error;
      return data ?? [];
    },
  });
  const primary = pickPrimaryImage(query.data);
  const processing = busy || Boolean(primary && ["queued", "processing"].includes(primary.showroom_status));
  const preview = primary?.showroom_url || result;

  async function generate() {
    if (!primary || processing || lock.current) return;
    // An existing result is read-only here: never charge again merely to open it.
    if (preview) { await query.refetch(); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      setResult(await generateVehicleShowroom(primary.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generování selhalo.");
    } finally {
      lock.current = false; setBusy(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["vehicle-showroom-generator", vehicleId] }),
        qc.invalidateQueries({ queryKey: ["vehicle-images", vehicleId] }),
        qc.invalidateQueries({ queryKey: ["showroom-images", vehicleId] }),
      ]);
    }
  }

  async function download() {
    if (!preview) return;
    try {
      const response = await fetch(preview);
      if (!response.ok) throw new Error(`Stažení selhalo (${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `showroom-${vehicleId}.jpg`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Stažení selhalo."); }
  }

  return <section className="mt-3 border-t border-border pt-2 min-w-0" aria-label="Generování pozadí">
    <Button type="button" variant="outline" size="sm" aria-expanded={open} aria-controls={`generate-showroom-${vehicleId}`} onClick={() => setOpen(value => !value)}>
      <Wand2 />Fotografie s pozadím{open ? <ChevronUp /> : <ChevronDown />}
    </Button>
    {open && <div id={`generate-showroom-${vehicleId}`} className="mt-3 space-y-3">
      {query.isLoading && <p role="status" className="text-xs text-muted-foreground">Načítání originálů…</p>}
      {query.isError && <p role="alert" className="text-sm text-destructive">Fotografie se nepodařilo načíst.</p>}
      {query.isSuccess && !primary && <p className="text-xs text-muted-foreground">Nejprve vložte originální fotografii vozu.</p>}
      {primary && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <figure className="min-w-0"><figcaption className="text-xs text-muted-foreground mb-1">Titulní originál</figcaption><img src={primary.original_backup_url || primary.image_url} alt="Titulní originální fotografie" className="w-full aspect-video object-contain bg-secondary rounded-md" /></figure>
          <figure className="min-w-0"><figcaption className="text-xs text-muted-foreground mb-1">Showroom pozadí</figcaption>{preview ? <img src={preview} alt="Vygenerovaná fotografie s pozadím" className="w-full aspect-video object-contain bg-secondary rounded-md" /> : <img src="/assets/showroom/master_showroom_background.jpg" alt="Pevné showroom pozadí" className="w-full aspect-video object-contain bg-secondary rounded-md" />}</figure>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={processing || query.isFetching} onClick={generate}>{processing ? <Loader2 className="animate-spin" /> : <Wand2 />}{processing ? "Generuji…" : preview ? "Načíst uložený výsledek" : "Vygenerovat titulní fotografii"}</Button>
          {preview && <Button type="button" variant="outline" size="sm" onClick={download}><Download />Stáhnout fotografii</Button>}
        </div>
        {processing && <p role="status" className="text-xs text-muted-foreground">Probíhá zpracování titulní fotografie…</p>}
      </>}
      <Button type="button" variant="ghost" size="sm" disabled={busy || query.isFetching} onClick={() => query.refetch()}><RefreshCw />Obnovit stav</Button>
      {(error || primary?.showroom_error) && <p role="alert" className="text-sm text-destructive break-words">{error || primary?.showroom_error} Původní fotografie zůstala zachována.</p>}
    </div>}
  </section>;
}
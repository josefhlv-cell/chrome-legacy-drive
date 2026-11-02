import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Images, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { moveShowRoomImage, type ShowRoomImage } from "@/lib/showRoomGallery";
import { pendingShowRoomCleanup, retryShowRoomCleanup, scheduleShowRoomCleanup, uploadShowRoomImage, useSaveShowRoomGallery, useShowRoomGallery } from "@/hooks/useShowRoomGallery";

export default function ShowRoomGallery({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [cleanupPending, setCleanupPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const query = useShowRoomGallery(vehicleId, open);
  const save = useSaveShowRoomGallery(vehicleId);
  const { toast } = useToast();
  const gallery = query.data;

  useEffect(() => {
    if (!open) return;
    setCleanupPending(pendingShowRoomCleanup(vehicleId).length > 0);
  }, [open, vehicleId]);

  // Warn before closing while the upload/metadata save is still in progress.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Změnu se nepodařilo uložit."); }
    finally { lock.current = false; setBusy(false); setProgress(null); }
  }

  async function cleanup(paths: string[]) {
    try { await scheduleShowRoomCleanup(vehicleId, paths); }
    catch { setCleanupPending(true); setError("Galerie je uložena, ale odstranění souboru z úložiště selhalo. Zkuste odstranit soubory znovu."); }
  }

  async function upload(files: FileList | null) {
    if (!files || !gallery) return;
    const selected = Array.from(files);
    await run(async () => {
      let snapshot = gallery;
      let images = [...gallery.images];
      setProgress({ done: 0, total: selected.length });
      for (let index = 0; index < selected.length; index++) {
        const image = await uploadShowRoomImage(vehicleId, selected[index]);
        const next = [...images, image];
        try { await save.mutateAsync({ snapshot, images: next, enabled: snapshot.enabled }); }
        catch (cause) { await cleanup([image.path]); throw cause; }
        images = next;
        snapshot = { ...snapshot, raw: next, images: next };
        setProgress({ done: index + 1, total: selected.length });
      }
      toast({ title: "Fotografie Show Room uloženy" });
    });
    if (input.current) input.current.value = "";
  }

  async function update(images: ShowRoomImage[], enabled: boolean) {
    if (!gallery) return;
    await save.mutateAsync({ snapshot: gallery, images, enabled });
  }

  async function remove(image: ShowRoomImage) {
    if (!gallery || !window.confirm("Odstranit tuto fotografii Show Room? Původní fotografie zůstanou zachovány.")) return;
    await run(async () => {
      const next = gallery.images.filter(item => item.id !== image.id);
      await update(next, next.length > 0 && gallery.enabled);
      await cleanup([image.path]);
    });
  }

  const disabled = busy || query.isFetching || !gallery;
  return (
    <section className="mt-3 border-t border-border pt-2 min-w-0" aria-label="Show Room">
      <Button type="button" variant="outline" size="sm" aria-expanded={open} aria-controls={`show-room-${vehicleId}`} onClick={() => setOpen(value => !value)}>
        <Images />Show Room{open ? <ChevronUp /> : <ChevronDown />}
      </Button>
      {open && <div id={`show-room-${vehicleId}`} className="mt-3 space-y-3">
        {query.isLoading && <p className="text-xs text-muted-foreground" role="status">Načítání galerie…</p>}
        {query.isError && <div role="alert" className="text-sm text-destructive">Galerii se nepodařilo načíst. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Zkusit znovu</Button></div>}
        {gallery && <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor={`show-toggle-${vehicleId}`} className="text-sm font-semibold text-foreground">Show</label>
              <Switch id={`show-toggle-${vehicleId}`} aria-label="Show" checked={gallery.enabled} disabled={disabled || !gallery.images.length}
                onCheckedChange={enabled => run(() => update(gallery.images, enabled))} />
              <span className={gallery.enabled ? "text-xs text-primary" : "text-xs text-muted-foreground"}>{gallery.enabled ? "Aktivní" : "Neaktivní"}</span>
            </div>
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Fotografie Show Room" onChange={event => upload(event.target.files)} />
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => input.current?.click()}><ImagePlus />Nahrát fotografie</Button>
          </div>
          {!gallery.images.length && <p className="text-xs text-muted-foreground">Žádné fotografie. Pro zapnutí Show nejprve nahrajte fotografie.</p>}
          {progress && <div role="status" className="space-y-1"><p className="text-xs text-muted-foreground">Nahrávání a ukládání: {progress.done} / {progress.total}</p><Progress value={progress.done / progress.total * 100} /></div>}
          {busy && !progress && <p role="status" className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Ukládání…</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {gallery.images.map((image, index) => <div key={image.id} className="rounded-md border border-border overflow-hidden min-w-0">
              <img src={image.url} alt={`Show Room ${index + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="bg-secondary px-1 py-1 text-xs text-secondary-foreground">{index === 0 ? "Hlavní" : `Fotografie ${index + 1}`}</div>
              <div className="flex flex-wrap justify-center bg-secondary gap-1 p-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Nastavit jako hlavní" aria-label={`Hlavní Show Room ${index + 1}`} disabled={disabled || index === 0} onClick={() => run(() => update(moveShowRoomImage(gallery.images, image.id, 0), gallery.enabled))}><Star /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Posunout nahoru" aria-label={`Posunout Show Room ${index + 1} nahoru`} disabled={disabled || index === 0} onClick={() => run(() => update(moveShowRoomImage(gallery.images, image.id, index - 1), gallery.enabled))}><ChevronUp /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Posunout dolů" aria-label={`Posunout Show Room ${index + 1} dolů`} disabled={disabled || index === gallery.images.length - 1} onClick={() => run(() => update(moveShowRoomImage(gallery.images, image.id, index + 1), gallery.enabled))}><ChevronDown /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Odstranit fotografii" aria-label={`Odstranit Show Room ${index + 1}`} disabled={disabled} onClick={() => remove(image)}><Trash2 /></Button>
              </div>
            </div>)}
          </div>
        </>}
        {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
        {cleanupPending && <Button variant="outline" size="sm" disabled={busy} onClick={() => run(async () => { await retryShowRoomCleanup(vehicleId); setCleanupPending(false); })}><Trash2 />Znovu odstranit soubory</Button>}
      </div>}
    </section>
  );
}
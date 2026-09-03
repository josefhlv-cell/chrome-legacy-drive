import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone, Camera, Download, Trash2, Wand2, Loader2, Star, CheckCircle2,
  ImageIcon, RefreshCw, Sparkles, FileArchive, Inbox,
} from "lucide-react";
import { useSessions, useSessionPhotos, useDeleteSessionPhoto } from "@/hooks/useSmartCapture";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { buildSessionZip, downloadBlob, type ExportPhoto } from "@/lib/smartCapture/export";
import type { ShotType } from "@/lib/smartCapture/types";
import type { BufferedPhoto } from "./NewVehiclePhotoUploader";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (photos: BufferedPhoto[], meta: { vin?: string; brand?: string; model?: string; year?: number }) => void;
}

type SessionRow = {
  id: string;
  created_at: string;
  status: string;
  quality_score: number;
  has_360: boolean;
  vin: string;
  decoded_data: Record<string, unknown>;
};

type PhotoRow = {
  id: string;
  shot_type: ShotType;
  shot_index: number;
  original_url: string;
  processed_url: string;
  quality_score: number;
  is_main: boolean;
};

export default function SmartDashboardDialog({ open, onOpenChange, onImport }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: sessions = [], isLoading, refetch } = useSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const deletePhoto = useDeleteSessionPhoto();

  const selected = useMemo(
    () => (sessions as SessionRow[]).find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId]
  );
  const { data: photos = [] } = useSessionPhotos(selectedId ?? undefined);
  const rows = photos as PhotoRow[];

  const handleImport = async () => {
    if (!selected || rows.length === 0) return;
    setImporting(true);
    try {
      const buffered: BufferedPhoto[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const url = r.processed_url || r.original_url;
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const filename = `${String(i + 1).padStart(2, "0")}-${r.shot_type}.jpg`;
        const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
        buffered.push({
          id: `sc-${r.id}`,
          file,
          previewUrl: URL.createObjectURL(file),
          isMain: r.is_main || (i === 0 && !rows.some((x) => x.is_main)),
          processed: true,
        });
      }
      const decoded = (selected.decoded_data ?? {}) as { make?: string; model?: string; year?: number };
      onImport(buffered, {
        vin: selected.vin || undefined,
        brand: decoded.make,
        model: decoded.model,
        year: decoded.year,
      });
      toast({ title: `Importováno ${buffered.length} fotek` });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Import selhal", description: String(e), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleZip = async () => {
    if (!selected || rows.length === 0) return;
    setZipping(true);
    try {
      const items: ExportPhoto[] = rows.map((r, i) => ({
        shotType: r.shot_type, index: i,
        originalUrl: r.original_url, processedUrl: r.processed_url,
        // Datum pořízení fotky (fallback: vznik session) → název souboru.
        capturedAt: (r as { created_at?: string }).created_at ?? selected.created_at,
      }));
      const decoded = (selected.decoded_data ?? {}) as {
        make?: string; model?: string; year?: string | number; color?: string;
      };
      const blob = await buildSessionZip(items, {
        brand: decoded.make || "Vozidlo",
        model: decoded.model || "Model",
        year: decoded.year,
        color: decoded.color,
      });
      downloadBlob(blob, `smart-capture-${selected.id.slice(0, 8)}.zip`);
    } catch (e) {
      toast({ title: "Export ZIP selhal", description: String(e), variant: "destructive" });
    } finally { setZipping(false); }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Smazat celou session včetně všech fotek?")) return;
    try {
      // smaž fotky pak session
      const { data: ps } = await supabase.from("smart_capture_photos").select("id").eq("session_id", id);
      for (const p of (ps as { id: string }[] ?? [])) {
        await supabase.from("smart_capture_photos").delete().eq("id", p.id);
      }
      await supabase.from("smart_capture_sessions").delete().eq("id", id);
      qc.invalidateQueries({ queryKey: ["smart-capture-sessions"] });
      if (selectedId === id) setSelectedId(null);
      toast({ title: "Session smazána" });
    } catch (e) {
      toast({ title: "Mazání selhalo", description: String(e), variant: "destructive" });
    }
  };

  const formatDate = (s: string) => new Date(s).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            Smart Dashboard
          </DialogTitle>
          <DialogDescription>
            Vyberte session vyfocenou v mobilu a importujte fotky přímo do formuláře nového vozidla.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] flex-1 overflow-hidden">
          {/* Sidebar: sessions */}
          <div className="border-r overflow-y-auto bg-muted/30">
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-muted/30 backdrop-blur">
              <span className="text-xs font-semibold uppercase tracking-wider">Session ({sessions.length})</span>
              <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-background" title="Obnovit">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {isLoading && (
              <div className="p-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
              </div>
            )}
            {!isLoading && sessions.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Žádné session. Vyfoťte vozidlo mobilem na <code className="text-primary">/admin/smart-capture</code>.
              </div>
            )}
            <ul className="divide-y">
              {(sessions as SessionRow[]).map((s) => {
                const dec = (s.decoded_data ?? {}) as { make?: string; model?: string };
                const label = [dec.make, dec.model].filter(Boolean).join(" ") || s.vin || "Bez identifikace";
                const isSel = selectedId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-background/60 transition ${isSel ? "bg-background" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{label}</span>
                        {s.has_360 && <Badge variant="secondary" className="text-[10px]">360°</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span>{formatDate(s.created_at)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Star className="w-3 h-3" />{s.quality_score || 0}</span>
                        <span>·</span>
                        <span className="capitalize">{s.status}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Main: photos */}
          <div className="overflow-y-auto p-6">
            {!selected && (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-20">
                <Smartphone className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">Vyberte session vlevo pro náhled fotek.</p>
              </div>
            )}
            {selected && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {(() => {
                        const dec = (selected.decoded_data ?? {}) as { make?: string; model?: string };
                        return [dec.make, dec.model].filter(Boolean).join(" ") || "Session";
                      })()}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Camera className="w-3.5 h-3.5" />
                      {rows.length} fotek
                      <span>·</span>
                      <span>Kvalita {selected.quality_score || 0} %</span>
                      {selected.vin && <><span>·</span><span>VIN {selected.vin}</span></>}
                      {selected.has_360 && <Badge variant="secondary" className="text-[10px]">360° kompletní</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleZip} disabled={zipping || rows.length === 0}>
                      {zipping ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileArchive className="w-4 h-4 mr-1.5" />}
                      ZIP
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteSession(selected.id)}>
                      <Trash2 className="w-4 h-4 mr-1.5" /> Smazat session
                    </Button>
                    <Button size="sm" onClick={handleImport} disabled={importing || rows.length === 0}>
                      {importing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                      Importovat do formuláře
                    </Button>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Tato session zatím nemá žádné fotografie.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {rows.map((r) => (
                      <div key={r.id} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
                        <img
                          src={r.processed_url || r.original_url}
                          alt={r.shot_type}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                          {r.is_main && <Badge className="text-[10px] bg-primary"><Star className="w-3 h-3 mr-0.5" />Hlavní</Badge>}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                          <div className="flex items-center justify-between text-[10px] text-white">
                            <span className="truncate">{r.shot_type}</span>
                            <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{r.quality_score}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm("Smazat fotku?")) deletePhoto.mutate({ id: r.id, sessionId: selected.id });
                          }}
                          className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                          title="Smazat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

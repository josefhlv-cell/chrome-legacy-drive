import { AlertCircle, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHOT_LABEL_MAP, type ShotType } from "@/lib/smartCapture/types";
import { retryPhoto, type QueuedPhoto } from "@/lib/smartCapture/photoQueue";

export function CaptureFilmstrip({ queue, photos }: {
  queue: QueuedPhoto[];
  photos: { id: string; processed_url: string; shot_type: string }[];
}) {
  const entries = [
    ...photos.filter(p => !queue.some(q => q.id === p.id)).map(p => ({ id: p.id, url: p.processed_url, type: p.shot_type, status: "done" as const, tip: undefined as string | undefined })),
    ...queue.map(p => ({ id: p.id, url: p.preview, type: p.shotType, status: p.status, tip: p.tip })),
  ];
  return <div className="flex gap-2 overflow-x-auto py-2" aria-label="Fotografie relace">
    {entries.map(p => <div key={p.id} className="relative shrink-0 w-20" title={p.tip}>
      <img src={p.url} alt={SHOT_LABEL_MAP[p.type as ShotType] ?? p.type} className="w-20 h-14 rounded-md object-cover border border-border" />
      <div className="flex items-center gap-1 text-[10px] bg-background/90 text-foreground px-1 py-1 rounded-b-md">
        {p.status === "uploading" ? <Loader2 size={10} className="animate-spin" /> : p.status === "error" ? <AlertCircle size={10} /> : <Check size={10} />}
        {p.status === "uploading" ? "Nahrává se" : p.status === "error" ? "Chyba" : "Hotovo"}
      </div>
      {p.status === "error" && <Button size="sm" variant="secondary" className="h-auto text-[10px] px-1 py-1 w-full" onClick={() => retryPhoto(p.id)}><RotateCcw size={10} /> Zkusit znovu</Button>}
    </div>)}
  </div>;
}
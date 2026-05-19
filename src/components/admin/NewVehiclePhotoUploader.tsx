import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, X, Star, StarOff, Wand2, Loader2, GripVertical,
  Maximize2, Camera, Image as ImageIcon, Trash2,
} from "lucide-react";
import { processImage } from "@/lib/smartCapture/imageProcessing";
import { useToast } from "@/hooks/use-toast";

export interface BufferedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  isMain: boolean;
  processed?: boolean;
}

interface Props {
  photos: BufferedPhoto[];
  onChange: (next: BufferedPhoto[]) => void;
  onLaunchSmartCapture?: () => void;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE = 25 * 1024 * 1024;

export default function NewVehiclePhotoUploader({ photos, onChange, onLaunchSmartCapture }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => () => { photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)); }, []); // eslint-disable-line

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const accepted: BufferedPhoto[] = [];
      for (const f of files) {
        if (!ALLOWED.includes(f.type)) {
          toast({ title: "Nepovolený formát", description: f.name, variant: "destructive" });
          continue;
        }
        if (f.size > MAX_FILE) {
          toast({ title: "Soubor je příliš velký", description: f.name, variant: "destructive" });
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          previewUrl: URL.createObjectURL(f),
          isMain: false,
        });
      }
      if (!accepted.length) return;
      const next = [...photos, ...accepted];
      // pokud žádná není hlavní, označ první
      if (!next.some((p) => p.isMain)) next[0].isMain = true;
      onChange(next);
    } finally {
      setUploading(false);
    }
  }, [photos, onChange, toast]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    addFiles(files);
  };

  const removePhoto = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    const next = photos.filter((p) => p.id !== id);
    if (target?.isMain && next.length) next[0].isMain = true;
    onChange(next);
  };

  const setMain = (id: string) => {
    onChange(photos.map((p) => ({ ...p, isMain: p.id === id })));
  };

  // Reorder via HTML5 drag
  const onItemDragStart = (id: string) => { dragId.current = id; };
  const onItemDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onItemDrop = (targetId: string) => {
    const src = dragId.current; dragId.current = null;
    if (!src || src === targetId) return;
    const srcIdx = photos.findIndex((p) => p.id === src);
    const tgtIdx = photos.findIndex((p) => p.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const next = [...photos];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);
    onChange(next);
  };

  // Auto-enhance — sjednocení vzhledu (kontrast, jas, sytost, sharpen)
  const enhanceAll = async () => {
    if (!photos.length) return;
    setEnhancing(true);
    try {
      const next: BufferedPhoto[] = [];
      for (const p of photos) {
        try {
          const { blob } = await processImage(p.file, {
            brightness: 2, contrast: 10, saturation: 8, sharpen: true, autoExposure: true,
            maxWidth: 2400, quality: 0.9,
          });
          const newFile = new File([blob], p.file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
          URL.revokeObjectURL(p.previewUrl);
          next.push({
            ...p, file: newFile, previewUrl: URL.createObjectURL(newFile), processed: true,
          });
        } catch {
          next.push(p);
        }
      }
      onChange(next);
      toast({ title: "Fotografie sjednoceny", description: `${next.filter((n) => n.processed).length} ks upraveno.` });
    } finally {
      setEnhancing(false);
    }
  };

  const fullscreenPhoto = photos.find((p) => p.id === fullscreenId);

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed transition-colors p-6 text-center ${
          isDragging ? "border-primary bg-primary/5" : "border-border/60 bg-secondary/30"
        }`}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

        <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
        <div className="text-sm text-foreground font-medium">Přetáhněte fotografie sem</div>
        <div className="text-xs text-muted-foreground mb-3">JPG, PNG nebo WebP · max 25 MB / soubor</div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => inputRef.current?.click()}
            className="chrome-button inline-flex items-center gap-1.5 text-xs">
            <ImageIcon className="w-3.5 h-3.5" /> Vybrat soubory
          </button>
          <button type="button" onClick={() => cameraInputRef.current?.click()}
            className="outline-button inline-flex items-center gap-1.5 text-xs">
            <Camera className="w-3.5 h-3.5" /> Pořídit foto
          </button>
          {onLaunchSmartCapture && (
            <button type="button" onClick={onLaunchSmartCapture}
              className="outline-button inline-flex items-center gap-1.5 text-xs">
              <Wand2 className="w-3.5 h-3.5" /> 📸 Spustit Smart Capture
            </button>
          )}
        </div>

        {uploading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-xl">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </div>

      {/* Toolbar */}
      {photos.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            {photos.length} fotek · titulní: <span className="text-foreground font-medium">{photos.find((p) => p.isMain)?.file.name ?? "—"}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={enhanceAll} disabled={enhancing}
              className="chrome-button inline-flex items-center gap-1.5 text-xs">
              {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Sjednotit vzhled (auto-úprava)
            </button>
            <button type="button" onClick={() => {
              photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
              onChange([]);
            }} className="outline-button inline-flex items-center gap-1.5 text-xs">
              <Trash2 className="w-3.5 h-3.5" /> Vymazat vše
            </button>
          </div>
        </div>
      )}

      {/* Gallery grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {photos.map((p, idx) => (
            <div key={p.id}
              draggable
              onDragStart={() => onItemDragStart(p.id)}
              onDragOver={onItemDragOver}
              onDrop={() => onItemDrop(p.id)}
              className={`relative group rounded-lg overflow-hidden border ${p.isMain ? "border-primary ring-2 ring-primary/30" : "border-border/40"} bg-secondary/40`}
            >
              <div className="aspect-square overflow-hidden">
                <img src={p.previewUrl} alt={p.file.name} className="w-full h-full object-cover" />
              </div>

              {/* Order badge */}
              <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] rounded px-1.5 py-0.5 flex items-center gap-1">
                <GripVertical className="w-3 h-3 opacity-60" /> {idx + 1}
              </div>

              {/* Main badge */}
              {p.isMain && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] rounded px-1.5 py-0.5 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Titulní
                </div>
              )}

              {/* Hover actions */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 flex justify-between opacity-0 group-hover:opacity-100 transition">
                <div className="flex gap-1">
                  <button type="button" onClick={() => setMain(p.id)}
                    title={p.isMain ? "Hlavní fotka" : "Nastavit jako titulní"}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur rounded p-1.5">
                    {p.isMain ? <Star className="w-3.5 h-3.5 text-yellow-300" /> : <StarOff className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <button type="button" onClick={() => setFullscreenId(p.id)}
                    title="Zvětšit" className="bg-white/10 hover:bg-white/20 backdrop-blur rounded p-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <button type="button" onClick={() => removePhoto(p.id)}
                  title="Smazat" className="bg-red-500/80 hover:bg-red-500 rounded p-1.5">
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen */}
      {fullscreenPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullscreenId(null)}>
          <button type="button" onClick={() => setFullscreenId(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full p-2 text-white">
            <X className="w-5 h-5" />
          </button>
          <img src={fullscreenPhoto.previewUrl} alt={fullscreenPhoto.file.name}
            className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Camera, Shield, Sparkles, Loader2, Settings as SettingsIcon, Images, ExternalLink, ChevronRight, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  useSmartCaptureSettings,
  useUpdateSmartCaptureSettings,
  useSessions,
  useSessionPhotos,
} from "@/hooks/useSmartCapture";
import { useToast } from "@/hooks/use-toast";

type Tri = "on" | "suggest" | "off";

interface FeatureToggle {
  key: string;
  label: string;
  desc?: string;
}

const FEATURES: FeatureToggle[] = [
  { key: "ai_quality_check", label: "AI kontrola kvality fotek" },
  { key: "ai_realtime_hints", label: "Realtime doporučení při focení" },
  { key: "auto_image_processing", label: "Automatické úpravy fotografií" },
  { key: "auto_brightness_normalize", label: "Sjednocení jasu" },
  { key: "auto_exposure_correction", label: "Korekce expozice" },
  { key: "auto_crop", label: "Automatický ořez" },
  { key: "auto_sort_gallery", label: "Automatické třídění galerie" },
  { key: "auto_pick_main", label: "Automatický výběr titulní fotografie" },
  { key: "ai_classify_shots", label: "AI rozpoznávání typů záběrů" },
  { key: "blur_detection", label: "Detekce rozmazání" },
  { key: "vin_scan_enabled", label: "VIN scan workflow" },
  { key: "vin_ocr", label: "OCR rozpoznávání VIN" },
  { key: "vin_autofill", label: "Automatické vyplnění z VIN" },
  { key: "export_folders", label: "Strukturovaný export složek" },
  { key: "generate_web_versions", label: "Generování web verzí" },
  { key: "generate_listing_versions", label: "Generování verzí pro inzerci" },
  { key: "auto_naming", label: "Automatické pojmenování souborů" },
  { key: "watermark", label: "Vodoznak" },
  { key: "blur_license_plate", label: "Rozmazání SPZ" },
  { key: "quality_score_enabled", label: "Skóre kvality prezentace" },
  { key: "auto_360_generation", label: "Generování 360° pohledu" },
  { key: "background_video_capture", label: "Video na pozadí pro 360°" },
  { key: "voice_control", label: "Hlasové ovládání (další / zpět / vyfotit / přefotit + diktování)" },
  { key: "horizon_auto_level", label: "Auto-rovnání horizontu (gyroskop)" },
  { key: "landscape_capture", label: "Focení na šířku (otočený telefon)" },
  { key: "grid_overlay", label: "Kompoziční mřížka (třetiny) v hledáčku" },
  { key: "thumbnail_background", label: "Miniatura na přednastaveném pozadí (1. záběr — pouze pro nabídku vozů)" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function SessionGallery() {
  const { data: sessions = [], isLoading } = useSessions();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const { data: photos = [], isLoading: photosLoading } = useSessionPhotos(selectedId);

  useEffect(() => {
    if (!selectedId && sessions.length > 0) {
      setSelectedId((sessions[0] as { id: string }).id);
    }
  }, [sessions, selectedId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="animate-spin" size={16} /> Načítám relace…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Zatím žádné Smart Capture relace. Spusť focení a fotky se tu objeví.
        <div className="mt-4">
          <a href="/admin/smart-capture" className="inline-flex items-center gap-2 text-primary hover:underline">
            <Camera size={14} /> Spustit Smart Capture
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-xl border bg-card overflow-hidden max-h-[520px] overflow-y-auto">
        {sessions.map((session) => {
          const row = session as {
            id: string;
            status?: string;
            created_at?: string;
            vin?: string;
            published_vehicle_id?: string | null;
          };
          const active = selectedId === row.id;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedId(row.id)}
              className={`w-full text-left px-3 py-3 border-b last:border-0 transition ${
                active ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">
                  {row.vin || row.id.slice(0, 8)}
                </span>
                <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Calendar size={11} />
                {formatDate(row.created_at)}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                  {row.status || "session"}
                </span>
                {row.published_vehicle_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    inzerát
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card p-4 min-h-[280px]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="font-medium text-sm">Fotky relace</h4>
            <p className="text-xs text-muted-foreground">
              {selectedId ? selectedId.slice(0, 8) + "…" : "—"}
            </p>
          </div>
          {selectedId && (
            <a
              href={`/admin/smart-capture?session=${selectedId}`}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={12} /> Otevřít v Smart Capture
            </a>
          )}
        </div>

        {photosLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
            <Loader2 className="animate-spin" size={16} /> Načítám fotky…
          </div>
        ) : photos.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            V této relaci zatím nejsou nahrané fotky.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => {
              const row = photo as {
                id: string;
                processed_url?: string;
                original_url?: string;
                shot_type?: string;
                shot_index?: number;
                is_main?: boolean;
              };
              const src = row.processed_url || row.original_url || "";
              return (
                <a
                  key={row.id}
                  href={src || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted"
                >
                  {src ? (
                    <img
                      src={src}
                      alt={row.shot_type || "foto"}
                      className="w-full h-full object-cover transition group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      bez náhledu
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <div className="text-[10px] text-white/95 truncate">
                      {row.shot_type || `záběr ${row.shot_index ?? ""}`}
                      {row.is_main ? " · titulní" : ""}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SmartCaptureSettingsTab() {
  const { data: settings, isLoading } = useSmartCaptureSettings();
  const update = useUpdateSmartCaptureSettings();
  const { toast } = useToast();
  const [local, setLocal] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (settings) setLocal(settings as Record<string, unknown>);
  }, [settings]);

  const setField = (k: string, v: unknown) => {
    setLocal((s) => ({ ...s, [k]: v }));
  };

  const save = async () => {
    try {
      const updates: Record<string, unknown> = {};
      Object.keys(local).forEach((k) => {
        if (k !== "id" && k !== "singleton" && k !== "updated_at") updates[k] = local[k];
      });
      await update.mutateAsync(updates);
      toast({ title: "Nastavení uloženo" });
    } catch (e) {
      toast({ title: "Chyba ukládání", description: String(e), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2">
        <Loader2 className="animate-spin" size={16} /> Načítám…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
          <Camera size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-light">Smart Capture</h2>
          <p className="text-sm text-muted-foreground">Galerie relací, fotky a nastavení AI focení.</p>
        </div>
        <a href="/admin/smart-capture" className="chrome-button inline-flex items-center gap-2 text-sm">
          <Camera size={14} /> Spustit focení
        </a>
      </div>

      {/* Gallery */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Images size={16} className="text-blue-500" />
          <h3 className="font-medium">Galerie Smart Capture</h3>
          <span className="text-xs text-muted-foreground ml-auto">posledních 50 relací</span>
        </div>
        <SessionGallery />
      </div>

      {/* Assistance level */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-blue-500" />
          <h3 className="font-medium">Úroveň AI asistence</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["minimal", "recommended", "full"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setField("assistance_level", lvl)}
              className={`px-3 py-3 rounded-lg border text-sm transition ${
                local.assistance_level === lvl
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border hover:bg-muted"
              }`}
            >
              {lvl === "minimal" && "Minimální"}
              {lvl === "recommended" && "Doporučená"}
              {lvl === "full" && "Plná asistence"}
            </button>
          ))}
        </div>
      </div>

      {/* Safe mode */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-amber-600" />
            <div>
              <div className="font-medium">Safe Mode</div>
              <p className="text-xs text-muted-foreground">Systém neprovádí žádné automatické úpravy, pouze doporučuje.</p>
            </div>
          </div>
          <Switch checked={!!local.safe_mode} onCheckedChange={(v) => setField("safe_mode", v)} />
        </div>
      </div>

      {/* Dealer Mode */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera size={18} className="text-blue-500" />
            <div>
              <div className="font-medium">Dealer Mode</div>
              <p className="text-xs text-muted-foreground">Udržuje každé vozidlo v identickém měřítku a kompozici.</p>
            </div>
          </div>
          <Switch checked={!!local.dealer_mode} onCheckedChange={(v) => setField("dealer_mode", v)} />
        </div>
      </div>

      {/* Features grid */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon size={16} />
          <h3 className="font-medium">Funkce systému</h3>
          <span className="text-xs text-muted-foreground ml-auto">Zapnuto / Pouze doporučit / Vypnuto</span>
        </div>
        <div className="space-y-2">
          {FEATURES.map((f) => {
            const val = (local[f.key] as Tri) ?? "on";
            return (
              <div key={f.key} className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
                <div className="text-sm">{f.label}</div>
                <div className="flex gap-1 shrink-0">
                  {(["on", "suggest", "off"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setField(f.key, mode)}
                      className={`px-2.5 py-1 rounded text-xs transition ${
                        val === mode
                          ? mode === "on"
                            ? "bg-emerald-500 text-white"
                            : mode === "suggest"
                              ? "bg-blue-500 text-white"
                              : "bg-muted-foreground text-background"
                          : "bg-muted hover:bg-muted/70 text-muted-foreground"
                      }`}
                    >
                      {mode === "on" ? "✓" : mode === "suggest" ? "≈" : "✕"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-end gap-2">
        <Button onClick={save} disabled={update.isPending} className="shadow-lg">
          {update.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
          Uložit nastavení
        </Button>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        🛡️ Smart Capture pracuje izolovaně. Existující inzeráty ani galerie nejsou nikdy automaticky upravovány.
      </div>
    </div>
  );
}

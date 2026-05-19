import { useState, useEffect } from "react";
import { Camera, Shield, Sparkles, Loader2, Settings as SettingsIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useSmartCaptureSettings, useUpdateSmartCaptureSettings } from "@/hooks/useSmartCapture";
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
];

export default function SmartCaptureSettingsTab() {
  const { data: settings, isLoading } = useSmartCaptureSettings();
  const update = useUpdateSmartCaptureSettings();
  const { toast } = useToast();
  const [local, setLocal] = useState<Record<string, unknown>>({});

  useEffect(() => { if (settings) setLocal(settings as Record<string, unknown>); }, [settings]);

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

  if (isLoading) return <div className="p-6 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Načítám…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
          <Camera size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-light">Smart Capture</h2>
          <p className="text-sm text-muted-foreground">Inteligentní focení vozidel s AI asistencí.</p>
        </div>
      </div>

      {/* Assistance level */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-blue-500" />
          <h3 className="font-medium">Úroveň AI asistence</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["minimal", "recommended", "full"] as const).map((lvl) => (
            <button key={lvl}
              onClick={() => setField("assistance_level", lvl)}
              className={`px-3 py-3 rounded-lg border text-sm transition ${
                local.assistance_level === lvl
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border hover:bg-muted"
              }`}>
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
                    <button key={mode}
                      onClick={() => setField(f.key, mode)}
                      className={`px-2.5 py-1 rounded text-xs transition ${
                        val === mode
                          ? mode === "on" ? "bg-emerald-500 text-white"
                            : mode === "suggest" ? "bg-blue-500 text-white"
                            : "bg-muted-foreground text-background"
                          : "bg-muted hover:bg-muted/70 text-muted-foreground"
                      }`}>
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

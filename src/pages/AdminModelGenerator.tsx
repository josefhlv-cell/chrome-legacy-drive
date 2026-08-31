/**
 * /admin/3d-generator — generátor 3D modelu konkrétního vozu z fotek.
 *
 * Tok: výběr vozu → 16 fotek → AI analýza vzhledu → ruční doladění
 *      → export GLB do úložiště → volitelně zapnout pro AR na detailu vozu.
 *
 * Geometrie se nemodeluje — používá se základní model Pacifiky a přenáší se
 * na něj VZHLED konkrétního vozu (lak, skla, lišty, kola, poškození).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Camera, CheckCircle2, ChevronRight, Download, Info, Loader2,
  Plus, RefreshCw, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import type * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  GROUP_LABELS, PHOTO_SLOTS, REQUIRED_SLOT_IDS, type SlotGroup,
} from "@/features/model-generator/photoSlots";
import { preparePhoto, type ValidationIssue } from "@/features/model-generator/photoUpload";
import {
  DAMAGE_PARTS, DEFAULT_PROFILE, TRIM_LABELS, WHEEL_STYLES, isHex,
  type AppearanceProfile, type Damage,
} from "@/features/model-generator/appearance";
import { exportGLB, exportUSDZ, compressGLBInWorker } from "@/features/model-generator/glbBuilder";
import type { CompressProgress } from "@/features/model-generator/compressPipeline";
import ModelPreview from "@/features/model-generator/ModelPreview";
import { colorNameToHex } from "@/features/model-generator/colorNames";

type VehicleRow = { id: string; name: string; vin: string | null; ar_model_ready: boolean | null; ar_model_url: string | null; color: string | null; ar_color_hex: string | null };

type SlotState = {
  previewUrl: string;
  path?: string;
  uploading: boolean;
  issues: ValidationIssue[];
};

const GROUPS: SlotGroup[] = ["exterior", "detail", "interior"];

/**
 * Do jakých slotů se plní fotky z karty vozu.
 *
 * Proč pevné pořadí: v galerii vozu jsou fotky řazené jako v inzerátu
 * (katalogový 3/4 pohled, bok, zadek, detaily, interiér). Tímto pořadím
 * se první snímky dostanou do slotů, které analýza vzhledu skutečně čte
 * (`ext_45_left`, `ext_90_left`, `ext_180`, `detail_wheel`, `detail_window`,
 * `int_front`) — obsluha tedy nemusí nahrávat nic ručně.
 */
const CARD_SLOT_ORDER = [
  "ext_45_left", "ext_90_left", "ext_180", "ext_0",
  "detail_wheel", "detail_window", "int_front",
  "ext_135_left", "ext_225_right", "ext_270_right", "ext_315_right",
  "detail_grille", "detail_damage", "int_rear", "int_wheel", "int_cargo",
];

export default function AdminModelGenerator() {
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading } = useAuth() as {
    user: unknown; isAdmin?: boolean; loading?: boolean;
  };

  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [profile, setProfile] = useState<AppearanceProfile | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportStep, setExportStep] = useState<{ label: string; percent: number } | null>(null);
  const [glbSize, setGlbSize] = useState<number | null>(null);
  const [usdzSize, setUsdzSize] = useState<number | null>(null);
  const [vinLoading, setVinLoading] = useState(false);
  /** Automatické načtení z karty vozu — čeká, dokud nemáme řádek vozidla. */
  const [autoPending, setAutoPending] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const sceneRef = useRef<THREE.Group | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});


  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  /* ------------------------------------------------------------------ */
  /* Data                                                                */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, vin, ar_model_ready, ar_model_url, color, ar_color_hex")
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Vozy se nepodařilo načíst", description: error.message, variant: "destructive" });
        return;
      }
      setVehicles((data ?? []) as VehicleRow[]);
    })();
  }, [toast]);

  // Načtení existujícího profilu při přepnutí vozu.
  useEffect(() => {
    if (!vehicleId) {
      setProfile(null);
      setSlots({});
      setGlbSize(null);
      setAutoPending(false);
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from("vehicle_appearance_profiles")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();

      if (data) {
        setProfile({
          ...DEFAULT_PROFILE(vehicleId),
          ...(data as unknown as AppearanceProfile),
          damages: (data.damages as unknown as Damage[]) ?? [],
        });

        // Fotky už v úložišti — vytáhneme podepsané náhledy.
        const photos = (data.photos ?? {}) as Record<string, string>;
        const next: Record<string, SlotState> = {};
        await Promise.all(
          Object.entries(photos).map(async ([slot, path]) => {
            const { data: signed } = await supabase.storage
              .from("vehicle-photos")
              .createSignedUrl(path, 3600);
            next[slot] = { previewUrl: signed?.signedUrl ?? "", path, uploading: false, issues: [] };
          }),
        );
        setSlots(next);
        // Rozdělaný vůz už fotky má — nic nepřepisujeme.
        setAutoPending(Object.keys(next).length === 0);
      } else {
        setProfile(null);
        setSlots({});
        // Nový vůz: fotky i data z VIN si natáhneme sami.
        setAutoPending(true);
      }
      setGlbSize(null);
    })();
  }, [vehicleId]);


  /* ------------------------------------------------------------------ */
  /* Upload fotek                                                        */
  /* ------------------------------------------------------------------ */

  const uploadSlot = useCallback(
    async (slotId: string, file: File) => {
      if (!vehicleId) {
        toast({ title: "Nejdřív vyberte vozidlo", variant: "destructive" });
        return;
      }

      setSlots((prev) => ({
        ...prev,
        [slotId]: { previewUrl: prev[slotId]?.previewUrl ?? "", uploading: true, issues: [] },
      }));

      try {
        const prepared = await preparePhoto(file);
        const path = `${vehicleId}/${slotId}.jpg`;

        const { error } = await supabase.storage
          .from("vehicle-photos")
          .upload(path, prepared.blob, { upsert: true, contentType: "image/jpeg" });

        if (error) throw error;

        setSlots((prev) => ({
          ...prev,
          [slotId]: { previewUrl: prepared.previewUrl, path, uploading: false, issues: prepared.issues },
        }));
      } catch (e) {
        setSlots((prev) => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
        toast({
          title: "Fotku nelze použít",
          description: e instanceof Error ? e.message : "Neznámá chyba",
          variant: "destructive",
        });
      }
    },
    [toast, vehicleId],
  );

  /**
   * Načtení fotek přímo z karty vozu (galerie `vehicle_images`).
   *
   * Proč: obsluha už fotky do inzerátu nahrála — nutit ji fotit znovu 16×
   * do generátoru je zbytečná práce. Bereme je v pořadí z galerie a plníme
   * jimi sloty, které analýza vzhledu čte. Ruční doplnění dalších fotek
   * i poškození zůstává beze změny — cokoli tady admin přepíše, platí.
   */
  const importFromVehicleCard = useCallback(
    async (id: string): Promise<number> => {
      const { data, error } = await supabase
        .from("vehicle_images")
        .select("image_url, is_main, sort_order")
        .eq("vehicle_id", id)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true });

      if (error) {
        toast({ title: "Fotky z karty vozu se nepodařilo načíst", description: error.message, variant: "destructive" });
        return 0;
      }

      const urls = (data ?? [])
        .map((row) => (row.image_url ?? "").trim())
        .filter((url) => /^https?:\/\//.test(url));

      if (!urls.length) return 0;

      // Ruční fotky admina mají přednost — plníme jen prázdné sloty.
      const targets = CARD_SLOT_ORDER.filter((slotId) => !slots[slotId]?.path);
      const total = Math.min(urls.length, targets.length);

      let loaded = 0;
      for (let i = 0; i < total; i++) {
        setImporting(`Načítám fotku ${i + 1}/${total} z karty vozu…`);
        try {
          const response = await fetch(urls[i], { mode: "cors" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const type = /^image\/(jpeg|png|webp)$/.test(blob.type) ? blob.type : "image/jpeg";
          await uploadSlot(targets[i], new File([blob], `${targets[i]}.jpg`, { type }));
          loaded++;
        } catch (e) {
          // Staré inzeráty mají mrtvé odkazy na legacy server — přeskočíme.
          console.warn("Fotku z karty vozu nelze použít:", urls[i], e);
        }
      }
      setImporting(null);
      return loaded;
    },
    [slots, toast, uploadSlot],
  );



  const removeSlot = async (slotId: string) => {
    const slot = slots[slotId];
    if (slot?.path) await supabase.storage.from("vehicle-photos").remove([slot.path]);
    setSlots((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  };

  /** Dávkový drop — fotky se doplní do prvních volných slotů. */
  const handleBatchDrop = async (files: File[]) => {
    const free = PHOTO_SLOTS.filter((s) => !slots[s.id]).map((s) => s.id);
    for (let i = 0; i < Math.min(files.length, free.length); i++) {
      await uploadSlot(free[i], files[i]);
    }
  };

  const uploadedPaths = useMemo(() => {
    const out: Record<string, string> = {};
    Object.entries(slots).forEach(([slot, state]) => {
      if (state.path) out[slot] = state.path;
    });
    return out;
  }, [slots]);

  const missingRequired = REQUIRED_SLOT_IDS.filter((id) => !uploadedPaths[id]);

  /* ------------------------------------------------------------------ */
  /* Analýza                                                             */
  /* ------------------------------------------------------------------ */

  const runAnalysis = async () => {
    if (!vehicleId) return;
    setAnalyzing(true);
    setAnalysisStep("Odesílám fotografie k analýze…");

    try {
      const { data, error } = await supabase.functions.invoke("vehicle-appearance-analyze", {
        body: { vehicleId, photos: uploadedPaths },
      });

      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

      const saved = (data as { profile: AppearanceProfile }).profile;
      setProfile({ ...DEFAULT_PROFILE(vehicleId), ...saved, damages: saved.damages ?? [] });
      setAnalysisStep("");

      const warnings = ((data as { analysis?: { warnings?: string[] } }).analysis?.warnings ?? []).slice(0, 3);
      toast({
        title: "Vzhled vozu rozpoznán",
        description: warnings.length ? warnings.join(" · ") : "Můžete doladit a exportovat model.",
      });
    } catch (e) {
      toast({
        title: "Analýza selhala",
        description: e instanceof Error ? e.message : "Neznámá chyba",
        variant: "destructive",
      });
      setAnalysisStep("");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Předvyplnění z VIN                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Odhad výbavy z VIN.
   *
   * Proč to má smysl: VIN spolehlivě prozradí ročník a výbavový stupeň
   * (Touring / Limited / Pinnacle / LX). Z toho vyplyne typ kol i to, zda
   * má vůz chromový nebo černý paket. Obsluha tak nezačíná od nuly —
   * jen zkontroluje a případně přepíše, což šetří minuty na každém vozu
   * a hlavně brání překlepům v datech, která zákazník uvidí v AR.
   */
  const prefillFromVin = async () => {
    if (!vehicle?.vin) {
      toast({ title: "Vozidlo nemá vyplněný VIN", variant: "destructive" });
      return;
    }

    setVinLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vin-decode", { body: { vin: vehicle.vin } });
      if (error) throw error;
      const decoded = (data as { decoded?: Record<string, string | number> }).decoded;
      if (!decoded) throw new Error("VIN se nepodařilo dekódovat");

      const trim = String(decoded.trim ?? "").toLowerCase();
      const wheel =
        /pinnacle|limited/.test(trim) ? "10spoke"
        : /touring|s appearance|sport/.test(trim) ? "multispoke"
        : /lx|base|voyager/.test(trim) ? "steel_cover"
        : "5spoke";
      const trimStyle: AppearanceProfile["trim_style"] =
        /s appearance|blackout|sport/.test(trim) ? "black" : "chrome";

      const summary = [decoded.year, decoded.name, decoded.engine, decoded.drive]
        .filter(Boolean)
        .join(" · ");

      /*
       * VIN barvu neobsahuje, proto ji bereme z karty vozu (ar_color_hex má
       * přednost, jinak převedeme český název barvy). Bez toho zůstal model
       * po předvyplnění vždy bílý.
       */
      const colorHex =
        colorNameToHex(vehicle.ar_color_hex) ?? colorNameToHex(vehicle.color);

      setProfile((prev) => {
        const base = prev ?? DEFAULT_PROFILE(vehicleId);
        return {
          ...base,
          body_color_hex: colorHex ?? base.body_color_hex,
          wheel_style: wheel,
          trim_style: trimStyle,
          notes: summary,
        };
      });

      toast({
        title: "Předvyplněno z VIN",
        description:
          [summary, colorHex ? `lak ${vehicle.color ?? colorHex}` : "barvu vozu doplňte ručně"]
            .filter(Boolean)
            .join(" · "),
      });
    } catch (e) {
      toast({
        title: "Dekódování VIN selhalo",
        description: e instanceof Error ? e.message : "Neznámá chyba",
        variant: "destructive",
      });
    } finally {
      setVinLoading(false);
    }
  };

  /**
   * Automatický start: fotky z karty vozu + předvyplnění z VIN.
   *
   * Obsluha tak po výběru vozu vidí hotový základ (lak z karty, kola a paket
   * z VIN, fotky z inzerátu) a jen doladí, co chce. Když fotky ani VIN nejsou,
   * vychází se z dostupných dat — profil se vytvoří z barvy na kartě vozu.
   */
  useEffect(() => {
    if (!autoPending || !vehicle) return;
    setAutoPending(false);

    void (async () => {
      const loaded = await importFromVehicleCard(vehicle.id);

      if (vehicle.vin) {
        await prefillFromVin();
      } else {
        const colorHex = colorNameToHex(vehicle.ar_color_hex) ?? colorNameToHex(vehicle.color);
        setProfile((prev) => ({
          ...(prev ?? DEFAULT_PROFILE(vehicle.id)),
          body_color_hex: colorHex ?? DEFAULT_PROFILE(vehicle.id).body_color_hex,
        }));
      }

      toast({
        title: loaded ? `Načteno z karty vozu (${loaded} fotek)` : "Karta vozu nemá použitelné fotky",
        description: loaded
          ? "Zkontrolujte údaje, případně doplňte fotky a poškození."
          : "Vycházíme z dostupných dat — fotky můžete doplnit ručně.",
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPending, vehicle?.id]);


  /* ------------------------------------------------------------------ */
  /* Úpravy profilu                                                      */
  /* ------------------------------------------------------------------ */

  const patch = (values: Partial<AppearanceProfile>) =>
    setProfile((prev) => (prev ? { ...prev, ...values } : prev));

  const saveProfile = async () => {
    if (!profile) return;
    const { error } = await supabase.from("vehicle_appearance_profiles").upsert(
      {
        vehicle_id: profile.vehicle_id,
        body_color_hex: profile.body_color_hex,
        paint_finish: profile.paint_finish,
        clearcoat: profile.clearcoat,
        roughness: profile.roughness,
        glass_opacity: profile.glass_opacity,
        trim_style: profile.trim_style,
        wheel_style: profile.wheel_style,
        wheel_condition: profile.wheel_condition ?? null,
        damages: profile.damages as unknown as never,
        interior_color_hex: profile.interior_color_hex ?? null,
        photos: uploadedPaths as unknown as never,
        status: "tuned",
      },
      { onConflict: "vehicle_id" },
    );

    if (error) {
      toast({ title: "Uložení selhalo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nastavení vzhledu uloženo" });
  };

  /* ------------------------------------------------------------------ */
  /* Export GLB                                                          */
  /* ------------------------------------------------------------------ */

  const exportAndUpload = async (publish: boolean) => {
    if (!profile || !sceneRef.current) {
      toast({ title: "Náhled ještě není hotový", variant: "destructive" });
      return;
    }

    setExporting(true);
    setExportStep({ label: "Exportuji GLB…", percent: 5 });
    try {
      // 1) GLB pro Android a desktopový 3D náhled.
      const raw = await exportGLB(sceneRef.current);

      // Komprese běží ve Web Workeru — admin UI proto zůstane plynulé.
      const blob = await compressGLBInWorker(raw, (p: CompressProgress) =>
        setExportStep({ label: p.label, percent: Math.round(p.percent * 0.7) }),
      );
      setGlbSize(blob.size);

      const path = `${profile.vehicle_id}/vehicle.glb`;
      setExportStep({ label: "Nahrávám GLB do úložiště…", percent: 74 });
      const { error: upErr } = await supabase.storage
        .from("vehicle-models")
        .upload(path, blob, { upsert: true, contentType: "model/gltf-binary" });
      if (upErr) throw upErr;

      /*
       * 2) USDZ pro iPhone (AR Quick Look).
       *
       * iOS neumí GLB — bez USDZ by zákazník na iPhonu viděl generický bílý
       * model, ne svůj vůz. Když by export selhal, GLB zůstává publikované
       * (Android funguje) a jen ohlásíme, že iOS model chybí.
       */
      let usdzPath: string | null = null;
      try {
        setExportStep({ label: "Exportuji USDZ pro iPhone…", percent: 82 });
        const usdz = await exportUSDZ(sceneRef.current);
        setUsdzSize(usdz.size);
        usdzPath = `${profile.vehicle_id}/vehicle.usdz`;
        setExportStep({ label: "Nahrávám USDZ do úložiště…", percent: 92 });
        const { error: usdzErr } = await supabase.storage
          .from("vehicle-models")
          .upload(usdzPath, usdz, { upsert: true, contentType: "model/vnd.usdz+zip" });
        if (usdzErr) throw usdzErr;
      } catch (e) {
        usdzPath = null;
        setUsdzSize(null);
        console.error("USDZ export selhal:", e);
        toast({
          title: "USDZ pro iPhone se nepodařilo vytvořit",
          description: "Android AR funguje, na iOS se zobrazí generický model.",
          variant: "destructive",
        });
      }

      setExportStep({ label: "Zapisuji do databáze…", percent: 97 });
      const { error: dbErr } = await supabase
        .from("vehicles")
        .update({
          ar_model_url: path,
          ar_model_usdz_url: usdzPath,
          ar_model_ready: publish,
          ar_color_hex: profile.body_color_hex,
        })
        .eq("id", profile.vehicle_id);
      if (dbErr) throw dbErr;

      await supabase
        .from("vehicle_appearance_profiles")
        .update({ status: publish ? "published" : "exported" })
        .eq("vehicle_id", profile.vehicle_id);

      setVehicles((prev) =>
        prev.map((v) => (v.id === profile.vehicle_id ? { ...v, ar_model_url: path, ar_model_ready: publish } : v)),
      );

      setExportStep({ label: "Hotovo", percent: 100 });
      toast({
        title: publish ? "Model publikován pro AR" : "Model uložen",
        description: `GLB ${(blob.size / 1024 / 1024).toFixed(1)} MB${usdzPath ? " · USDZ pro iPhone připraveno" : ""}`,
      });
    } catch (e) {
      toast({
        title: "Export selhal",
        description: e instanceof Error ? e.message : "Neznámá chyba",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
      setTimeout(() => setExportStep(null), 1500);
    }
  };

  const downloadGLB = async () => {
    if (!sceneRef.current) return;
    setExporting(true);
    try {
      const blob = await compressGLBInWorker(await exportGLB(sceneRef.current), (p) =>
        setExportStep({ label: p.label, percent: p.percent }),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${vehicle?.name?.replace(/\s+/g, "-").toLowerCase() ?? "vozidlo"}.glb`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || isAdmin === false) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="font-playfair text-2xl text-foreground">Přístup jen pro administrátora</h1>
          <Link to="/admin" className="mt-3 inline-block text-sm text-primary underline">
            Přihlásit se v adminu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-secondary/30">
        <div className="container mx-auto flex flex-wrap items-center gap-3 px-4 py-4">
          <Link to="/admin" className="outline-button inline-flex items-center gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Admin
          </Link>
          <div>
            <h1 className="font-playfair text-xl text-foreground">Generátor 3D modelu vozu</h1>
            <p className="text-xs text-muted-foreground">
              16 fotek → vzhled konkrétního vozu na 3D modelu → GLB pro AR
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6">
        {/* 1) Výběr vozu */}
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h2 className="mb-3 font-montserrat text-sm font-semibold uppercase tracking-wider text-foreground">
            1 · Vozidlo
          </h2>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">— vyberte vozidlo —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.vin ? ` · ${v.vin}` : ""}
                {v.ar_model_ready ? " · model publikován" : v.ar_model_url ? " · model uložen" : ""}
              </option>
            ))}
          </select>
        </section>

        {/* 2) Fotky */}
        {vehicleId && (
          <section
            className="rounded-xl border border-border/60 bg-card p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleBatchDrop(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
            }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-montserrat text-sm font-semibold uppercase tracking-wider text-foreground">
                2 · Fotografie ({Object.keys(uploadedPaths).length}/16)
              </h2>
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" /> Přetáhněte celou dávku sem
              </div>
            </div>

            {missingRequired.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <span>
                  Pro spolehlivou analýzu chybí:{" "}
                  {missingRequired
                    .map((id) => PHOTO_SLOTS.find((s) => s.id === id)?.label ?? id)
                    .join(", ")}
                  . Foťte za souvislé oblačnosti nebo v hale, auto čisté a celé v záběru.
                </span>
              </div>
            )}

            {GROUPS.map((group) => (
              <div key={group} className="mb-4">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">{GROUP_LABELS[group]}</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PHOTO_SLOTS.filter((s) => s.group === group).map((slot) => {
                    const state = slots[slot.id];
                    return (
                      <div
                        key={slot.id}
                        className={`relative overflow-hidden rounded-lg border ${
                          state?.path ? "border-primary/40" : "border-dashed border-border/60"
                        } bg-secondary/30`}
                      >
                        <input
                          ref={(el) => { fileInputs.current[slot.id] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void uploadSlot(slot.id, file);
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => fileInputs.current[slot.id]?.click()}
                          className="block w-full text-left"
                        >
                          <div className="grid aspect-[4/3] place-items-center overflow-hidden">
                            {state?.previewUrl ? (
                              <img src={state.previewUrl} alt={slot.label} className="h-full w-full object-cover" />
                            ) : state?.uploading ? (
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : (
                              <Plus className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="p-2">
                            <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                              {slot.label}
                              {slot.required && <span className="text-primary">*</span>}
                            </div>
                            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{slot.hint}</div>
                            {state?.issues.map((issue) => (
                              <div key={issue.message} className="mt-1 text-[10px] text-amber-600">
                                {issue.message}
                              </div>
                            ))}
                          </div>
                        </button>

                        {state?.path && (
                          <button
                            type="button"
                            onClick={() => void removeSlot(slot.id)}
                            className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                            aria-label={`Odebrat fotku ${slot.label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={analyzing || Object.keys(uploadedPaths).length === 0}
                className="chrome-button inline-flex items-center gap-2 text-xs disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {analyzing ? analysisStep || "Analyzuji…" : "3 · Analyzovat vzhled vozu"}
              </button>

              <button
                type="button"
                onClick={() => void prefillFromVin()}
                disabled={vinLoading || !vehicle?.vin}
                title={vehicle?.vin ? `VIN ${vehicle.vin}` : "Vozidlo nemá VIN"}
                className="outline-button inline-flex items-center gap-2 text-xs disabled:opacity-50"
              >
                {vinLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Info className="h-3.5 w-3.5" />}
                Předvyplnit z VIN
              </button>

              <button
                type="button"
                onClick={() => void importFromVehicleCard(vehicleId)}
                disabled={!!importing}
                className="outline-button inline-flex items-center gap-2 text-xs disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                Načíst fotky z karty vozu
              </button>
            </div>

            {importing && (
              <p className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                {importing}
              </p>
            )}

          </section>
        )}

        {/* 4) Ladění + náhled */}
        {profile && (
          <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <h2 className="mb-3 font-montserrat text-sm font-semibold uppercase tracking-wider text-foreground">
                4 · Náhled modelu
              </h2>
              <div className="h-[420px]">
                <ModelPreview
                  profile={profile}
                  onSceneReady={(scene) => {
                    sceneRef.current = scene;
                  }}
                />
              </div>
              {exportStep && (
                <div className="mt-3" role="status" aria-live="polite">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{exportStep.label}</span>
                    <span>{exportStep.percent} %</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${exportStep.percent}%` }}
                    />
                  </div>
                </div>
              )}
              {(glbSize !== null || usdzSize !== null) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Poslední export:
                  {glbSize !== null ? ` GLB ${(glbSize / 1024 / 1024).toFixed(1)} MB` : ""}
                  {usdzSize !== null ? ` · USDZ ${(usdzSize / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
              )}

            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
              <h2 className="font-montserrat text-sm font-semibold uppercase tracking-wider text-foreground">
                5 · Doladění
              </h2>

              <label className="block text-xs text-muted-foreground">
                Barva laku
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={isHex(profile.body_color_hex) ? profile.body_color_hex : "#e9eaec"}
                    onChange={(e) => patch({ body_color_hex: e.target.value })}
                    className="h-9 w-12 rounded border border-border bg-background"
                  />
                  <input
                    type="text"
                    value={profile.body_color_hex}
                    onChange={(e) => patch({ body_color_hex: e.target.value })}
                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
              </label>

              <label className="block text-xs text-muted-foreground">
                Typ laku
                <select
                  value={profile.paint_finish}
                  onChange={(e) => patch({ paint_finish: e.target.value as AppearanceProfile["paint_finish"] })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="solid">Nemetalický</option>
                  <option value="metallic">Metalíza</option>
                  <option value="pearl">Perleť</option>
                  <option value="matte">Matný</option>
                </select>
              </label>

              <label className="block text-xs text-muted-foreground">
                Tmavost skel — {Math.round(profile.glass_opacity * 100)} %
                <input
                  type="range"
                  min={20}
                  max={90}
                  value={Math.round(profile.glass_opacity * 100)}
                  onChange={(e) => patch({ glass_opacity: Number(e.target.value) / 100 })}
                  className="mt-1 w-full"
                />
              </label>

              <label className="block text-xs text-muted-foreground">
                Lesk laku — {Math.round(profile.clearcoat * 100)} %
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(profile.clearcoat * 100)}
                  onChange={(e) => patch({ clearcoat: Number(e.target.value) / 100 })}
                  className="mt-1 w-full"
                />
              </label>

              <label className="block text-xs text-muted-foreground">
                Lišty a mřížka
                <select
                  value={profile.trim_style}
                  onChange={(e) => patch({ trim_style: e.target.value as AppearanceProfile["trim_style"] })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  {Object.entries(TRIM_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-muted-foreground">
                Kola
                <select
                  value={profile.wheel_style}
                  onChange={(e) => patch({ wheel_style: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  {WHEEL_STYLES.map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
                {profile.wheel_condition && (
                  <span className="mt-1 block text-[11px] text-muted-foreground">{profile.wheel_condition}</span>
                )}
              </label>

              {/* Poškození */}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Poškození ({profile.damages.length})</div>
                <div className="space-y-2">
                  {profile.damages.map((damage, index) => (
                    <div key={`${damage.part}-${index}`} className="rounded-lg border border-border/60 p-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={damage.part}
                          onChange={(e) => {
                            const next = [...profile.damages];
                            next[index] = { ...damage, part: e.target.value };
                            patch({ damages: next });
                          }}
                          className="flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
                        >
                          {DAMAGE_PARTS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                        <select
                          value={damage.severity}
                          onChange={(e) => {
                            const next = [...profile.damages];
                            next[index] = { ...damage, severity: e.target.value };
                            patch({ damages: next });
                          }}
                          className="rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
                        >
                          <option value="lehke">lehké</option>
                          <option value="stredni">střední</option>
                          <option value="vyrazne">výrazné</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => patch({ damages: profile.damages.filter((_, i) => i !== index) })}
                          className="rounded p-1 text-destructive"
                          aria-label="Odebrat poškození"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {damage.note && (
                        <div className="mt-1 text-[11px] text-muted-foreground">{damage.note}</div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      damages: [...profile.damages, { part: "dvere_levo", type: "skrabanec", severity: "lehke" }],
                    })
                  }
                  className="outline-button mt-2 inline-flex items-center gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Přidat poškození
                </button>
              </div>

              {/* Akce */}
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                <button type="button" onClick={() => void saveProfile()} className="outline-button inline-flex items-center gap-1.5 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Uložit nastavení
                </button>
                <button
                  type="button"
                  onClick={() => void exportAndUpload(false)}
                  disabled={exporting}
                  className="outline-button inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Exportovat GLB
                </button>
                <button
                  type="button"
                  onClick={() => void exportAndUpload(true)}
                  disabled={exporting}
                  className="chrome-button inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Publikovat pro AR
                </button>
                <button
                  type="button"
                  onClick={() => void downloadGLB()}
                  disabled={exporting}
                  className="outline-button inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Stáhnout
                </button>
                {vehicle && (
                  <Link
                    to={`/vozidla/${vehicle.id}?ar=1`}
                    className="outline-button inline-flex items-center gap-1.5 text-xs"
                  >
                    <Camera className="h-3.5 w-3.5" /> Test v AR <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * VehicleARButton — AR náhled KONKRÉTNÍHO vozu z nabídky.
 *
 * Proč existuje:
 *  - `ARPreviewButton` je generický (bílá Pacifica z prohlídky). Zákazník ale
 *    chce vidět „svoje“ auto — tedy model v barvě vozu, který si prohlíží.
 *
 * Důležitá omezení, která tady řešíme:
 *  1) Máme jediný 3D model — Chrysler Pacifica. Kdybychom tlačítko zobrazili
 *     u Voyageru nebo Town & Country, zákazník by v AR viděl JINÉ auto.
 *     Proto se tlačítko renderuje pouze u vozů, jejichž název obsahuje
 *     „Pacifica“ (viz `MODEL_SUPPORTED`).
 *  2) iOS AR Quick Look neumí barvu modelu měnit za běhu (USDZ je statický).
 *     Barva se proto aplikuje na Androidu a v desktopovém 3D náhledu;
 *     na iPhonu jde o ilustrační vůz a uživatele na to upozorníme.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useVehicle } from "@/hooks/useVehicles";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";
import ARPreviewButton from "./ARPreviewButton";
import {
  resolveVehicleModel,
  type VehicleModelSource,
} from "./pacificaModels";


/** Fallback, když vůz nemá vyplněné `ar_color_hex` — perleťově bílá. */
const DEFAULT_AR_COLOR = "#e9eaec";

/** iOS (včetně iPadOS 13+, které se hlásí jako Mac s touchem). */
const isIOSDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)
  );
};

/** Jediný model, který máme k dispozici ve 3D/AR. */
const isModelSupported = (name?: string | null): boolean =>
  !!name && /pacifica/i.test(name);

/** Ochrana proti neplatné hodnotě z DB (ručně přepsané pole v adminu). */
const normalizeHex = (value?: string | null): string | null => {
  if (!value) return null;
  const hex = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
};

type Props = {
  /** ID vozidla z tabulky `vehicles`. */
  vehicleId: string;
  /**
   * Vůz už načtený nadřazenou stránkou. Ušetří duplicitní dotaz, ale není
   * povinný — bez něj si komponenta data dotáhne sama (React Query cache).
   */
  vehicleName?: string | null;
  vehicleColorHex?: string | null;
  className?: string;
};

export const VehicleARButton = ({
  vehicleId,
  vehicleName,
  vehicleColorHex,
  className,
}: Props) => {
  // Pokud rodič data předal, dotaz vůbec nespouštíme (enabled: false uvnitř
  // hooku by rozbil ostatní volání, proto řešíme přes `skip`).
  const [searchParams] = useSearchParams();
  // Deep-link z QR kódu (?ar=1) spustí AR hned po otevření detailu.
  const autoStart = searchParams.get("ar") === "1";

  const skip = Boolean(vehicleName);
  const { data, isLoading, error } = useVehicle(skip ? undefined : vehicleId);
  // Admin může funkci kdykoli vypnout (site_contacts → feature_vehicle_ar_enabled).
  const arEnabled = useFeatureFlag("feature_vehicle_ar_enabled");

  /**
   * Modely konkrétního vozu. `resolveVehicleModel` řeší prioritu
   * (vlastní model → model z 3D generátoru → HQ Pacifica master),
   * takže tady jen posbíráme dostupné odkazy.
   */
  const [source, setSource] = useState<VehicleModelSource | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setSourceLoading(true);
    setSourceError(false);

    void (async () => {
      const { data: row, error: modelError } = await supabase
        .from("vehicles")
        .select(
          "ar_model_url, ar_model_usdz_url, ar_model_ready, ar_model_config, model_3d_glb, model_3d_usdz",
        )
        .eq("id", vehicleId)
        .maybeSingle();

      if (cancelled) return;
      if (modelError || !row) {
        console.error("Model konkrétního vozidla se nepodařilo načíst:", modelError);
        setSourceError(true);
        setSourceLoading(false);
        return;
      }

      const record = row as
        | {
            ar_model_url?: string | null;
            ar_model_usdz_url?: string | null;
            ar_model_ready?: boolean | null;
            ar_model_config?: unknown;
            model_3d_glb?: string | null;
            model_3d_usdz?: string | null;
          }
        | null;

      /*
       * 1) Vlastní model konkrétního vozu — přímá URL projektového assetu
       *    nebo odkaz `variant:<key>` na variantu z registru. Nic se
       *    nepřevádí ani neoptimalizuje, jde přímo do AR.
       */
      const ownGlb = record?.model_3d_glb?.trim() || null;
      const ownUsdz = record?.model_3d_usdz?.trim() || null;

      /*
       * 2) Model vygenerovaný v /admin/3d-generator. Oba formáty leží v
       *    privátním bucketu a veřejná funkce `ar-model` je bezpečně doručí
       *    zákazníkům. Přímé podepisování z anonymního klienta by storage RLS
       *    správně odmítlo a dříve tím aktivovalo HQ fallback.
       */
      const ready = Boolean(record?.ar_model_ready);
      const path = ready ? record?.ar_model_url ?? null : null;
      const usdz = ready ? record?.ar_model_usdz_url ?? null : null;

      const generatedUsdz = usdz
        ? `https://thqyzghifwmwohgfvshf.supabase.co/functions/v1/ar-model/v/${usdz}`
        : null;
      const generatedGlb = path
        ? `https://thqyzghifwmwohgfvshf.supabase.co/functions/v1/ar-model/v/${path}`
        : null;

      if (!path || ownGlb) {
        /*
         * Přímý model má absolutní prioritu. Je-li z přímé dvojice dostupný
         * jen GLB nebo USDZ, druhý formát smí doplnit publikovaná revize
         * stejného vehicle_id — nikdy HQ fallback.
         */
        setSource(resolveVehicleModel({
          ownGlb,
          ownUsdz,
          generatedGlb,
          generatedUsdz,
        }));
        setSourceLoading(false);
        return;
      }

      if (!cancelled) {
        setSource(
          resolveVehicleModel({
            ownGlb,
            ownUsdz,
            generatedGlb,
            generatedUsdz,
          }),
        );
        setSourceLoading(false);
      }
    })().catch((modelError: unknown) => {
      if (cancelled) return;
      console.error("Model konkrétního vozidla se nepodařilo připravit:", modelError);
      setSourceError(true);
      setSourceLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [vehicleId]);




  const name = vehicleName ?? data?.name ?? null;
  const colorHex =
    normalizeHex(vehicleColorHex ?? (data as { ar_color_hex?: string | null } | null)?.ar_color_hex) ??
    DEFAULT_AR_COLOR;

  if (!arEnabled) return null;

  /* Dokud neznáme skutečný zdroj vozidla, tlačítko nesmí dostat HQ fallback. */
  if (sourceLoading) {
    return (
      <div
        className={`inline-flex h-11 items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 text-xs text-muted-foreground ${className ?? ""}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Ověřuji model tohoto vozu…
      </div>
    );
  }

  if (sourceError || !source) {
    return (
      <div
        className={`inline-flex h-11 items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 text-xs text-destructive ${className ?? ""}`}
        role="alert"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        AR model vozu se nepodařilo ověřit
      </div>
    );
  }

  if (!skip && isLoading) {
    return (
      <div
        className={`inline-flex h-11 items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 text-xs text-muted-foreground ${className ?? ""}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Načítáme AR náhled…
      </div>
    );
  }

  if (!skip && (error || !data)) {
    return (
      <div
        className={`inline-flex h-11 items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 text-xs text-destructive ${className ?? ""}`}
        role="alert"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        AR náhled se nepodařilo načíst
      </div>
    );
  }

  /*
   * Model vlastního vozu má vždy přednost. Bez něj zobrazíme generickou
   * Pacificu — a to jen u vozů Pacifica, ať zákazníkovi v AR nepostavíme
   * úplně jiné auto.
   */
  if (!source?.isVehicleSpecific && !isModelSupported(name)) return null;

  /*
   * iPhone/iPad umí jen USDZ. Když u vozu vlastní iOS verze (ještě) není,
   * NEZOBRAZUJEME slepou hlášku — zákazník na iPhonu by tak AR neviděl vůbec.
   * Místo toho pustíme AR s referenčním modelem Pacifiky a jasně řekneme, že
   * jde o ilustrační vůz (barva a výbava se mohou lišit).
   */
  const iosNeedsFallback = isIOSDevice() && Boolean(source?.isVehicleSpecific) && !source?.usdz;
  if (iosNeedsFallback && !isModelSupported(name)) {
    return (
      <div
        className={`inline-flex h-11 items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 text-xs text-muted-foreground ${className ?? ""}`}
        role="status"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        AR tohoto vozu je dostupné na Androidu a počítači
      </div>
    );
  }

  return (
    <div className={className}>
      <ARPreviewButton
        variant="pill"
        label="Postavit vůz k sobě (AR)"
        colorHex={colorHex}
        colorKey={colorHex}
        vehicleId={vehicleId}
        vehicleName={name ?? undefined}
        showColorDisclaimer={!source?.isVehicleSpecific || iosNeedsFallback}
        autoStart={autoStart}
        modelUrl={source?.glb ?? null}
        usdzUrl={source?.usdz ?? (iosNeedsFallback ? PACIFICA_HQ_USDZ : null)}
        allowModelFallback={false}
      />
    </div>
  );


};

export default VehicleARButton;

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
import { AlertTriangle, Loader2 } from "lucide-react";
import { useVehicle } from "@/hooks/useVehicles";
import ARPreviewButton from "./ARPreviewButton";

/** Fallback, když vůz nemá vyplněné `ar_color_hex` — perleťově bílá. */
const DEFAULT_AR_COLOR = "#e9eaec";

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
  const skip = Boolean(vehicleName);
  const { data, isLoading, error } = useVehicle(skip ? undefined : vehicleId);

  const name = vehicleName ?? data?.name ?? null;
  const colorHex =
    normalizeHex(vehicleColorHex ?? (data as { ar_color_hex?: string | null } | null)?.ar_color_hex) ??
    DEFAULT_AR_COLOR;

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

  // Vůz, pro který 3D model nemáme — tlačítko radši neukazujeme,
  // než abychom zákazníkovi v AR postavili jiný model.
  if (!isModelSupported(name)) return null;

  return (
    <div className={className}>
      <ARPreviewButton
        variant="pill"
        label="Postavit vůz k sobě (AR)"
        colorHex={colorHex}
        colorKey={colorHex}
        vehicleId={vehicleId}
        vehicleName={name ?? undefined}
        showColorDisclaimer
      />
    </div>
  );
};

export default VehicleARButton;

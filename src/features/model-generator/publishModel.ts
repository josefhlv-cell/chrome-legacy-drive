/**
 * publishModel — JEDINÉ místo, kde se model konkrétního vozu exportuje,
 * nahrává do úložiště a propojuje s `vehicle_id`.
 *
 * PROČ EXISTUJE
 * -------------
 * Publikace se dřív odehrávala jen uvnitř admin stránky, takže:
 *  - nešlo modely připravit dávkově (zákazník viděl AR jen u vozů, které
 *    obsluha ručně proklikala),
 *  - a pád USDZ exportu shodil celou kartu prohlížeče.
 *
 * Tady je tok pevně daný a odolný:
 *  1) scéna se normalizuje na 1 unit = 1 m, vůz stojí na Y = 0,
 *  2) GLB se nahraje a HNED se zapíše vazba na vozidlo (přežije reload),
 *  3) USDZ pro iPhone je samostatný, izolovaný krok — jeho selhání
 *     publikaci nikdy nezruší.
 */
import type * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import {
  buildVehicleScene,
  compressGLBInWorker,
  exportGLB,
  exportUSDZ,
  prepareForExport,
} from "./glbBuilder";
import { DEFAULT_PROFILE, type AppearanceProfile } from "./appearance";
import { colorToPaint } from "./colorNames";
import { wheelFromTrim } from "./wheelCatalog";

export type PublishProgress = { label: string; percent: number };

export type PublishResult = {
  glbPath: string;
  usdzPath: string | null;
  glbSize: number;
  usdzSize: number | null;
  dimensions: { length: number; width: number; height: number };
};

/** Minimum, které potřebujeme z karty vozu pro automatické předvyplnění. */
export type VehicleSeed = {
  id: string;
  name?: string | null;
  color?: string | null;
  ar_color_hex?: string | null;
};

/**
 * Profil vzhledu odvozený POUZE z dat karty vozu (bez fotek a bez AI).
 *
 * Reálný dopad: každý vůz v nabídce může mít model připravený automaticky
 * v barvě z inzerátu a s koly podle výbavy. Admin to kdykoli přegeneruje
 * s vlastním doladěním — ruční profil má vždy přednost.
 */
export const profileFromVehicle = (vehicle: VehicleSeed): AppearanceProfile => {
  const paint =
    colorToPaint(vehicle.ar_color_hex) ??
    colorToPaint(vehicle.color) ??
    null;
  const wheel = wheelFromTrim(vehicle.name ?? "");
  const trimStyle: AppearanceProfile["trim_style"] = /s appearance|blackout|sport/i.test(
    vehicle.name ?? "",
  )
    ? "black"
    : "chrome";

  return {
    ...DEFAULT_PROFILE(vehicle.id),
    body_color_hex: paint?.hex ?? DEFAULT_PROFILE(vehicle.id).body_color_hex,
    paint_finish: paint?.finish ?? "metallic",
    wheel_style: wheel.id,
    trim_style: trimStyle,
  };
};

/**
 * Vyexportuje a publikuje model konkrétního vozu.
 *
 * @param scene Hotová scéna z admin náhledu. Když chybí, sestaví se z profilu
 *              (tuto cestu používá automatická dávková příprava).
 */
export async function publishVehicleModel(input: {
  profile: AppearanceProfile;
  scene?: THREE.Object3D | null;
  publish?: boolean;
  /** Když je false, USDZ se nezkouší (rychlá dávková příprava). */
  withUsdz?: boolean;
  onProgress?: (p: PublishProgress) => void;
  onUsdzError?: (error: unknown) => void;
}): Promise<PublishResult> {
  const { profile, publish = true, withUsdz = true, onProgress, onUsdzError } = input;
  const vehicleKey = profile.vehicle_id;
  const report = (label: string, percent: number) => onProgress?.({ label, percent });

  report("Připravuji model (měřítko 1:1)…", 4);
  const source = input.scene ?? (await buildVehicleScene(profile));
  const bundle = prepareForExport(source);

  let uploadedGlbPath: string | null = null;
  let uploadedUsdzPath: string | null = null;

  try {
    report("Exportuji GLB…", 8);
    const raw = await exportGLB(bundle.scene);
    const blob = await compressGLBInWorker(raw, (p) =>
      report(p.label, 10 + Math.round(p.percent * 0.5)),
    );

    /*
     * Každá publikace dostane novou revizi cesty — CDN ani model-viewer tak
     * nemohou po přegenerování vrátit předchozí binární obsah z cache.
     */
    const generatedAt = new Date().toISOString();
    const revision = `v-${Date.now().toString(36)}`;
    const path = `${vehicleKey}/${revision}/vehicle.glb`;

    report("Nahrávám GLB do úložiště…", 62);
    const { error: upErr } = await supabase.storage
      .from("vehicle-models")
      .upload(path, blob, { upsert: false, contentType: "model/gltf-binary" });
    if (upErr) throw upErr;
    uploadedGlbPath = path;

    report("Propojuji model s vozidlem…", 68);
    const { error: dbErr } = await supabase
      .from("vehicles")
      .update({
        ar_model_url: path,
        ar_model_ready: publish,
        ar_color_hex: profile.body_color_hex,
        ar_model_dimensions: bundle.dimensions as never,
        ar_model_config: {
          body_color_hex: profile.body_color_hex,
          paint_finish: profile.paint_finish,
          trim_style: profile.trim_style,
          wheel_style: profile.wheel_style,
          wheel_condition: profile.wheel_condition ?? null,
          interior_color_hex: profile.interior_color_hex ?? null,
          damages: profile.damages ?? [],
          generated_at: generatedAt,
          revision,
        } as never,
        // Starý USDZ nesmí zůstat — jinak iPhone ukáže předchozí verzi vozu.
        ar_model_usdz_url: null,
      })
      .eq("id", vehicleKey);
    if (dbErr) throw dbErr;
    uploadedGlbPath = null;

    /* USDZ pro iPhone — izolovaný krok, selhání publikaci nezruší. */
    let usdzPath: string | null = null;
    let usdzSize: number | null = null;
    if (withUsdz) {
      try {
        report("Exportuji USDZ pro iPhone…", 78);
        const usdz = await exportUSDZ(bundle.scene);
        usdzSize = usdz.size;
        const candidate = `${vehicleKey}/${revision}/vehicle.usdz`;

        report("Nahrávám USDZ do úložiště…", 90);
        const { error: usdzErr } = await supabase.storage
          .from("vehicle-models")
          .upload(candidate, usdz, { upsert: false, contentType: "model/vnd.usdz+zip" });
        if (usdzErr) throw usdzErr;
        uploadedUsdzPath = candidate;

        const { error: usdzDbErr } = await supabase
          .from("vehicles")
          .update({ ar_model_usdz_url: candidate })
          .eq("id", vehicleKey);
        if (usdzDbErr) throw usdzDbErr;
        uploadedUsdzPath = null;
        usdzPath = candidate;
      } catch (e) {
        if (uploadedUsdzPath) {
          await supabase.storage.from("vehicle-models").remove([uploadedUsdzPath]);
          uploadedUsdzPath = null;
        }
        usdzSize = null;
        console.error("USDZ export selhal:", e);
        onUsdzError?.(e);
      }
    }

    report("Zapisuji stav publikace…", 97);
    await supabase
      .from("vehicle_appearance_profiles")
      .upsert(
        {
          vehicle_id: vehicleKey,
          body_color_hex: profile.body_color_hex,
          paint_finish: profile.paint_finish,
          clearcoat: profile.clearcoat,
          roughness: profile.roughness,
          glass_opacity: profile.glass_opacity,
          trim_style: profile.trim_style,
          wheel_style: profile.wheel_style,
          wheel_condition: profile.wheel_condition ?? null,
          damages: (profile.damages ?? []) as unknown as never,
          interior_color_hex: profile.interior_color_hex ?? null,
          status: publish ? "published" : "exported",
        },
        { onConflict: "vehicle_id" },
      );

    report("Hotovo", 100);
    return {
      glbPath: path,
      usdzPath,
      glbSize: blob.size,
      usdzSize,
      dimensions: bundle.dimensions,
    };
  } catch (e) {
    /* Nově nahraný soubor nesmí zůstat v úložišti bez vazby (orphan). */
    const orphans = [uploadedGlbPath, uploadedUsdzPath].filter(
      (value): value is string => Boolean(value),
    );
    if (orphans.length > 0) {
      await supabase.storage.from("vehicle-models").remove(orphans);
    }
    throw e;
  } finally {
    bundle.dispose();
  }
}

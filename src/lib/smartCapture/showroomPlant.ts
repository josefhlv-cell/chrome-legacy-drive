/**
 * Když je ve Smart Capture zapnuté pozadí, vyřízne vůz (Remove.bg)
 * a zasadí ho na showroom pozadí. Při selhání AI spadne na jednoduché
 * složení celé fotky na pozadí (object-contain).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  composePhotoOnBackground,
  composeThumbnail,
  type ComposeOptions,
} from "./thumbnail";

const TEMP_BUCKET = "smart-capture";

async function uploadTemp(photo: Blob): Promise<{ path: string; publicUrl: string }> {
  const path = `tmp-plant/${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`;
  const { error } = await supabase.storage.from(TEMP_BUCKET).upload(path, photo, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  const publicUrl = supabase.storage.from(TEMP_BUCKET).getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}

async function removeBackgroundPng(imageUrl: string): Promise<Blob> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Nejste přihlášeni.");

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${base}/functions/v1/remove-background`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Výřez selhal (${res.status}): ${text.slice(0, 200)}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await res.json();
    throw new Error(json?.error || "Výřez selhal");
  }

  const png = await res.blob();
  if (!png.size || png.size < 1000) throw new Error("Prázdný výřez");
  return png;
}

async function cleanupTemp(path: string) {
  try {
    await supabase.storage.from(TEMP_BUCKET).remove([path]);
  } catch {
    // dočasný soubor — úklid je best-effort
  }
}

/**
 * AI výřez + zasazení na showroom. Volat jen když uživatel zapnul pozadí.
 * Při jakékoli chybě vrátí fallback (celá fotka na pozadí).
 */
export async function plantVehicleOnShowroom(
  photo: Blob,
  opts: ComposeOptions = {},
): Promise<Blob> {
  let tempPath: string | undefined;
  try {
    const { path, publicUrl } = await uploadTemp(photo);
    tempPath = path;
    const cutout = await removeBackgroundPng(publicUrl);
    return await composeThumbnail(cutout, opts);
  } catch {
    try {
      return await composePhotoOnBackground(photo);
    } catch {
      return photo;
    }
  } finally {
    if (tempPath) void cleanupTemp(tempPath);
  }
}

import { supabase } from "@/integrations/supabase/client";

/** Generate only: activation and original-photo edits are deliberately absent. */
export async function generateVehicleShowroom(imageId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("showroom-generate", {
    body: { imageId, force: false },
  });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const detail = await error.context.clone().json().catch(() => null);
      if (typeof detail?.error === "string") message = detail.error;
    }
    throw new Error(message || "Generování se nepodařilo dokončit.");
  }
  if (typeof data?.error === "string") throw new Error(data.error);
  if (typeof data?.showroom_url !== "string" || !data.showroom_url) {
    throw new Error("Generování nevrátilo upravenou fotografii. Obnovte stav před dalším pokusem.");
  }
  return data.showroom_url;
}
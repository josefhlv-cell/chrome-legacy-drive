// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { createAdminClient, runShowroom, type AdminClient } from "../_shared/showroomPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

async function assertAdmin(req: Request): Promise<AdminClient | Response> {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const admin = createAdminClient();
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden" }, 403);
  return admin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let imageId = "";
  try {
    const adminOrResponse = await assertAdmin(req);
    if (adminOrResponse instanceof Response) return adminOrResponse;
    const admin = adminOrResponse;

    const body = await req.json().catch(() => ({}));
    imageId = typeof body?.imageId === "string" ? body.imageId : "";
    const force = body?.force === true;
    // Manual admin override (scale / X / Y / rotation / shadow). Absent fields
    // fall back to the learned model profile, then the class profile.
    const placement = body?.placement && typeof body.placement === "object" ? body.placement : null;
    const saveAsDefault = body?.saveAsDefault === true;
    if (!imageId) return json({ error: "imageId required" }, 400);

    const result = await runShowroom(admin, imageId, force, placement);
    if (!result.ok) return json({ error: result.error, validation: result.validation }, result.status);

    // "Save as default for this model" — learned placement memory.
    if (saveAsDefault && result.placement) {
      const { data: img } = await admin
        .from("vehicle_images")
        .select("vehicle_id")
        .eq("id", imageId)
        .maybeSingle();
      const { data: vehicle } = await admin
        .from("vehicles")
        .select("name")
        .eq("id", (img as any)?.vehicle_id)
        .maybeSingle();
      const key = modelKey((vehicle as any)?.name ?? "");
      const p = result.placement;
      await admin.from("showroom_model_profiles").upsert({
        model_key: key,
        model_label: (vehicle as any)?.name ?? key,
        vehicle_class: result.vehicle_class,
        scale: p.scale,
        offset_x: p.offsetX,
        offset_y: p.offsetY,
        rotation_deg: p.rotationDeg,
        shadow_opacity: p.shadowOpacity,
        shadow_blur: p.shadowBlur,
        shadow_offset_y: p.shadowOffsetY,
        updated_at: new Date().toISOString(),
      }, { onConflict: "model_key" });
    }

    return json(result);

  } catch (e: any) {
    console.error("showroom-generate fatal:", e);
    return json({ error: e?.message ?? "Internal error", imageId }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

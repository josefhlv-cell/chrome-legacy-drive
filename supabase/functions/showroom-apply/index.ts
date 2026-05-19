// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return j({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user?.id) return j({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) return j({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: "apply" | "restore" | "restore_vehicle" = body?.action;
    const imageId: string = body?.imageId;
    const vehicleId: string = body?.vehicleId;
    if (!["apply", "restore", "restore_vehicle"].includes(action)) return j({ error: "Bad request" }, 400);

    if (action === "restore_vehicle") {
      if (!vehicleId) return j({ error: "vehicleId required" }, 400);
      const { data: rows } = await admin.from("vehicle_images")
        .select("id, image_url, original_backup_url, is_main")
        .eq("vehicle_id", vehicleId);
      for (const row of rows ?? []) {
        const restoredUrl = row.original_backup_url || row.image_url;
        await admin.from("vehicle_images").update({
          image_url: restoredUrl,
          original_backup_url: "",
          showroom_applied_at: null,
        }).eq("id", row.id);
        if (row.is_main) await admin.from("vehicles").update({ image_url: restoredUrl, showroom_mode: "off" }).eq("id", vehicleId);
      }
      return j({ ok: true, restored: rows?.length ?? 0 });
    }

    if (!imageId) return j({ error: "imageId required" }, 400);

    const { data: img } = await admin.from("vehicle_images")
      .select("id, vehicle_id, image_url, showroom_url, original_backup_url, is_main")
      .eq("id", imageId).maybeSingle();
    if (!img) return j({ error: "Not found" }, 404);

    if (action === "apply") {
      if (!img.showroom_url) return j({ error: "No showroom photo generated yet" }, 400);
      const backup = img.original_backup_url || img.image_url;
      await admin.from("vehicle_images").update({
        original_backup_url: backup,
        showroom_applied_at: new Date().toISOString(),
      }).eq("id", imageId);
      if (img.is_main) await admin.from("vehicles").update({ showroom_mode: "main" }).eq("id", img.vehicle_id);
      return j({ ok: true, image_url: img.showroom_url });
    }

    // restore
    if (!img.original_backup_url) return j({ error: "No backup to restore" }, 400);
    await admin.from("vehicle_images").update({
      image_url: img.original_backup_url,
      original_backup_url: "",
      showroom_applied_at: null,
    }).eq("id", imageId);
    if (img.is_main) {
      await admin.from("vehicles").update({ image_url: img.original_backup_url, showroom_mode: "off" }).eq("id", img.vehicle_id);
    }
    return j({ ok: true, image_url: img.original_backup_url });
  } catch (e: any) {
    return j({ error: e?.message ?? "Internal" }, 500);
  }
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

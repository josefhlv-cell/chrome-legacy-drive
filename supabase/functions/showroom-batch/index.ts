// deno-lint-ignore-file no-explicit-any
// Bulk showroom regeneration. Authorized only by an authenticated admin JWT.
// It regenerates composites but NEVER publishes them (showroom_applied_at
// is left untouched), so nothing changes on the public site.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { createAdminClient, runShowroom, isCurrentTemplate, type AdminClient } from "../_shared/showroomPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

async function authorize(req: Request): Promise<AdminClient | Response> {
  const admin = createAdminClient();

  // Internal automation (automatic cache invalidation / cron): shared token.
  const cronToken = Deno.env.get("SHOWROOM_CRON_TOKEN") ?? "";
  if (cronToken && req.headers.get("x-showroom-cron") === cronToken) return admin;

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return json({ error: "Unauthorized" }, 401);
  // Internal server-to-server invocation (cron / automatic cache invalidation).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && jwt === serviceKey) return admin;
  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "Unauthorized" }, 401);
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

  try {
    const adminOrResponse = await authorize(req);
    if (adminOrResponse instanceof Response) return adminOrResponse;
    const admin = adminOrResponse;

    // Bulk / automatic regeneration is intentionally disabled: showroom is
    // generated only manually, one primary photo at a time, via showroom-generate.
    void admin;
    return json({ ok: true, disabled: true, processed: 0, results: [], message: "Hromadné generování showroomu je vypnuto. Použijte showroom-generate pro titulní fotografii." });
  } catch (e: any) {
    console.error("showroom-batch fatal:", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

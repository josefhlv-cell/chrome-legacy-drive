// deno-lint-ignore-file no-explicit-any
// Bulk showroom regeneration. Authorized either by an admin JWT or by a
// one-off job token stored in `public.job_tokens` (service-role only table).
// It regenerates composites but NEVER publishes them (showroom_applied_at
// is left untouched), so nothing changes on the public site.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { createAdminClient, runShowroom, type AdminClient } from "../_shared/showroomPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-job-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

async function authorize(req: Request): Promise<AdminClient | Response> {
  const admin = createAdminClient();

  const jobToken = req.headers.get("x-job-token") || "";
  if (jobToken) {
    const { data } = await admin
      .from("job_tokens")
      .select("token")
      .eq("name", "showroom_batch")
      .maybeSingle();
    if ((data as any)?.token && (data as any).token === jobToken) return admin;
    return json({ error: "Unauthorized" }, 401);
  }

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

    const body = await req.json().catch(() => ({}));
    const imageIds: string[] = Array.isArray(body?.imageIds)
      ? body.imageIds.filter((v: unknown) => typeof v === "string").slice(0, 5)
      : [];
    const force = body?.force !== false;
    if (imageIds.length === 0) return json({ error: "imageIds required" }, 400);

    const results: Array<Record<string, unknown>> = [];
    for (const id of imageIds) {
      const r = await runShowroom(admin, id, force);
      results.push({ imageId: id, ...r });
    }

    return json({ ok: true, processed: results.length, results });
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

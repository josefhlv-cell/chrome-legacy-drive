// deno-lint-ignore-file no-explicit-any
// Pure background removal via Remove.bg. Returns transparent PNG.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMOVEBG_API_KEY = Deno.env.get("REMOVEBG_API_KEY")!;

async function assertAdmin(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data } = await userClient.auth.getUser();
  if (!data?.user?.id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  return admin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  if (!REMOVEBG_API_KEY) return new Response(JSON.stringify({ error: "REMOVEBG_API_KEY not configured" }), { status: 500, headers: corsHeaders });

  const admin = await assertAdmin(req);
  if (admin instanceof Response) return admin;

  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl: string | undefined = body?.imageUrl;
    if (!imageUrl) return new Response(JSON.stringify({ error: "imageUrl required" }), { status: 400, headers: corsHeaders });

    // Fetch source image
    const src = await fetch(imageUrl);
    if (!src.ok) return new Response(JSON.stringify({ error: `Source fetch failed (${src.status})` }), { status: 502, headers: corsHeaders });
    const srcBlob = await src.blob();

    // Call Remove.bg
    const form = new FormData();
    form.append("image_file", srcBlob, "car.jpg");
    form.append("size", "auto");
    form.append("format", "png");
    form.append("type", "car");

    const rb = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVEBG_API_KEY },
      body: form,
    });
    if (!rb.ok) {
      const err = await rb.text();
      return new Response(JSON.stringify({ error: `Remove.bg ${rb.status}: ${err}` }), { status: 502, headers: corsHeaders });
    }
    const png = new Uint8Array(await rb.arrayBuffer());

    return new Response(png, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: corsHeaders });
  }
});

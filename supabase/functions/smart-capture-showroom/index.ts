import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { editImage, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.11";
import type {} from "./ai-gateway.types.ts";
import { z } from "npm:zod@3";

const bodySchema = z.object({
  sessionId: z.string().uuid(), photoId: z.string().uuid(),
  shotType: z.literal("prava-predni"),
  imageBase64: z.string().min(20).max(14_000_000).regex(/^[A-Za-z0-9+/=]+$/),
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Použijte POST." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Služba není nakonfigurovaná." }, 503);
    const client = createClient(url, key);
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Přihlaste se." }, 401);
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (!user || authError) return json({ error: "Přihlášení není platné." }, 401);
    const { data: role, error: roleError } = await client.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role || roleError) return json({ error: "Pouze pro administrátory." }, 403);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Neplatná titulní fotografie nebo relace." }, 400);
    const { sessionId, photoId, imageBase64 } = parsed.data;
    const { data: session, error: sessionError } = await client.from("smart_capture_sessions").select("id").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
    if (!session || sessionError) return json({ error: "Relace vám nepatří." }, 403);
    const bucket = client.storage.from("smart-capture");
    const prefix = `${sessionId}/${photoId}_showroom_ai`;
    // Durable unique storage claim prevents concurrent calls or upload retries
    // from replaying paid inference. Unknown outcomes remain locked, not retried.
    const { data: cached } = await bucket.download(`${prefix}.json`);
    if (cached) return json(JSON.parse(await cached.text()));
    const { error: claimError } = await bucket.upload(`${prefix}.lock`, new Blob([JSON.stringify({ startedAt: new Date().toISOString() })], { type: "application/json" }), { upsert: false, contentType: "application/json" });
    if (claimError) return json({ error: "Zpracování již začalo; neopakuji placený požadavek. Zkontrolujte záznamy AI.", outcome: "unknown" }, 409);
    const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const output = await editImage({
      model: "openai/gpt-image-2.5-sunburst",
      image: new Blob([bytes], { type: "image/jpeg" }),
      prompt: "Precisely isolate the single real vehicle in this source photograph onto a fully transparent background. Preserve its exact make, shape, paint, wheels, windows, badges, license plate, camera angle and all existing vehicle details. Remove only the surrounding scene and ground. Keep the entire vehicle, including tires and mirrors. No redesign, no beautification, no generated showroom, no extra objects, no text. Produce a clean photorealistic alpha-matted cutout with accurate fine edges.",
      background: "transparent", output_format: "png", quality: "high", size: "1536x1024", n: 1,
    });
    const image = output.data?.[0]?.b64_json;
    if (!image) return json({ error: "AI nevrátila výřez. Požadavek automaticky neopakuji." }, 502);
    const response = { imageBase64: image, model: "openai/gpt-image-2.5-sunburst", usage: output.usage };
    const { error: saveError } = await bucket.upload(`${prefix}.json`, new Blob([JSON.stringify(response)], { type: "application/json" }), { upsert: false, contentType: "application/json" });
    if (saveError) return json({ error: "Výřez vznikl, ale neuložil se; požadavek neopakuji.", outcome: "unknown" }, 503);
    return json(response);
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error("smart-capture-showroom", error.toJSON());
      return json({ error: error.message, code: error.code, outcome: error.outcome, recovery: error.recovery, ids: error.ids }, error.httpStatus ?? 502);
    }
    console.error("smart-capture-showroom", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Zpracování selhalo; původní fotografie je zachována." }, 500);
  }
});
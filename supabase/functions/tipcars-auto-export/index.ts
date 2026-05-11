import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("tipcars_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return new Response(JSON.stringify({ skipped: true, reason: "no settings row" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!settings.auto_export_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "auto_export_enabled=false" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pick all active vehicles flagged for tipcars export
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("id, status, tipcars_export_enabled")
      .neq("status", "prodano")
      .eq("tipcars_export_enabled", true);

    if (error) throw error;
    const ids = (vehicles || []).map((v) => v.id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no eligible vehicles" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Invoke the export function with use_settings=true so creds are loaded server-side
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tipcars-export`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        vehicle_ids: ids,
        use_settings: true,
      }),
    });
    const result = await resp.json();

    await supabase.from("tipcars_settings")
      .update({ last_auto_run_at: new Date().toISOString() })
      .eq("id", settings.id);

    return new Response(JSON.stringify({ triggered: true, vehicles: ids.length, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const e = err as Error;
    console.error("[tipcars-auto-export]", e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

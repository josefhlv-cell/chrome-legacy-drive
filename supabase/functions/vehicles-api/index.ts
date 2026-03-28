import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET /vehicles-api — returns all non-sold vehicles
    if (req.method === "GET") {
      const status = url.searchParams.get("status"); // optional filter
      let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      
      if (status) {
        query = query.eq("status", status);
      } else {
        query = query.neq("status", "prodano");
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ vehicles: data, count: data.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /vehicles-api — webhook for interest signals
    if (req.method === "POST") {
      const body = await req.json();
      const { action, vehicle_id, name, email, phone, message } = body;

      if (action === "interest" && vehicle_id) {
        // Save as lead
        const { error } = await supabase.from("leads").insert({
          type: "webhook-interest",
          name: name || "External App",
          email: email || "",
          phone: phone || "",
          vehicle_model: vehicle_id,
          message: message || `Interest from external app for vehicle ${vehicle_id}`,
        });
        if (error) throw error;

        // Optionally forward to external webhook
        const webhookUrl = Deno.env.get("WEBHOOK_URL");
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, vehicle_id, name, email, phone, message, timestamp: new Date().toISOString() }),
          }).catch(console.error);
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

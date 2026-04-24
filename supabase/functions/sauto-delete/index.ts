import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAUTO_RPC_URL = "https://import.sauto.cz/RPC2";

async function md5(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function xmlRpcValue(val: unknown): string {
  if (typeof val === "number" && Number.isInteger(val)) return `<value><int>${val}</int></value>`;
  if (typeof val === "number") return `<value><double>${val}</double></value>`;
  if (typeof val === "string") return `<value><string>${escapeXml(val)}</string></value>`;
  return `<value><string></string></value>`;
}

function buildReq(method: string, params: unknown[]): string {
  const p = params.map(x => `<param>${xmlRpcValue(x)}</param>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><methodCall><methodName>${method}</methodName><params>${p}</params></methodCall>`;
}

function parseValue(xml: string): unknown {
  xml = xml.trim();
  const i = xml.match(/<(?:int|i4)>(.*?)<\/(?:int|i4)>/);
  if (i) return parseInt(i[1], 10);
  const s = xml.match(/<string>([\s\S]*?)<\/string>/);
  if (s) return s[1];
  if (xml.includes("<struct>")) {
    const out: Record<string, unknown> = {};
    const re = /<member>\s*<name>(.*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
    let m;
    while ((m = re.exec(xml)) !== null) out[m[1]] = parseValue(m[2]);
    return out;
  }
  return xml.replace(/<[^>]+>/g, "").trim();
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  const resp = await fetch(SAUTO_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: buildReq(method, params),
  });
  const text = await resp.text();
  if (text.includes("<fault>")) throw new Error(`Fault: ${text.slice(0, 300)}`);
  // pull out top-level <params>...<value>STRUCT</value>
  const valMatch = text.match(/<params>\s*<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>\s*<\/params>/);
  return parseValue(valMatch ? valMatch[1] : text);
}

async function authenticate(login: string, password: string, swKey: string): Promise<string> {
  const h = await rpc("getHash", [login]);
  if (h.status !== 200) throw new Error(`getHash failed: ${h.status_message || h.status}`);
  const sessionId = h.output?.session_id;
  const hashKey = h.output?.hash_key;
  if (!sessionId || !hashKey) throw new Error("Missing session_id/hash_key");
  const md5Pass = await md5(password);
  const finalHash = await md5(md5Pass + hashKey);
  const l = await rpc("login", [sessionId, finalHash, swKey]);
  if (l.status !== 200) throw new Error(`login failed: ${l.status_message || l.status}`);
  return sessionId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // deno-lint-ignore no-explicit-any
  let supabase: any = null;
  let vehicleId: string | undefined;

  try {
    const { vehicle_id, sauto_login, sauto_password, sauto_sw_key } = await req.json();
    vehicleId = vehicle_id;

    if (!vehicle_id || !sauto_login || !sauto_password || !sauto_sw_key) {
      return new Response(JSON.stringify({ error: "Chybí vehicle_id nebo přihlašovací údaje" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("vehicle_exports")
      .select("*")
      .eq("vehicle_id", vehicle_id).eq("portal", "sauto").maybeSingle();

    if (!existing?.external_id) {
      return new Response(JSON.stringify({
        success: false,
        message: "Vozidlo není evidováno na Sauto (chybí external_id), nelze smazat.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const carId = parseInt(existing.external_id, 10);
    const sessionId = await authenticate(sauto_login, sauto_password, sauto_sw_key);

    let deleteOk = false;
    let deleteMsg = "";
    try {
      const r = await rpc("deleteCar", [sessionId, carId]);
      deleteOk = r.status === 200;
      deleteMsg = r.status_message || `status ${r.status}`;
    } finally {
      try { await rpc("logout", [sessionId]); } catch { /* ignore */ }
    }

    await supabase.from("vehicle_exports").update({
      status: deleteOk ? "removed" : "error",
      last_export_at: new Date().toISOString(),
      last_error: deleteOk ? "" : deleteMsg,
    }).eq("vehicle_id", vehicle_id).eq("portal", "sauto");

    await supabase.from("export_logs").insert({
      vehicle_id, portal: "sauto", operation: "delete",
      level: deleteOk ? "info" : "error",
      message: `deleteCar(${carId}): ${deleteMsg}`,
      context: { car_id: carId },
    });

    return new Response(JSON.stringify({ success: deleteOk, car_id: carId, message: deleteMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const e = err as Error;
    if (supabase) {
      try {
        await supabase.from("export_logs").insert({
          vehicle_id: vehicleId || null, portal: "sauto", operation: "delete",
          level: "error", message: e.message, context: {},
        });
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

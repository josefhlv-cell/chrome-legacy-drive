import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://chrysler-cz.lovable.app";

const escape = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const formatPrice = (n: number) => `${new Intl.NumberFormat("cs-CZ").format(n)} Kč`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cron may fire after the admin switched the feature off — re-check here.
    const { data: flagRow } = await supabase
      .from("site_contacts")
      .select("value")
      .eq("key", "feature_watchdog_enabled")
      .maybeSingle();

    if (flagRow?.value === "false") {
      return new Response(JSON.stringify({ skipped: "feature disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error: subsErr } = await supabase.from("watchdog_subscriptions").select("*");
    if (subsErr) throw subsErr;

    const { data: vehicles, error: vehErr } = await supabase
      .from("vehicles")
      .select("id,name,year,price_with_vat,mileage,fuel,image_url,status")
      .eq("status", "skladem");
    if (vehErr) throw vehErr;

    const user = Deno.env.get("GMAIL_USER");
    const pass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!user || !pass) throw new Error("Missing GMAIL_USER / GMAIL_APP_PASSWORD");

    let sent = 0;

    for (const sub of subs ?? []) {
      const already: string[] = sub.notified_vehicle_ids ?? [];
      // Diff against what was already sent (not a time window) so a cron outage
      // never causes missed or duplicated notifications.
      const matches = (vehicles ?? []).filter((v) => {
        if (already.includes(v.id)) return false;
        if (sub.keyword && !String(v.name ?? "").toLowerCase().includes(String(sub.keyword).toLowerCase())) return false;
        if (sub.price_max != null && Number(v.price_with_vat) > Number(sub.price_max)) return false;
        if (sub.year_min != null && Number(v.year) < Number(sub.year_min)) return false;
        return true;
      });

      if (matches.length === 0) continue;

      const unsubUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/watchdog-unsubscribe?token=${sub.unsubscribe_token}`;

      const cards = matches
        .map(
          (v) => `
        <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0">
          <table width="100%"><tr>
            <td width="160" valign="top">
              ${v.image_url ? `<img src="${escape(v.image_url)}" width="150" style="border-radius:8px;display:block" alt="">` : ""}
            </td>
            <td valign="top" style="padding-left:14px">
              <div style="font:600 16px Arial;color:#0f172a">${escape(v.name)}</div>
              <div style="font:400 13px Arial;color:#64748b;margin-top:4px">
                ${escape(v.year)} · ${new Intl.NumberFormat("cs-CZ").format(v.mileage ?? 0)} km · ${escape(v.fuel)}
              </div>
              <div style="font:700 16px Arial;color:#1d4ed8;margin-top:6px">${formatPrice(v.price_with_vat ?? 0)}</div>
              <a href="${SITE_URL}/vozidla/${v.id}" style="display:inline-block;margin-top:8px;background:#1d4ed8;color:#fff;text-decoration:none;padding:8px 14px;border-radius:6px;font:600 13px Arial">Zobrazit vůz</a>
            </td>
          </tr></table>
        </td></tr>`,
        )
        .join("");

      const html = `
      <div style="background:#f1f5f9;padding:24px">
        <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
          <h1 style="font:700 20px Arial;color:#0f172a;margin:0 0 4px">Nové vozy podle vašeho hlídání</h1>
          <p style="font:400 13px Arial;color:#64748b;margin:0 0 16px">Chrysler Pardubice — ${matches.length} nový/é vůz/vozy odpovídá vašim kritériím.</p>
          <table width="100%">${cards}</table>
          <p style="font:400 11px Arial;color:#94a3b8;margin-top:20px">
            Nechcete už tato upozornění dostávat? <a href="${unsubUrl}" style="color:#64748b">Odhlásit hlídání</a>.
          </p>
        </div>
      </div>`;

      const client = new SMTPClient({
        connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } },
      });
      try {
        await client.send({
          from: user,
          to: sub.email,
          subject: `Nové vozy skladem (${matches.length})`,
          html,
          content: "text/html",
        });
      } finally {
        await client.close();
      }

      await supabase
        .from("watchdog_subscriptions")
        .update({ notified_vehicle_ids: [...already, ...matches.map((m) => m.id)] })
        .eq("id", sub.id);

      sent++;
    }

    return new Response(JSON.stringify({ ok: true, subscriptions_notified: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("watchdog-check-new-vehicles failed:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

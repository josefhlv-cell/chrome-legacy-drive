// Sends a daily summary email at 20:00 Prague time via Gmail SMTP
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "obchod@chrysler.cz";

const TYPE_LABELS: Record<string, string> = {
  contact: "Kontaktní formulář",
  import: "Import na zakázku",
  "trade-in": "Výkup vozidla",
  service: "Servis",
  "spare-parts": "Náhradní díly",
  vehicle: "Poptávka vozidla",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) throw new Error("Gmail credentials missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Day window: today 00:00 → now (Prague time)
    const now = new Date();
    const pragueOffsetMs = 0; // store/compare in UTC; cron fires at 19:00 UTC = 20:00 Prague (winter) / 18:00 UTC (summer)
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [pageViewsRes, leadsRes] = await Promise.all([
      supabase.from("page_views").select("path,session_id,created_at").gte("created_at", startOfDay.toISOString()),
      supabase.from("leads").select("type,name,email,vehicle_model,created_at").gte("created_at", startOfDay.toISOString()).order("created_at", { ascending: false }),
    ]);

    const pageViews = pageViewsRes.data ?? [];
    const leads = leadsRes.data ?? [];

    const uniqueSessions = new Set(pageViews.map((p) => p.session_id)).size;
    const totalViews = pageViews.length;

    const pathCounts = new Map<string, number>();
    for (const pv of pageViews) pathCounts.set(pv.path, (pathCounts.get(pv.path) ?? 0) + 1);
    const topPages = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const leadCounts = new Map<string, number>();
    for (const l of leads) leadCounts.set(l.type, (leadCounts.get(l.type) ?? 0) + 1);

    const escape = (s: unknown) => String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const dateStr = now.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "long", year: "numeric" });

    const leadsBlock = leads.length === 0
      ? `<div style="padding:14px 18px;background:#f8fafc;border-radius:6px;color:#64748b;font-size:13px;text-align:center">Dnes žádné nové poptávky.</div>`
      : `<table style="width:100%;border-collapse:collapse">
          ${leads.slice(0, 20).map((l) => `
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:10px 0;font-size:13px;color:#64748b;width:140px">${escape(TYPE_LABELS[l.type] ?? l.type)}</td>
              <td style="padding:10px 0;font-size:13px;color:#0f172a"><b>${escape(l.name)}</b>${l.vehicle_model ? ` — ${escape(l.vehicle_model)}` : ""}</td>
              <td style="padding:10px 0;font-size:12px;color:#94a3b8;text-align:right">${new Date(l.created_at).toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" })}</td>
            </tr>`).join("")}
        </table>`;

    const leadTypesBlock = leadCounts.size === 0 ? "" :
      `<div style="padding:0 28px 8px"><div style="color:#64748b;font-size:13px;margin-bottom:8px">Poptávky podle typu</div>
        <table style="width:100%;border-collapse:collapse">
          ${[...leadCounts.entries()].map(([t, c]) => `<tr><td style="padding:6px 0;font-size:13px;color:#0f172a">${escape(TYPE_LABELS[t] ?? t)}</td><td style="padding:6px 0;font-size:13px;color:#1e3a8a;text-align:right"><b>${c}</b></td></tr>`).join("")}
        </table></div>`;

    const html = `
<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#ffffff">
    <div style="background:#0a1628;padding:24px 28px;color:#ffffff">
      <div style="font-size:12px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase">Chrysler Pardubice — Denní souhrn</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">${escape(dateStr)}</div>
    </div>
    <div style="display:flex;padding:20px 28px;gap:12px">
      <div style="flex:1;background:#f8fafc;padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#1e3a8a">${totalViews}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Zobrazení</div>
      </div>
      <div style="flex:1;background:#f8fafc;padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#1e3a8a">${uniqueSessions}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Návštěvníků</div>
      </div>
      <div style="flex:1;background:#f8fafc;padding:16px;border-radius:8px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#dc2626">${leads.length}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Poptávek</div>
      </div>
    </div>
    ${leadTypesBlock}
    <div style="padding:8px 28px 4px;color:#64748b;font-size:13px">Top stránky</div>
    <div style="padding:0 28px 16px">
      <table style="width:100%;border-collapse:collapse">
        ${topPages.map(([p, c]) => `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 0;font-size:13px;color:#0f172a">${escape(p)}</td><td style="padding:6px 0;font-size:13px;color:#64748b;text-align:right"><b>${c}</b></td></tr>`).join("") || `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Žádná data</td></tr>`}
      </table>
    </div>
    <div style="padding:8px 28px 4px;color:#64748b;font-size:13px">Dnešní poptávky</div>
    <div style="padding:0 28px 24px">${leadsBlock}</div>
    <div style="padding:14px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;text-align:center">Chrysler Pardubice · automatický denní souhrn 20:00</div>
  </div>
</body></html>`;

    const client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD } },
    });
    await client.send({
      from: `Chrysler Pardubice Web <${GMAIL_USER}>`,
      to: NOTIFY_TO,
      subject: `📊 Denní souhrn ${dateStr} — ${leads.length} poptávek, ${uniqueSessions} návštěvníků`,
      content: `Denní souhrn: ${totalViews} zobrazení, ${uniqueSessions} návštěvníků, ${leads.length} poptávek.`,
      html,
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true, totalViews, uniqueSessions, leads: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("daily-stats-email error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

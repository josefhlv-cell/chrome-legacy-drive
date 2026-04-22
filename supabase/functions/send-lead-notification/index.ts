// Sends an email via Gmail SMTP to obchod@chrysler.cz whenever a new lead is submitted
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "obchod@chrysler.cz";

interface LeadPayload {
  type: string;
  name: string;
  email: string;
  phone?: string;
  vehicle_model?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  contact: "Kontaktní formulář",
  import: "Import vozidla na zakázku",
  "trade-in": "Výkup vozidla",
  service: "Servis",
  "spare-parts": "Náhradní díly",
  vehicle: "Poptávka konkrétního vozidla",
};

const escape = (s: unknown) =>
  String(s ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      throw new Error("Gmail credentials are not configured");
    }

    const lead = (await req.json()) as LeadPayload;
    if (!lead?.email || !lead?.name || !lead?.type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typeLabel = TYPE_LABELS[lead.type] ?? lead.type;
    const metaRows = lead.metadata && typeof lead.metadata === "object"
      ? Object.entries(lead.metadata)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px">${escape(k)}</td><td style="padding:6px 12px;color:#0f172a;font-size:13px"><b>${escape(v)}</b></td></tr>`,
          )
          .join("")
      : "";

    const html = `
<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;background:#ffffff">
    <div style="background:#0a1628;padding:20px 28px;color:#ffffff">
      <div style="font-size:12px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase">Chrysler Pardubice</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">Nová poptávka — ${escape(typeLabel)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 28px;color:#64748b;font-size:13px;width:140px">Jméno</td><td style="padding:10px 28px;color:#0f172a;font-size:14px"><b>${escape(lead.name)}</b></td></tr>
      <tr style="background:#f8fafc"><td style="padding:10px 28px;color:#64748b;font-size:13px">E-mail</td><td style="padding:10px 28px;color:#0f172a;font-size:14px"><a href="mailto:${escape(lead.email)}" style="color:#1e3a8a">${escape(lead.email)}</a></td></tr>
      <tr><td style="padding:10px 28px;color:#64748b;font-size:13px">Telefon</td><td style="padding:10px 28px;color:#0f172a;font-size:14px">${lead.phone ? `<a href="tel:${escape(lead.phone)}" style="color:#1e3a8a">${escape(lead.phone)}</a>` : "—"}</td></tr>
      ${lead.vehicle_model ? `<tr style="background:#f8fafc"><td style="padding:10px 28px;color:#64748b;font-size:13px">Vozidlo</td><td style="padding:10px 28px;color:#0f172a;font-size:14px"><b>${escape(lead.vehicle_model)}</b></td></tr>` : ""}
    </table>
    ${lead.message ? `<div style="padding:16px 28px"><div style="color:#64748b;font-size:13px;margin-bottom:6px">Zpráva</div><div style="background:#f8fafc;border-left:3px solid #1e3a8a;padding:14px 18px;color:#0f172a;font-size:14px;line-height:1.6;white-space:pre-wrap">${escape(lead.message)}</div></div>` : ""}
    ${metaRows ? `<div style="padding:8px 28px 16px"><div style="color:#64748b;font-size:13px;margin-bottom:6px">Detaily</div><table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden">${metaRows}</table></div>` : ""}
    <div style="padding:16px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px">Automaticky odesláno z chrysler.cz · ${new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}</div>
  </div>
</body></html>`;

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });

    await client.send({
      from: `Chrysler Pardubice Web <${GMAIL_USER}>`,
      to: NOTIFY_TO,
      replyTo: lead.email,
      subject: `[${typeLabel}] ${lead.name}${lead.vehicle_model ? ` — ${lead.vehicle_model}` : ""}`,
      content: `Nová poptávka od ${lead.name} (${lead.email})`,
      html,
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-lead-notification error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

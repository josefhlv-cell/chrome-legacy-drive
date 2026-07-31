import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const page = (title: string, body: string) => `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:80px auto;background:#fff;border-radius:12px;padding:32px;text-align:center">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 8px">${title}</h1>
    <p style="font-size:14px;color:#64748b;margin:0">${body}</p>
  </div>
</body></html>`;

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");

  if (!token) {
    return new Response(page("Neplatný odkaz", "V odkazu chybí ověřovací token."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error, count } = await supabase
    .from("watchdog_subscriptions")
    .delete({ count: "exact" })
    .eq("unsubscribe_token", token);

  if (error) {
    console.error("watchdog-unsubscribe failed:", error);
    return new Response(page("Něco se pokazilo", "Odhlášení se nepodařilo, zkuste to prosím později."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(
    page(
      "Hlídání zrušeno",
      count ? "Už vám nebudeme posílat upozornění na nové vozy." : "Toto hlídání už bylo dříve zrušeno.",
    ),
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
});

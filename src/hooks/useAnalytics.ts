import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PageView {
  id: string;
  session_id: string;
  visitor_id?: string | null;
  is_new_visitor?: boolean | null;
  path: string;
  referrer: string;
  entry_referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  time_on_page: number;
  screen_width: number;
  screen_height: number;
  is_bounce: boolean;
  exit_page: boolean;
  created_at: string;
}

interface Lead {
  id: string;
  type: string;
  email?: string | null;
  phone?: string | null;
  created_at: string;
}

export interface PhoneClick {
  id: string;
  session_id: string;
  visitor_id?: string | null;
  is_new_visitor?: boolean | null;
  phone: string;
  path: string;
  source: string;
  created_at: string;
}

/** Strop doby na stránce (30 min) – stejný jako v usePageTracking.
 *  Starší řádky v DB mohou mít nesmyslné hodnoty (karta otevřená přes noc),
 *  proto je normalizujeme i při čtení. */
const MAX_TIME_ON_PAGE = 30 * 60;

/** Denní klíč v LOKÁLNÍM čase.
 *  Dřív se používalo created_at.slice(0,10) = UTC den, takže návštěvy mezi
 *  00:00 a 02:00 letního času padaly do předchozího dne. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Supabase/PostgREST vrací max. 1000 řádků na jeden request (výchozí "max-rows").
// Bez stránkování přes .range() se tak jakýkoli dotaz s víc než 1000 shodami
// vždy tise ořízne na přesně 1000 – proto dashboard "zamrzl" na čísle 1 000.
//
// OPRAVA (audit): řazení jen podle created_at není stabilní – u řádků se stejným
// časem (a při zápisu nových řádků během stránkování) mohl PostgREST vrátit
// stejný řádek dvakrát, nebo jeden vynechat. Nově řadíme created_at + id
// (deterministicky) a navíc deduplikujeme podle id, takže se řádek nikdy
// nespočítá dvakrát ani na hranici stránky.
async function fetchAllRows<T extends { id: string }>(
  table: string,
  columns: string,
  since: string
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const byId = new Map<string, T>();

  while (true) {
    const { data, error } = await supabase
      .from(table as never)
      .select(columns)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = (data || []) as T[];
    rows.forEach(r => byId.set(r.id, r));

    if (rows.length < pageSize) break; // poslední (neúplná) stránka -> konec
    from += pageSize;

    // pojistka proti nekonečné smyčce při neočekávaných datech
    if (from > 200_000) break;
  }

  return Array.from(byId.values());
}

function sinceIso(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0); // celé lokální dny, ať okno souhlasí s denním grafem
  return since.toISOString();
}

export function useAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => {
      const rows = await fetchAllRows<PageView>("page_views", "*", sinceIso(days));
      // Normalizace: zastropovaná doba na stránce (staré řádky mají i 40 000 s)
      return rows.map(r => ({
        ...r,
        time_on_page: Math.min(MAX_TIME_ON_PAGE, Math.max(0, r.time_on_page || 0)),
      }));
    },
    staleTime: 60_000, // 1 min cache, ať se dashboard zbytečně nedotazuje při každém renderu
  });
}

export function useLeadsAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["leads-analytics", days],
    queryFn: async () =>
      fetchAllRows<Lead>("leads", "id, type, email, phone, created_at", sinceIso(days)),
    staleTime: 60_000,
  });
}

export function usePhoneClicks(days: number = 30) {
  return useQuery({
    queryKey: ["phone-clicks", days],
    queryFn: async () =>
      fetchAllRows<PhoneClick>(
        "phone_clicks",
        "id, session_id, visitor_id, is_new_visitor, phone, path, source, created_at",
        sinceIso(days)
      ),
    staleTime: 60_000,
  });
}


/**
 * OPRAVY (audit):
 * - Lead se při opakovaném odeslání formuláře (retry) počítal vícekrát.
 *   Nově se stejný typ + stejný e-mail/telefon do 10 minut považuje za jeden lead.
 * - Denní grupování používá lokální den (dayKey), ne UTC.
 * - uniqueSessions i totalLeads se počítají ze stejného okna (obě data se
 *   načítají přes sinceIso(days), takže jmenovatel a čitatel jsou souměřitelné).
 */
export function computeConversionStats(views: PageView[], leads: Lead[]) {
  const uniqueSessions = new Set(views.map(v => v.session_id)).size;

  const sorted = [...leads].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const lastSeen = new Map<string, number>();
  const dedupedLeads = sorted.filter(l => {
    const ident = (l.email || l.phone || l.id).toLowerCase().trim();
    const key = `${l.type}|${ident}`;
    const t = new Date(l.created_at).getTime();
    const prev = lastSeen.get(key);
    if (prev !== undefined && t - prev < 10 * 60 * 1000) return false;
    lastSeen.set(key, t);
    return true;
  });

  const totalLeads = dedupedLeads.length;
  const conversionRate = uniqueSessions > 0 ? ((totalLeads / uniqueSessions) * 100).toFixed(1) : "0";

  // Leads by type
  const byType = new Map<string, number>();
  dedupedLeads.forEach(l => {
    byType.set(l.type, (byType.get(l.type) || 0) + 1);
  });
  const leadsByType = Array.from(byType.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Daily leads vs visits
  const dailyMap = new Map<string, { visits: number; leads: number }>();
  views.forEach(v => {
    const day = dayKey(v.created_at);
    const entry = dailyMap.get(day) || { visits: 0, leads: 0 };
    entry.visits++;
    dailyMap.set(day, entry);
  });
  dedupedLeads.forEach(l => {
    const day = dayKey(l.created_at);
    const entry = dailyMap.get(day) || { visits: 0, leads: 0 };
    entry.leads++;
    dailyMap.set(day, entry);
  });
  const dailyConversion = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totalLeads, conversionRate, leadsByType, dailyConversion, uniqueSessions };
}

export function computeStats(views: PageView[]) {
  if (!views.length) return null;

  const uniqueSessions = new Set(views.map(v => v.session_id)).size;
  const totalViews = views.length;
  const avgTimeOnPage = Math.round(views.reduce((s, v) => s + v.time_on_page, 0) / views.length);

  const sessionCounts = new Map<string, number>();
  views.forEach(v => sessionCounts.set(v.session_id, (sessionCounts.get(v.session_id) || 0) + 1));
  const bounceSessions = Array.from(sessionCounts.values()).filter(c => c === 1).length;
  const bounceRate = Math.round((bounceSessions / uniqueSessions) * 100);

  const pageViews = new Map<string, { views: number; totalTime: number; exits: number }>();
  views.forEach(v => {
    const existing = pageViews.get(v.path) || { views: 0, totalTime: 0, exits: 0 };
    existing.views++;
    existing.totalTime += v.time_on_page;
    if (v.exit_page) existing.exits++;
    pageViews.set(v.path, existing);
  });

  const pageStats = Array.from(pageViews.entries())
    .map(([path, stats]) => ({
      path,
      views: stats.views,
      avgTime: Math.round(stats.totalTime / stats.views),
      exitRate: Math.round((stats.exits / stats.views) * 100),
    }))
    .sort((a, b) => b.views - a.views);

  const topExitPages = [...pageStats].filter(p => p.exitRate > 0).sort((a, b) => b.exitRate - a.exitRate).slice(0, 10);
  const mostTimeSpent = [...pageStats].sort((a, b) => b.avgTime - a.avgTime).slice(0, 10);

  const mobile = views.filter(v => v.screen_width < 768).length;
  const tablet = views.filter(v => v.screen_width >= 768 && v.screen_width < 1024).length;
  const desktop = views.filter(v => v.screen_width >= 1024).length;

  const dailyMap = new Map<string, number>();
  views.forEach(v => {
    const day = v.created_at.slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  });
  const dailyViews = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

  const hourlyMap = new Map<number, number>();
  views.forEach(v => {
    const hour = new Date(v.created_at).getHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
  });
  const hourlyViews = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourlyMap.get(i) || 0 }));

  const refMap = new Map<string, number>();
  views.filter(v => v.referrer).forEach(v => {
    try {
      const host = new URL(v.referrer).hostname || "Přímý přístup";
      refMap.set(host, (refMap.get(host) || 0) + 1);
    } catch {
      refMap.set(v.referrer, (refMap.get(v.referrer) || 0) + 1);
    }
  });
  const referrers = Array.from(refMap.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    uniqueSessions, totalViews, avgTimeOnPage, bounceRate, pageStats,
    topExitPages, mostTimeSpent, devices: { mobile, tablet, desktop },
    dailyViews, hourlyViews, referrers,
  };
}

export type SourceGroup = "Přímý přístup" | "Vyhledávače" | "Sociální sítě" | "Inzertní portály" | "Odkazy" | "Kampaně";

function classifySource(host: string, utmMedium?: string | null): SourceGroup {
  if (utmMedium) return "Kampaně";
  if (!host) return "Přímý přístup";
  const h = host.toLowerCase();
  if (/(google|seznam|bing|duckduckgo|yahoo|centrum|ecosia)\./.test(h)) return "Vyhledávače";
  if (/(facebook|instagram|tiktok|youtube|linkedin|twitter|x\.com|t\.co|pinterest)/.test(h)) return "Sociální sítě";
  if (/(sauto|tipcars|autobazar|autosoft|bazos|mobile\.de|autoesa)/.test(h)) return "Inzertní portály";
  return "Odkazy";
}

function hostOf(url?: string | null): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Session-level insights: where visitors come from, where they stay, where they leave. */
export function computeSiteInsights(views: PageView[]) {
  // Group all views into sessions ordered in time
  const sessions = new Map<string, PageView[]>();
  views.forEach(v => {
    const arr = sessions.get(v.session_id) ?? [];
    arr.push(v);
    sessions.set(v.session_id, arr);
  });
  sessions.forEach(arr => arr.sort((a, b) => a.created_at.localeCompare(b.created_at)));

  const sourceMap = new Map<string, { group: SourceGroup; sessions: number; views: number; time: number }>();
  const groupMap = new Map<SourceGroup, number>();
  const landingMap = new Map<string, number>();
  const exitMap = new Map<string, number>();
  const campaignMap = new Map<string, number>();
  let bounced = 0;
  let totalDuration = 0;
  let totalDepth = 0;

  sessions.forEach(arr => {
    const first = arr[0];
    const last = arr[arr.length - 1];
    const ref = first.entry_referrer || first.referrer || "";
    const host = hostOf(ref);
    const group = classifySource(host, first.utm_medium);
    const label = first.utm_source ? `${first.utm_source}${first.utm_campaign ? ` / ${first.utm_campaign}` : ""}` : (host || "Přímý přístup");
    const dur = arr.reduce((s, v) => s + (v.time_on_page || 0), 0);

    const entry = sourceMap.get(label) ?? { group, sessions: 0, views: 0, time: 0 };
    entry.sessions++; entry.views += arr.length; entry.time += dur;
    sourceMap.set(label, entry);
    groupMap.set(group, (groupMap.get(group) || 0) + 1);
    if (first.utm_campaign) campaignMap.set(first.utm_campaign, (campaignMap.get(first.utm_campaign) || 0) + 1);

    landingMap.set(first.path, (landingMap.get(first.path) || 0) + 1);
    exitMap.set(last.path, (exitMap.get(last.path) || 0) + 1);

    if (arr.length === 1) bounced++;
    totalDuration += dur;
    totalDepth += arr.length;
  });

  const sessionCount = sessions.size || 1;

  // Per-page dwell + engagement
  const pageMap = new Map<string, { views: number; time: number; sessions: Set<string> }>();
  views.forEach(v => {
    const e = pageMap.get(v.path) ?? { views: 0, time: 0, sessions: new Set<string>() };
    e.views++; e.time += v.time_on_page || 0; e.sessions.add(v.session_id);
    pageMap.set(v.path, e);
  });

  const pages = Array.from(pageMap.entries()).map(([path, e]) => ({
    path,
    views: e.views,
    visitors: e.sessions.size,
    totalTime: e.time,
    avgTime: Math.round(e.time / Math.max(1, e.views)),
    exits: exitMap.get(path) || 0,
    exitRate: Math.round(((exitMap.get(path) || 0) / Math.max(1, e.sessions.size)) * 100),
  }));

  const sources = Array.from(sourceMap.entries())
    .map(([source, e]) => ({
      source, group: e.group, sessions: e.sessions, views: e.views,
      avgTime: Math.round(e.time / Math.max(1, e.sessions)),
      share: Math.round((e.sessions / sessionCount) * 100),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const groups = Array.from(groupMap.entries())
    .map(([group, count]) => ({ group, count, share: Math.round((count / sessionCount) * 100) }))
    .sort((a, b) => b.count - a.count);

  return {
    sessionCount: sessions.size,
    avgSessionDuration: Math.round(totalDuration / sessionCount),
    avgDepth: +(totalDepth / sessionCount).toFixed(1),
    bounceRate: Math.round((bounced / sessionCount) * 100),
    sources,
    groups,
    campaigns: Array.from(campaignMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    landingPages: Array.from(landingMap.entries()).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    exitPages: [...pages].sort((a, b) => b.exits - a.exits).slice(0, 10),
    topPages: [...pages].sort((a, b) => b.views - a.views).slice(0, 10),
    stickiestPages: [...pages].filter(p => p.views >= 2).sort((a, b) => b.avgTime - a.avgTime).slice(0, 10),
  };
}

export function formatDuration(sec: number) {
  if (!sec || sec < 0) return "0 s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} m ${s} s` : `${s} s`;
}

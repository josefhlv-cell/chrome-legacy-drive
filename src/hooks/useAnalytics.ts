import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PageView {
  id: string;
  session_id: string;
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
  created_at: string;
}

export function useAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("page_views")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PageView[];
    },
  });
}

export function useLeadsAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ["leads-analytics", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("leads")
        .select("id, type, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Lead[];
    },
  });
}

export function computeConversionStats(views: PageView[], leads: Lead[]) {
  const uniqueSessions = new Set(views.map(v => v.session_id)).size;
  const totalLeads = leads.length;
  const conversionRate = uniqueSessions > 0 ? ((totalLeads / uniqueSessions) * 100).toFixed(1) : "0";

  // Leads by type
  const byType = new Map<string, number>();
  leads.forEach(l => {
    byType.set(l.type, (byType.get(l.type) || 0) + 1);
  });
  const leadsByType = Array.from(byType.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Daily leads vs visits
  const dailyMap = new Map<string, { visits: number; leads: number }>();
  views.forEach(v => {
    const day = v.created_at.slice(0, 10);
    const entry = dailyMap.get(day) || { visits: 0, leads: 0 };
    entry.visits++;
    dailyMap.set(day, entry);
  });
  leads.forEach(l => {
    const day = l.created_at.slice(0, 10);
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

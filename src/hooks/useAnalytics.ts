import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PageView {
  id: string;
  session_id: string;
  path: string;
  referrer: string;
  time_on_page: number;
  screen_width: number;
  screen_height: number;
  is_bounce: boolean;
  exit_page: boolean;
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

export function computeStats(views: PageView[]) {
  if (!views.length) return null;

  const uniqueSessions = new Set(views.map(v => v.session_id)).size;
  const totalViews = views.length;
  const avgTimeOnPage = Math.round(views.reduce((s, v) => s + v.time_on_page, 0) / views.length);

  // Bounce rate: sessions with only one page view
  const sessionCounts = new Map<string, number>();
  views.forEach(v => sessionCounts.set(v.session_id, (sessionCounts.get(v.session_id) || 0) + 1));
  const bounceSessions = Array.from(sessionCounts.values()).filter(c => c === 1).length;
  const bounceRate = Math.round((bounceSessions / uniqueSessions) * 100);

  // Pages by views
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

  // Top exit pages
  const topExitPages = [...pageStats]
    .filter(p => p.exitRate > 0)
    .sort((a, b) => b.exitRate - a.exitRate)
    .slice(0, 10);

  // Most time spent
  const mostTimeSpent = [...pageStats]
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);

  // Device breakdown
  const mobile = views.filter(v => v.screen_width < 768).length;
  const tablet = views.filter(v => v.screen_width >= 768 && v.screen_width < 1024).length;
  const desktop = views.filter(v => v.screen_width >= 1024).length;

  // Daily views
  const dailyMap = new Map<string, number>();
  views.forEach(v => {
    const day = v.created_at.slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  });
  const dailyViews = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Hourly distribution
  const hourlyMap = new Map<number, number>();
  views.forEach(v => {
    const hour = new Date(v.created_at).getHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
  });
  const hourlyViews = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) || 0,
  }));

  // Referrers
  const refMap = new Map<string, number>();
  views.filter(v => v.referrer).forEach(v => {
    try {
      const host = new URL(v.referrer).hostname || "Přímý přístup";
      refMap.set(host, (refMap.get(host) || 0) + 1);
    } catch {
      refMap.set(v.referrer, (refMap.get(v.referrer) || 0) + 1);
    }
  });
  const referrers = Array.from(refMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    uniqueSessions,
    totalViews,
    avgTimeOnPage,
    bounceRate,
    pageStats,
    topExitPages,
    mostTimeSpent,
    devices: { mobile, tablet, desktop },
    dailyViews,
    hourlyViews,
    referrers,
  };
}

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

// ... keep existing code (computeStats function)

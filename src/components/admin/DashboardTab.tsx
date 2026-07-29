import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Car, Eye, Inbox, Percent, Wallet, Timer, TrendingUp, TrendingDown,
  Trophy, AlertTriangle, FileWarning, Image as ImageIcon, FileText,
  Upload, Clock, Activity,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics, useLeadsAnalytics } from "@/hooks/useAnalytics";
import SiteStatsSection from "@/components/admin/SiteStatsSection";
import { formatPrice } from "@/data/vehicles";

type DashVehicle = {
  id: string;
  name: string;
  year: number;
  price_with_vat: number;
  status: string;
  vin: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
  vehicle_images?: { image_url: string; is_main: boolean; sort_order: number }[];
};

const useDashboardVehicles = () =>
  useQuery({
    queryKey: ["dashboard-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id,name,year,price_with_vat,status,vin,description,image_url,created_at,vehicle_images(image_url,is_main,sort_order)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Dedupe by VIN/id (mirror of catalog logic)
      const map = new Map<string, DashVehicle>();
      for (const v of (data || []) as DashVehicle[]) {
        const key = (v.vin && v.vin.trim()) || v.id;
        if (!map.has(key)) map.set(key, v);
      }
      return Array.from(map.values());
    },
  });

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04 } }),
};

const StatCard = ({
  icon: Icon, label, value, sub, accent = "primary", index = 0,
}: {
  icon: any; label: string; value: React.ReactNode; sub?: React.ReactNode;
  accent?: "primary" | "success" | "warning" | "danger"; index?: number;
}) => {
  const accentMap: Record<string, string> = {
    primary: "from-primary/20 to-primary/0 text-primary",
    success: "from-emerald-500/20 to-emerald-500/0 text-emerald-400",
    warning: "from-amber-500/20 to-amber-500/0 text-amber-400",
    danger: "from-red-500/20 to-red-500/0 text-red-400",
  };
  return (
    <motion.div
      custom={index} variants={cardVariants} initial="hidden" animate="show"
      className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.4)] transition-shadow"
    >
      <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${accentMap[accent]} blur-2xl opacity-70`} />
      <div className="flex items-start justify-between gap-3 relative">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`shrink-0 grid place-items-center h-10 w-10 rounded-lg bg-background/40 border border-border ${accentMap[accent].split(" ").pop()}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
};

const SectionCard = ({ title, icon: Icon, children, action }: any) => (
  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

const DashboardTab = () => {
  const { data: vehicles = [], isLoading: loadingVehicles } = useDashboardVehicles();
  const { data: views30 = [] } = useAnalytics(30);
  const { data: views60 = [] } = useAnalytics(60);
  const { data: leads30 = [] } = useLeadsAnalytics(30);
  const { data: leads60 = [] } = useLeadsAnalytics(60);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

    const inStock = vehicles.filter(v => v.status === "skladem");
    const inventoryValue = inStock.reduce((s, v) => s + (v.price_with_vat || 0), 0);
    const avgDays = inStock.length
      ? Math.round(inStock.reduce((s, v) => s + daysSince(v.created_at), 0) / inStock.length)
      : 0;

    const visitsToday = views30.filter(v => new Date(v.created_at) >= today).length;
    const visitsMonth = views30.length;
    const visitsPrevMonth = views60.length - views30.length;
    const visitsChange = visitsPrevMonth > 0 ? ((visitsMonth - visitsPrevMonth) / visitsPrevMonth) * 100 : 0;

    const leadsToday = leads30.filter(l => new Date(l.created_at) >= today).length;
    const leadsWeek = leads30.filter(l => new Date(l.created_at) >= weekAgo).length;
    const leadsMonth = leads30.length;
    const leadsPrevMonth = leads60.length - leads30.length;
    const leadsChange = leadsPrevMonth > 0 ? ((leadsMonth - leadsPrevMonth) / leadsPrevMonth) * 100 : 0;

    const sessions = new Set(views30.map(v => v.session_id)).size;
    const conversion = sessions > 0 ? (leadsMonth / sessions) * 100 : 0;

    // Inventory age buckets (in stock only)
    const buckets = { fresh: 0, mid: 0, old: 0 };
    inStock.forEach(v => {
      const d = daysSince(v.created_at);
      if (d <= 30) buckets.fresh++;
      else if (d <= 60) buckets.mid++;
      else buckets.old++;
    });

    const problem30 = inStock.filter(v => daysSince(v.created_at) > 30 && daysSince(v.created_at) <= 60);
    const problem60 = inStock.filter(v => daysSince(v.created_at) > 60);

    // Data quality
    const missingVin = inStock.filter(v => !v.vin || !v.vin.trim()).length;
    const missingImages = inStock.filter(v => (v.vehicle_images?.length ?? 0) === 0 && !v.image_url).length;
    const missingDescription = inStock.filter(v => !v.description || v.description.trim().length < 20).length;

    // Daily series (30 days)
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const series: Record<string, { date: string; visits: number; leads: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const k = dayKey(d);
      series[k] = { date: k.slice(5), visits: 0, leads: 0 };
    }
    views30.forEach(v => {
      const k = v.created_at.slice(0, 10);
      if (series[k]) series[k].visits++;
    });
    leads30.forEach(l => {
      const k = l.created_at.slice(0, 10);
      if (series[k]) series[k].leads++;
    });
    const trend = Object.values(series);

    // Recent
    const recent = [...vehicles].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 5);

    // Top vehicles by views (path-matching)
    const viewsByVehicle = new Map<string, number>();
    views30.forEach(v => {
      const m = v.path?.match(/\/vozidla\/([^/?#]+)/);
      if (m) viewsByVehicle.set(m[1], (viewsByVehicle.get(m[1]) || 0) + 1);
    });
    const top = [...vehicles]
      .map(v => ({ v, views: viewsByVehicle.get(v.id) || 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    return {
      inStockCount: inStock.length, inventoryValue, avgDays,
      visitsToday, visitsMonth, visitsChange,
      leadsToday, leadsWeek, leadsMonth, leadsChange,
      conversion, buckets, problem30, problem60,
      missingVin, missingImages, missingDescription,
      trend, recent, top,
    };
  }, [vehicles, views30, views60, leads30, leads60]);

  const ChangeBadge = ({ value }: { value: number }) => {
    const positive = value >= 0;
    const Icon = positive ? TrendingUp : TrendingDown;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
        <Icon className="w-3 h-3" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const mainImage = (v: DashVehicle) => {
    const img = v.vehicle_images?.find(i => i.is_main) || v.vehicle_images?.[0];
    return img?.image_url || v.image_url || "/vehicle-placeholder.svg";
  };

  return (
    <div className="space-y-6">
      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} icon={Car} label="Vozidla skladem" value={stats.inStockCount}
          sub={loadingVehicles ? "Načítání..." : `${vehicles.length} celkem v systému`} />
        <StatCard index={1} icon={Eye} label="Návštěvy" value={stats.visitsMonth.toLocaleString("cs-CZ")}
          sub={<>Dnes: <strong className="text-foreground">{stats.visitsToday}</strong> · <ChangeBadge value={stats.visitsChange} /></>}
          accent="success" />
        <StatCard index={2} icon={Inbox} label="Poptávky" value={stats.leadsMonth}
          sub={<>Dnes: <strong className="text-foreground">{stats.leadsToday}</strong> · <ChangeBadge value={stats.leadsChange} /></>}
          accent="warning" />
        <StatCard index={3} icon={Percent} label="Konverze" value={`${stats.conversion.toFixed(2)}%`}
          sub="Poptávky / unikátní návštěvy (30 dní)" accent="primary" />
      </div>

      {/* Business cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard index={4} icon={Wallet} label="Hodnota skladu"
          value={formatPrice(stats.inventoryValue)} sub="Součet cen vozidel skladem" accent="success" />
        <StatCard index={5} icon={Timer} label="Průměrná doba na skladě"
          value={`${stats.avgDays} dní`} sub="Od přidání do systému" accent="warning" />
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Trend návštěv (30 dní)" icon={TrendingUp}
          action={<ChangeBadge value={stats.visitsChange} />}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Trend poptávek (30 dní)" icon={Inbox}
          action={<ChangeBadge value={stats.leadsChange} />}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Top vehicles + Problem vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="TOP 5 vozidel (zhlédnutí 30 dní)" icon={Trophy}>
          <ul className="space-y-2">
            {stats.top.length === 0 && <li className="text-sm text-muted-foreground">Zatím žádná data o zhlédnutích.</li>}
            {stats.top.map(({ v, views }, i) => (
              <li key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/40 transition-colors">
                <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                <img src={mainImage(v)} alt={v.name} loading="lazy"
                  className="w-14 h-10 object-cover rounded border border-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(v.price_with_vat)}</p>
                </div>
                <span className="text-xs font-semibold text-primary inline-flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {views}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Problémová vozidla" icon={AlertTriangle}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-muted-foreground">Skladem 30–60 dní</p>
              <p className="text-2xl font-semibold text-amber-400">{stats.problem30.length}</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-muted-foreground">Skladem 60+ dní</p>
              <p className="text-2xl font-semibold text-red-400">{stats.problem60.length}</p>
            </div>
          </div>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
            {stats.problem60.slice(0, 6).map(v => (
              <li key={v.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-background/40">
                <span className="truncate">{v.name}</span>
                <span className="text-red-400 font-medium shrink-0 ml-2">{daysSince(v.created_at)} dní</span>
              </li>
            ))}
            {stats.problem60.length === 0 && <li className="text-xs text-muted-foreground">Žádná vozidla starší 60 dní.</li>}
          </ul>
        </SectionCard>
      </div>

      {/* Leads overview + Inventory breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Poptávky – přehled" icon={Inbox}>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-background/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">Dnes</p>
              <p className="text-2xl font-semibold mt-1">{stats.leadsToday}</p>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">Týden</p>
              <p className="text-2xl font-semibold mt-1">{stats.leadsWeek}</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Měsíc</p>
              <p className="text-2xl font-semibold mt-1 text-primary">{stats.leadsMonth}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Skladová struktura" icon={Car}>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">0–30 dní</p>
              <p className="text-2xl font-semibold mt-1 text-emerald-400">{stats.buckets.fresh}</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">30–60 dní</p>
              <p className="text-2xl font-semibold mt-1 text-amber-400">{stats.buckets.mid}</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">60+ dní</p>
              <p className="text-2xl font-semibold mt-1 text-red-400">{stats.buckets.old}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Data quality + Export status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Kvalita dat" icon={FileWarning}>
          <ul className="divide-y divide-border">
            <li className="flex items-center justify-between py-2.5">
              <span className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /> Chybí VIN</span>
              <span className={`text-sm font-semibold ${stats.missingVin ? "text-amber-400" : "text-emerald-400"}`}>{stats.missingVin}</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4 text-muted-foreground" /> Chybí fotky</span>
              <span className={`text-sm font-semibold ${stats.missingImages ? "text-red-400" : "text-emerald-400"}`}>{stats.missingImages}</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /> Chybí popis</span>
              <span className={`text-sm font-semibold ${stats.missingDescription ? "text-amber-400" : "text-emerald-400"}`}>{stats.missingDescription}</span>
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Stav exportů" icon={Upload}>
          <ul className="space-y-2">
            <li className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(160_84%_45%)]" />
                <span className="text-sm font-medium">TipCars</span>
              </div>
              <span className="text-xs text-muted-foreground">Aktivní</span>
            </li>
            <li className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(160_84%_45%)]" />
                <span className="text-sm font-medium">Sauto</span>
              </div>
              <span className="text-xs text-muted-foreground">Aktivní</span>
            </li>
          </ul>
        </SectionCard>
      </div>

      {/* Recent activity */}
      <SectionCard title="Posledních 5 přidaných vozidel" icon={Activity}>
        <ul className="divide-y divide-border">
          {stats.recent.map(v => (
            <li key={v.id} className="flex items-center gap-3 py-2.5">
              <img src={mainImage(v)} alt={v.name} loading="lazy"
                className="w-12 h-9 object-cover rounded border border-border" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(v.price_with_vat)} · {v.year}</p>
              </div>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" /> {daysSince(v.created_at)} d
              </span>
            </li>
          ))}
          {stats.recent.length === 0 && <li className="text-sm text-muted-foreground py-4 text-center">Žádná vozidla.</li>}
        </ul>
      </SectionCard>
    </div>
  );
};

export default DashboardTab;

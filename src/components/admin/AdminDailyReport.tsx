import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Inbox, Car, Eye, TrendingUp, TrendingDown, Wrench, ShoppingBag, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_EMAIL = "admin@chrysler-pardubice.cz";
const STORAGE_KEY = "chrysler_admin_daily_report_last_shown";

type LeadRow = {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  vehicle_model: string;
  message: string;
  created_at: string;
};

type VehicleRow = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
  created_at: string;
};

interface ReportData {
  leadsByType: Record<string, LeadRow[]>;
  totalLeads: number;
  vehiclesAdded: VehicleRow[];
  vehiclesSold: VehicleRow[];
  yesterdayViews: number;
  monthlyAvgViews: number;
}

const yesterdayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleDateString("cs-CZ") };
};

const last30DaysRange = () => {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { start: start.toISOString(), end: end.toISOString() };
};

const leadTypeLabels: Record<string, { label: string; icon: any }> = {
  contact: { label: "Kontakt", icon: Inbox },
  vehicle: { label: "Poptávka vozu", icon: Car },
  service: { label: "Servis", icon: Wrench },
  trade: { label: "Výkup", icon: ShoppingBag },
  "trade-in": { label: "Výkup", icon: ShoppingBag },
  import: { label: "Dovoz", icon: Car },
  parts: { label: "Náhradní díly", icon: Wrench },
};

const AdminDailyReport = () => {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const yLabel = useMemo(() => yesterdayRange().label, []);

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (user.email !== ADMIN_EMAIL) return;

    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (lastShown === today) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const y = yesterdayRange();
        const m = last30DaysRange();

        const [leadsRes, vAddedRes, vSoldRes, yViewsRes, mViewsRes] = await Promise.all([
          supabase.from("leads").select("*").gte("created_at", y.start).lt("created_at", y.end),
          supabase.from("vehicles").select("id,name,status,updated_at,created_at").gte("created_at", y.start).lt("created_at", y.end),
          supabase.from("vehicles").select("id,name,status,updated_at,created_at").eq("status", "prodano").gte("updated_at", y.start).lt("updated_at", y.end),
          supabase.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", y.start).lt("created_at", y.end),
          supabase.from("page_views").select("id", { count: "exact", head: true }).gte("created_at", m.start).lt("created_at", m.end),
        ]);

        const leads = (leadsRes.data || []) as LeadRow[];
        const leadsByType: Record<string, LeadRow[]> = {};
        leads.forEach((l) => {
          const t = l.type || "contact";
          if (!leadsByType[t]) leadsByType[t] = [];
          leadsByType[t].push(l);
        });

        const yesterdayViews = yViewsRes.count || 0;
        const totalMonthly = mViewsRes.count || 0;
        const monthlyAvgViews = Math.round(totalMonthly / 30);

        if (!cancelled) {
          setData({
            leadsByType,
            totalLeads: leads.length,
            vehiclesAdded: (vAddedRes.data || []) as VehicleRow[],
            vehiclesSold: (vSoldRes.data || []) as VehicleRow[],
            yesterdayViews,
            monthlyAvgViews,
          });
          setOpen(true);
        }
      } catch (e) {
        console.error("[DailyReport] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, isAdmin]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString().slice(0, 10));
    setOpen(false);
  };

  if (!open || !data) return null;

  const diff = data.yesterdayViews - data.monthlyAvgViews;
  const diffPct = data.monthlyAvgViews > 0
    ? Math.round((diff / data.monthlyAvgViews) * 100)
    : 0;
  const trendUp = diff >= 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={dismiss}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 24 }}
          className="deep-card w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border/40 p-6 flex items-start justify-between z-10">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest mb-1">
                <Calendar className="w-3.5 h-3.5" />
                Denní přehled · {yLabel}
              </div>
              <h2 className="text-2xl font-bold text-foreground">Dobré ráno, šéfe</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Shrnutí včerejška a porovnání návštěvnosti.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Zavřít"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Inbox} label="Poptávky" value={data.totalLeads} accent="primary" />
              <StatCard icon={Car} label="Přidaná vozidla" value={data.vehiclesAdded.length} accent="primary" />
              <StatCard icon={ShoppingBag} label="Prodáno" value={data.vehiclesSold.length} accent="primary" />
              <StatCard icon={Eye} label="Návštěvy" value={data.yesterdayViews} accent="primary" />
            </div>

            {/* Traffic comparison */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                {trendUp ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
                <h3 className="font-semibold text-foreground">Návštěvnost vs. měsíční průměr</h3>
              </div>
              <div className="flex items-end gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Včera</p>
                  <p className="text-3xl font-bold text-foreground">{data.yesterdayViews}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Denní průměr (30 dní)</p>
                  <p className="text-3xl font-bold text-muted-foreground">{data.monthlyAvgViews}</p>
                </div>
                <div className={`text-right ml-auto ${trendUp ? "text-emerald-500" : "text-destructive"}`}>
                  <p className="text-xs uppercase tracking-wider opacity-80">Rozdíl</p>
                  <p className="text-2xl font-bold">
                    {trendUp ? "+" : ""}{diff}
                    <span className="text-base ml-1">({trendUp ? "+" : ""}{diffPct}%)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Leads by type */}
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                Poptávky včera ({data.totalLeads})
              </h3>
              {data.totalLeads === 0 ? (
                <p className="text-sm text-muted-foreground italic glass-card p-4">
                  Žádné poptávky za včerejšek.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.leadsByType).map(([type, leads]) => {
                    const meta = leadTypeLabels[type] || { label: type, icon: Inbox };
                    const Icon = meta.icon;
                    return (
                      <div key={type} className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <h4 className="font-semibold text-sm text-foreground">{meta.label}</h4>
                          <span className="text-xs text-muted-foreground">({leads.length})</span>
                        </div>
                        <ul className="space-y-1.5">
                          {leads.map((l) => (
                            <li key={l.id} className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2">
                              <span className="text-foreground font-medium">{l.name}</span>
                              {l.vehicle_model && <> · {l.vehicle_model}</>}
                              {l.phone && <> · {l.phone}</>}
                              {l.email && <> · {l.email}</>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vehicles changes */}
            {(data.vehiclesAdded.length > 0 || data.vehiclesSold.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {data.vehiclesAdded.length > 0 && (
                  <div className="glass-card p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Car className="w-4 h-4 text-primary" /> Nově přidaná
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {data.vehiclesAdded.map((v) => <li key={v.id}>· {v.name}</li>)}
                    </ul>
                  </div>
                )}
                {data.vehiclesSold.length > 0 && (
                  <div className="glass-card p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-primary" /> Prodaná
                    </h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {data.vehiclesSold.map((v) => <li key={v.id}>· {v.name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button onClick={dismiss} className="chrome-button w-full mt-4">
              Začít den
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: number; accent?: string }) => (
  <div className="glass-card p-3 text-center">
    <Icon className="w-5 h-5 text-primary mx-auto mb-1.5" />
    <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
  </div>
);

export default AdminDailyReport;

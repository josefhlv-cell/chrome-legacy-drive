import { useMemo, useState } from "react";
import {
  Globe, MapPin, LogOut, Timer, Layers, MousePointerClick,
  Smartphone, Tablet, Monitor, Clock, Users, UserPlus, Repeat, PhoneCall,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  useAnalytics, usePhoneClicks, computeStats, computeSiteInsights,
  computeVisitorStats, computePhoneClickStats, formatDuration,
} from "@/hooks/useAnalytics";

const Card = ({ title, icon: Icon, children, right }: {
  title: string; icon?: any; children: React.ReactNode; right?: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const Mini = ({ label, value, sub, icon: Icon }: { label: string; value: React.ReactNode; sub?: string; icon: any }) => (
  <div className="rounded-lg border border-border bg-background/40 p-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
    <p className="text-2xl font-semibold mt-1">{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

const Bar100 = ({ value }: { value: number }) => (
  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

const RANGES = [7, 30, 90] as const;

const shortDay = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7) + ".";

export default function SiteStatsSection() {
  const [days, setDays] = useState<number>(30);
  const { data: views = [], isLoading } = useAnalytics(days);
  const { data: phoneClicks = [] } = usePhoneClicks(days);

  const stats = useMemo(() => computeStats(views), [views]);
  const insights = useMemo(() => computeSiteInsights(views), [views]);
  const visitorStats = useMemo(() => computeVisitorStats(views), [views]);
  const phoneStats = useMemo(() => computePhoneClickStats(phoneClicks, views), [phoneClicks, views]);

  const hourly = stats?.hourlyViews ?? [];
  const peakHour = hourly.reduce((best, h) => (h.count > best.count ? h : best), { hour: 0, count: 0 });


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Statistiky webu
        </h2>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r} onClick={() => setDays(r)}
              className={`px-3 py-1 rounded-lg text-xs border transition ${
                days === r ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted"
              }`}>
              {r} dní
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Načítám statistiky…</p>}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Mini icon={Users} label="Unikátní návštěvníci" value={insights.sessionCount.toLocaleString("cs-CZ")}
          sub={`${views.length.toLocaleString("cs-CZ")} zobrazení stránek`} />
        <Mini icon={Timer} label="Průměrná návštěva" value={formatDuration(insights.avgSessionDuration)}
          sub={`${insights.avgDepth} stránek na návštěvu`} />
        <Mini icon={LogOut} label="Míra odchodů (bounce)" value={`${insights.bounceRate}%`}
          sub="Návštěvy s jedinou stránkou" />
        <Mini icon={Clock} label="Nejsilnější hodina" value={`${peakHour.hour}:00`}
          sub={`${peakHour.count} zobrazení`} />
      </div>

      {/* Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Odkud přišli návštěvníci" icon={Globe}>
          <div className="space-y-2 mb-4">
            {insights.groups.map(g => (
              <div key={g.group}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{g.group}</span>
                  <span className="text-muted-foreground tabular-nums">{g.count} · {g.share}%</span>
                </div>
                <Bar100 value={g.share} />
              </div>
            ))}
            {insights.groups.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádná data.</p>}
          </div>
          <ul className="divide-y divide-border max-h-56 overflow-y-auto">
            {insights.sources.slice(0, 12).map(s => (
              <li key={s.source} className="flex items-center justify-between py-2 text-xs gap-3">
                <span className="truncate">{s.source}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {s.sessions} návštěv · {formatDuration(s.avgTime)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Vstupní stránky (první proklik)" icon={MapPin}>
          <ul className="divide-y divide-border max-h-80 overflow-y-auto">
            {insights.landingPages.map(p => (
              <li key={p.path} className="flex items-center justify-between py-2 text-xs gap-3">
                <span className="truncate">{p.path}</span>
                <span className="shrink-0 tabular-nums text-primary font-medium">{p.count}</span>
              </li>
            ))}
            {insights.landingPages.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádná data.</p>}
          </ul>
        </Card>
      </div>

      {/* Dwell + exits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Kde se zákazník nejvíce zdrží" icon={Timer}>
          <ul className="divide-y divide-border max-h-80 overflow-y-auto">
            {insights.stickiestPages.map(p => (
              <li key={p.path} className="py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{p.path}</span>
                  <span className="shrink-0 tabular-nums font-medium text-emerald-500">{formatDuration(p.avgTime)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {p.visitors} návštěvníků · {p.views} zobrazení · celkem {formatDuration(p.totalTime)}
                </div>
              </li>
            ))}
            {insights.stickiestPages.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádná data.</p>}
          </ul>
        </Card>

        <Card title="Odkud odchází z webu" icon={LogOut}>
          <ul className="divide-y divide-border max-h-80 overflow-y-auto">
            {insights.exitPages.map(p => (
              <li key={p.path} className="py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{p.path}</span>
                  <span className="shrink-0 tabular-nums font-medium text-red-500">{p.exitRate}%</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {p.exits} odchodů · {p.visitors} návštěvníků
                </div>
              </li>
            ))}
            {insights.exitPages.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádná data.</p>}
          </ul>
        </Card>
      </div>

      {/* Pages + hourly + devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Nejnavštěvovanější stránky" icon={MousePointerClick}>
          <ul className="divide-y divide-border max-h-72 overflow-y-auto">
            {insights.topPages.map(p => (
              <li key={p.path} className="flex items-center justify-between py-2 text-xs gap-3">
                <span className="truncate">{p.path}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.views} · {formatDuration(p.avgTime)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Návštěvnost podle hodin" icon={Clock}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Zařízení" icon={Layers}>
        <div className="grid grid-cols-3 gap-3">
          <Mini icon={Smartphone} label="Mobil" value={stats?.devices.mobile ?? 0} />
          <Mini icon={Tablet} label="Tablet" value={stats?.devices.tablet ?? 0} />
          <Mini icon={Monitor} label="Desktop" value={stats?.devices.desktop ?? 0} />
        </div>
      </Card>
    </div>
  );
}

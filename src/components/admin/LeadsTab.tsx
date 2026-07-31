import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Car, MessageSquare, Calendar, Filter, Search, Download, Inbox, Wrench, Repeat, ShoppingBag, HelpCircle, Image as ImageIcon, Trash2, CheckSquare, Square } from "lucide-react";

type LeadType = "all" | "contact" | "service" | "trade-in" | "spare-parts" | "import" | "vehicle-inquiry" | "live-chat" | "other";

interface Lead {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  vehicle_model: string;
  message: string;
  metadata: any;
  created_at: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  contact: { label: "Kontakt", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  service: { label: "Servis", icon: <Wrench className="w-3.5 h-3.5" />, color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  "trade-in": { label: "Protiúčet", icon: <Repeat className="w-3.5 h-3.5" />, color: "bg-green-500/15 text-green-700 border-green-500/30" },
  "spare-parts": { label: "Náhradní díly", icon: <ShoppingBag className="w-3.5 h-3.5" />, color: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  import: { label: "Dovoz", icon: <Car className="w-3.5 h-3.5" />, color: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30" },
  "vehicle-inquiry": { label: "Dotaz na vozidlo", icon: <Car className="w-3.5 h-3.5" />, color: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30" },
  "live-chat": { label: "Živý chat", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "bg-teal-500/15 text-teal-700 border-teal-500/30" },
  other: { label: "Ostatní", icon: <HelpCircle className="w-3.5 h-3.5" />, color: "bg-gray-500/15 text-gray-700 border-gray-500/30" },
};

const typeMeta = (t: string) => TYPE_META[t] ?? { label: t || "—", icon: <HelpCircle className="w-3.5 h-3.5" />, color: "bg-gray-500/15 text-gray-700 border-gray-500/30" };

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const csvEscape = (v: any) => {
  const s = v == null ? "" : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function LeadsTab() {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<LeadType>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as Lead[];
    },
  });

  // Realtime new leads
  useEffect(() => {
    const ch = supabase
      .channel("admin-leads-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const l of leads) c[l.type] = (c[l.type] ?? 0) + 1;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      if (!q) return true;
      return (
        l.name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.vehicle_model?.toLowerCase().includes(q) ||
        l.message?.toLowerCase().includes(q)
      );
    });
  }, [leads, typeFilter, search]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((l) => next.delete(l.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((l) => next.add(l.id));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Opravdu smazat ${selected.size} označených poptávek? Tato akce je nevratná.`)) return;
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
      clearSelection();
      toast({ title: "Smazáno", description: `${ids.length} poptávek smazáno.` });
      refetch();
    } catch (e) {
      toast({ title: "Smazání selhalo", description: String(e), variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const exportSelectedCsv = () => {
    const rowsSrc = filtered.filter((l) => selected.has(l.id));
    if (rowsSrc.length === 0) return;
    const headers = ["Datum", "Typ", "Jméno", "Email", "Telefon", "Vozidlo / VIN", "Zpráva", "Metadata"];
    const rows = rowsSrc.map((l) => [
      formatDate(l.created_at), typeMeta(l.type).label, l.name, l.email, l.phone,
      l.vehicle_model, l.message, l.metadata ? JSON.stringify(l.metadata) : "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(csvEscape).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poptavky-oznacene-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const headers = ["Datum", "Typ", "Jméno", "Email", "Telefon", "Vozidlo / VIN", "Zpráva", "Metadata"];
    const rows = filtered.map((l) => [
      formatDate(l.created_at),
      typeMeta(l.type).label,
      l.name,
      l.email,
      l.phone,
      l.vehicle_model,
      l.message,
      l.metadata ? JSON.stringify(l.metadata) : "",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(csvEscape).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poptavky-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const types: LeadType[] = ["all", "contact", "service", "trade-in", "spare-parts", "import", "vehicle-inquiry", "other"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-heading text-xl flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            Doručené poptávky a dotazy
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Celkem <strong>{leads.length}</strong> záznamů · zobrazeno <strong>{filtered.length}</strong>
          </p>
        </div>
        <button onClick={exportCsv} className="outline-button inline-flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {types.map((t) => {
            const meta = t === "all" ? { label: "Vše", icon: <Filter className="w-3.5 h-3.5" />, color: "bg-primary/15 text-primary border-primary/30" } : typeMeta(t);
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                  active ? "bg-primary text-primary-foreground border-primary shadow-sm" : `${meta.color} hover:opacity-80`
                }`}
              >
                {meta.icon}
                {meta.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${active ? "bg-primary-foreground/20" : "bg-background/60"}`}>
                  {counts[t] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat podle jména, e-mailu, telefonu, vozidla nebo zprávy..."
            className="admin-input w-full pl-9"
          />
        </div>
      </div>

      {/* Bulk actions bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-sm">
          <button onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-background border border-border/40">
            {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allFilteredSelected ? "Odznačit vše" : "Označit vše"}
          </button>
          <span className="text-xs text-muted-foreground">
            Označeno: <strong>{selected.size}</strong> z {filtered.length}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={exportSelectedCsv} disabled={selected.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-border/40 text-xs hover:bg-background disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> Export CSV (označené)
            </button>
            <button onClick={bulkDelete} disabled={selected.size === 0 || deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" /> Smazat označené
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Načítání poptávek...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/40 rounded-lg">
          <Inbox className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Žádné poptávky neodpovídají filtru.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const meta = typeMeta(l.type);
            const isOpen = expanded.has(l.id);
            const photoCount = (l.metadata as any)?.photos;
            const isSel = selected.has(l.id);
            return (
              <div key={l.id} className={`border rounded-lg bg-card overflow-hidden transition ${isSel ? "border-primary/60 ring-1 ring-primary/30" : "border-border/40"}`}>
                <div className="w-full px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/30 transition">
                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(l.id); }}
                    className="shrink-0 p-1 -m-1 text-muted-foreground hover:text-foreground"
                    aria-label="Označit poptávku">
                    {isSel ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                  <button onClick={() => toggle(l.id)} className="flex-1 flex flex-wrap items-center gap-3 text-left min-w-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold ${meta.color}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="font-medium text-sm">{l.name || "—"}</span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(l.created_at)}
                  </span>
                  {l.vehicle_model && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Car className="w-3 h-3" />
                      {l.vehicle_model}
                    </span>
                  )}
                  {photoCount ? (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {photoCount} foto
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-primary">{isOpen ? "Skrýt" : "Detail"}</span>
                  </button>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/30 grid gap-3 sm:grid-cols-2 text-sm">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">E-mail</div>
                          {l.email ? (
                            <a href={`mailto:${l.email}`} className="text-primary hover:underline break-all">{l.email}</a>
                          ) : <span className="text-muted-foreground">—</span>}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Telefon</div>
                          {l.phone ? (
                            <a href={`tel:${l.phone}`} className="text-primary hover:underline">{l.phone}</a>
                          ) : <span className="text-muted-foreground">—</span>}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Car className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Vozidlo / VIN</div>
                          <span className="break-all">{l.vehicle_model || "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Zpráva</div>
                        <div className="bg-muted/40 rounded-md p-2 whitespace-pre-wrap text-sm min-h-[3rem]">
                          {l.message || <span className="text-muted-foreground">— bez zprávy —</span>}
                        </div>
                      </div>
                      {l.metadata && Object.keys(l.metadata).length > 0 && (
                        <div>
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Doplňující data</div>
                          <pre className="bg-muted/40 rounded-md p-2 text-[11px] overflow-x-auto">
{JSON.stringify(l.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground">ID: {l.id}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

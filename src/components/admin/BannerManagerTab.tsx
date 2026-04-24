import { useState } from "react";
import { Plus, Edit, Trash2, Save, X, Eye, EyeOff, Upload, Image as ImageIcon, Video, BarChart2, Monitor, Tablet, Smartphone, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useAllBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
  type Banner,
  type BannerInsert,
} from "@/hooks/useBanners";

const PAGE_OPTIONS = [
  { value: "home", label: "Úvod" },
  { value: "vehicles", label: "Vozidla" },
  { value: "service", label: "Servis" },
  { value: "spare-parts", label: "Náhradní díly" },
];

const POSITION_OPTIONS = [
  { value: "hero", label: "Top / Hero" },
  { value: "mid", label: "Mid-page" },
  { value: "footer", label: "Před patičkou" },
];

const LAYOUT_OPTIONS = [
  { value: "hero", label: "Full-Hero (široké)" },
  { value: "box", label: "Content Box" },
  { value: "sticky", label: "Sticky proužek" },
];

const emptyBanner: BannerInsert = {
  name: "",
  is_active: false,
  content_type: "image",
  media_url: "",
  link_url: "",
  headline: "",
  subheadline: "",
  cta_text: "",
  target_page: "home",
  target_position: "hero",
  layout_variant: "hero",
  show_desktop: true,
  show_tablet: true,
  show_mobile: true,
  styles: { overlayOpacity: 0.45, textColor: "#ffffff", align: "center", bgColor: "" } as any,
  start_date: null,
  end_date: null,
  sort_order: 0,
};

const BannerManagerTab = () => {
  const { toast } = useToast();
  const { data: banners, isLoading } = useAllBanners();
  const createMut = useCreateBanner();
  const updateMut = useUpdateBanner();
  const deleteMut = useDeleteBanner();

  const [editing, setEditing] = useState<Banner | BannerInsert | null>(null);
  const [uploading, setUploading] = useState(false);

  const isNew = editing && !("id" in editing);

  const handleUpload = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("banners").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      const isVideo = file.type.startsWith("video/");
      setEditing({ ...editing, media_url: data.publicUrl, content_type: isVideo ? "video" : "image" });
      toast({ title: "Médium nahráno" });
    } catch (e: any) {
      toast({ title: "Upload selhal", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) {
      toast({ title: "Vyplňte název banneru", variant: "destructive" });
      return;
    }
    try {
      if ("id" in editing && editing.id) {
        await updateMut.mutateAsync(editing as any);
      } else {
        await createMut.mutateAsync(editing as BannerInsert);
      }
      toast({ title: "Uloženo" });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Uložení selhalo", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (b: Banner) => {
    try {
      await updateMut.mutateAsync({ id: b.id, is_active: !b.is_active });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (b: Banner) => {
    if (!confirm(`Smazat banner "${b.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(b.id);
      toast({ title: "Smazáno" });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    }
  };

  const styles = ((editing?.styles as any) || {}) as Record<string, any>;
  const setStyle = (k: string, v: any) =>
    editing && setEditing({ ...editing, styles: { ...styles, [k]: v } as any });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-heading text-xl">Banner Manager</h2>
          <p className="text-xs text-muted-foreground mt-1">Marketingové bannery napříč webem. Drafty jsou neviditelné, zapneš je jediným přepínačem.</p>
        </div>
        <button onClick={() => setEditing({ ...emptyBanner })} className="chrome-button inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nový banner
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : banners && banners.length > 0 ? (
        <div className="grid gap-3">
          {banners.map((b) => (
            <div key={b.id} className="deep-card p-4 flex flex-wrap gap-4 items-center">
              <div className="w-24 h-16 bg-secondary rounded-md overflow-hidden flex items-center justify-center shrink-0">
                {b.content_type === "video" ? (
                  b.media_url ? <video src={b.media_url} muted className="w-full h-full object-cover" /> : <Video className="w-6 h-6 text-muted-foreground" />
                ) : b.media_url ? (
                  <img src={b.media_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground truncate">{b.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${b.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {b.is_active ? "Live" : "Draft"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {PAGE_OPTIONS.find(p => p.value === b.target_page)?.label} · {POSITION_OPTIONS.find(p => p.value === b.target_position)?.label} · {LAYOUT_OPTIONS.find(p => p.value === b.layout_variant)?.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><BarChart2 className="w-3 h-3" /> {b.impression_count} zobrazení</span>
                  <span>· {b.click_count} kliknutí</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(b)} className="outline-button p-2" title={b.is_active ? "Vypnout" : "Zapnout"}>
                  {b.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditing(b)} className="outline-button p-2"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(b)} className="outline-button p-2 text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Zatím žádné bannery. Vytvoř první kampaň.</p>
      )}

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="deep-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{isNew ? "Nový banner" : "Úprava banneru"}</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Název (interní)">
                <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="admin-input" />
              </Field>
              <Field label="Aktivní (Live)">
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <span className="text-xs text-muted-foreground">{editing.is_active ? "Zobrazuje se na webu" : "Pouze koncept"}</span>
                </div>
              </Field>

              <Field label="Cílová stránka">
                <select value={editing.target_page} onChange={(e) => setEditing({ ...editing, target_page: e.target.value })} className="admin-input">
                  {PAGE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Pozice">
                <select value={editing.target_position} onChange={(e) => setEditing({ ...editing, target_position: e.target.value })} className="admin-input">
                  {POSITION_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>

              <Field label="Layout">
                <select value={editing.layout_variant} onChange={(e) => setEditing({ ...editing, layout_variant: e.target.value as any })} className="admin-input">
                  {LAYOUT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Pořadí (sort)">
                <input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="admin-input" />
              </Field>

              <div className="md:col-span-2">
                <Field label="Médium (obrázek/video)">
                  <div className="flex items-center gap-3">
                    <label className="outline-button inline-flex items-center gap-2 cursor-pointer">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Nahrát soubor
                      <input type="file" accept="image/*,video/mp4,video/webm" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                    </label>
                    {editing.media_url && (
                      <a href={editing.media_url} target="_blank" rel="noreferrer" className="text-xs text-primary truncate max-w-xs">{editing.media_url}</a>
                    )}
                  </div>
                  {editing.media_url && (
                    <div className="mt-2 w-full max-w-md aspect-[16/7] bg-secondary rounded overflow-hidden">
                      {editing.content_type === "video" ? (
                        <video src={editing.media_url} muted autoPlay loop className="w-full h-full object-cover" />
                      ) : (
                        <img src={editing.media_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                </Field>
              </div>

              <Field label="Odkaz (URL)">
                <input value={editing.link_url || ""} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} placeholder="/vozidla nebo https://…" className="admin-input" />
              </Field>
              <Field label="Text tlačítka (CTA)">
                <input value={editing.cta_text || ""} onChange={(e) => setEditing({ ...editing, cta_text: e.target.value })} className="admin-input" />
              </Field>

              <Field label="Nadpis">
                <input value={editing.headline || ""} onChange={(e) => setEditing({ ...editing, headline: e.target.value })} className="admin-input" />
              </Field>
              <Field label="Podnadpis">
                <input value={editing.subheadline || ""} onChange={(e) => setEditing({ ...editing, subheadline: e.target.value })} className="admin-input" />
              </Field>

              <Field label="Barva textu">
                <input type="color" value={styles.textColor || "#ffffff"} onChange={(e) => setStyle("textColor", e.target.value)} className="admin-input h-9" />
              </Field>
              <Field label="Tmavost překryvu (0–1)">
                <input type="number" min={0} max={1} step={0.05} value={styles.overlayOpacity ?? 0.45} onChange={(e) => setStyle("overlayOpacity", Number(e.target.value))} className="admin-input" />
              </Field>

              <Field label="Zarovnání textu">
                <select value={styles.align || "center"} onChange={(e) => setStyle("align", e.target.value)} className="admin-input">
                  <option value="left">Vlevo</option>
                  <option value="center">Na střed</option>
                  <option value="right">Vpravo</option>
                </select>
              </Field>
              <Field label="Pozadí (sticky proužek)">
                <input type="color" value={styles.bgColor || "#0f1d3a"} onChange={(e) => setStyle("bgColor", e.target.value)} className="admin-input h-9" />
              </Field>

              <Field label="Začátek kampaně">
                <input type="datetime-local" value={editing.start_date ? editing.start_date.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })} className="admin-input" />
              </Field>
              <Field label="Konec kampaně">
                <input type="datetime-local" value={editing.end_date ? editing.end_date.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} className="admin-input" />
              </Field>

              <div className="md:col-span-2">
                <Field label="Viditelnost na zařízení">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={!!editing.show_desktop} onCheckedChange={(v) => setEditing({ ...editing, show_desktop: v })} /> <Monitor className="w-4 h-4" /> Desktop</label>
                    <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={!!editing.show_tablet} onCheckedChange={(v) => setEditing({ ...editing, show_tablet: v })} /> <Tablet className="w-4 h-4" /> Tablet</label>
                    <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={!!editing.show_mobile} onCheckedChange={(v) => setEditing({ ...editing, show_mobile: v })} /> <Smartphone className="w-4 h-4" /> Mobil</label>
                  </div>
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="outline-button">Zrušit</button>
              <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="chrome-button inline-flex items-center gap-2">
                <Save className="w-4 h-4" /> Uložit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">{label}</label>
    {children}
  </div>
);

export default BannerManagerTab;

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings, Shield, Leaf, Video, Receipt, Award, Eye, EyeOff,
  Plus, Trash2, Edit, Save, X, LogIn, LogOut, QrCode, Download,
  ImagePlus, Images, RefreshCw, Phone, Mail, MapPin, Clock,
  Type, Camera, Car, ShoppingBag, Loader2
} from "lucide-react";
import { SyncProgressOverlay } from "@/components/SyncProgressOverlay";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, type DbVehicle } from "@/hooks/useVehicles";
import { formatPrice, statusLabels } from "@/data/vehicles";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useVehicleImages, useAddVehicleImage, useDeleteVehicleImage, useSetMainImage } from "@/hooks/useVehicleImages";
import {
  useSiteContacts, useUpdateContact,
  useTickerItems, useCreateTickerItem, useUpdateTickerItem, useDeleteTickerItem,
  useFacilityPhotos, useAddFacilityPhoto, useDeleteFacilityPhoto,
  useScrapeLog,
} from "@/hooks/useAdminContent";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import logoPardubice from "@/assets/logo-pardubice.webp";

type VehicleStatus = "skladem" | "na-ceste" | "rezervovano" | "prodano";
type AdminTab = "vehicles" | "scrape" | "contacts" | "ticker" | "facility";

const statusStylesMap: Record<VehicleStatus, string> = {
  skladem: "status-skladem",
  "na-ceste": "status-na-ceste",
  rezervovano: "status-rezervovano",
  prodano: "status-prodano",
};

const emptyVehicle: TablesInsert<"vehicles"> = {
  name: "", year: new Date().getFullYear(), price_with_vat: 0, mileage: 0, vin: "",
  fuel: "Benzín", image_url: "", status: "skladem", show_vat: false,
  carfax_enabled: false, carfax_url: "", lpg_enabled: false, lpg_description: "",
  video_enabled: false, video_id: "", warranty_enabled: false,
  engine: "", transmission: "", power: "", color: "", description: "",
};

const SITE_URL = "https://chryslerpardubice.site";

const tabConfig: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: "vehicles", label: "Vozidla", icon: <Car className="w-4 h-4" /> },
  { key: "scrape", label: "Aktualizace", icon: <RefreshCw className="w-4 h-4" /> },
  { key: "contacts", label: "Kontakty", icon: <Phone className="w-4 h-4" /> },
  { key: "ticker", label: "Novinky", icon: <Type className="w-4 h-4" /> },
  { key: "facility", label: "Zázemí", icon: <Camera className="w-4 h-4" /> },
];

const AdminPage = () => {
  const { user, isAdmin, loading: authLoading, signIn, signOut } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>("vehicles");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast({ title: "Přihlášeno" });
    } catch (err: any) {
      toast({ title: "Chyba přihlášení", description: err.message, variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Načítání...</p></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="deep-card p-8 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-6">
              <LogIn className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground uppercase tracking-wider">Admin přihlášení</h1>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">E-mail</label>
                <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Heslo</label>
                <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <button type="submit" disabled={loginLoading} className="chrome-button w-full">{loginLoading ? "Přihlašuji..." : "Přihlásit se"}</button>
            </form>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 container mx-auto px-4 text-center">
          <p className="text-destructive text-lg font-semibold">Nemáte oprávnění pro přístup k administraci.</p>
          <button onClick={signOut} className="outline-button mt-4 inline-flex items-center gap-2"><LogOut className="w-4 h-4" /> Odhlásit se</button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={logoPardubice} alt="Admin" className="h-14 w-auto drop-shadow-lg" />
              <div>
                <h1 className="section-heading text-2xl">Administrace</h1>
                <p className="text-xs text-muted-foreground">{user.email} · Autorizovaný přístup</p>
              </div>
            </div>
            <button onClick={signOut} className="outline-button inline-flex items-center gap-2 text-sm"><LogOut className="w-4 h-4" /> Odhlásit</button>
          </motion.div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 mb-6 border-b border-border/30">
            {tabConfig.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`admin-tab inline-flex items-center gap-2 ${activeTab === tab.key ? "active" : ""}`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "vehicles" && <VehiclesTab />}
          {activeTab === "scrape" && <ScrapeTab />}
          {activeTab === "contacts" && <ContactsTab />}
          {activeTab === "ticker" && <TickerTab />}
          {activeTab === "facility" && <FacilityTab />}
        </div>
      </div>
      <Footer />
    </div>
  );
};

// ════════════════════════════════════════════════════
// VEHICLES TAB
// ════════════════════════════════════════════════════
const VehiclesTab = () => {
  const { data: vehicles, isLoading } = useVehicles(true);
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<TablesUpdate<"vehicles">>({});
  const [showNew, setShowNew] = useState(false);
  const [newData, setNewData] = useState<TablesInsert<"vehicles">>(emptyVehicle);
  const [qrVehicleId, setQrVehicleId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [galleryVehicleId, setGalleryVehicleId] = useState<string | null>(null);
  const addImage = useAddVehicleImage();
  const deleteImage = useDeleteVehicleImage();
  const setMainImage = useSetMainImage();

  const handleToggle = (vehicle: DbVehicle, field: keyof DbVehicle, value: any) => {
    updateVehicle.mutate({ id: vehicle.id, updates: { [field]: value } as TablesUpdate<"vehicles"> });
  };

  const startEdit = (v: DbVehicle) => {
    setEditingId(v.id);
    setEditData({ name: v.name, year: v.year, price_with_vat: v.price_with_vat, mileage: v.mileage, vin: v.vin, fuel: v.fuel, image_url: v.image_url, engine: v.engine, transmission: v.transmission, power: v.power, color: v.color, description: v.description, carfax_url: v.carfax_url, lpg_description: v.lpg_description, video_id: v.video_id });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateVehicle.mutate({ id: editingId, updates: editData }, {
      onSuccess: () => { setEditingId(null); toast({ title: "Uloženo" }); },
    });
  };

  const handleCreate = () => {
    if (!newData.name || !newData.price_with_vat) {
      toast({ title: "Vyplňte název a cenu", variant: "destructive" });
      return;
    }
    createVehicle.mutate(newData, {
      onSuccess: () => { setShowNew(false); setNewData(emptyVehicle); toast({ title: "Vůz přidán" }); },
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Opravdu smazat "${name}"?`)) return;
    deleteVehicle.mutate(id, { onSuccess: () => toast({ title: "Smazáno" }) });
  };

  const handleSell = (vehicle: DbVehicle) => {
    if (!confirm(`Označit "${vehicle.name}" jako prodáno?`)) return;
    updateVehicle.mutate({ id: vehicle.id, updates: { status: "prodano" as const } }, {
      onSuccess: () => toast({ title: `${vehicle.name} označeno jako prodáno` }),
    });
  };

  const handlePhotoUpload = async (vehicleId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingFor(vehicleId);
    try {
      for (const file of Array.from(files)) {
        await addImage.mutateAsync({ vehicleId, file });
      }
      toast({ title: `${files.length} foto nahráno` });
    } catch (err: any) {
      toast({ title: "Chyba nahrávání", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFor(null);
    }
  };

  const downloadQR = (vehicleId: string, vehicleName: string) => {
    const svg = document.getElementById(`qr-${vehicleId}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 400, 400);
      const link = document.createElement("a");
      link.download = `QR-${vehicleName.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-foreground uppercase tracking-wider">Správa vozidel</h2>
        <button onClick={() => setShowNew(true)} className="chrome-button inline-flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Přidat vůz</button>
      </div>

      {showNew && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="deep-card p-6 mb-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Nový vůz</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField label="Název *" value={newData.name || ""} onChange={(v) => setNewData({ ...newData, name: v })} />
            <InputField label="Rok *" type="number" value={String(newData.year)} onChange={(v) => setNewData({ ...newData, year: Number(v) })} />
            <InputField label="Cena s DPH *" type="number" value={String(newData.price_with_vat)} onChange={(v) => setNewData({ ...newData, price_with_vat: Number(v) })} />
            <InputField label="Nájezd (km)" type="number" value={String(newData.mileage || 0)} onChange={(v) => setNewData({ ...newData, mileage: Number(v) })} />
            <InputField label="VIN" value={newData.vin || ""} onChange={(v) => setNewData({ ...newData, vin: v })} />
            <InputField label="Palivo" value={newData.fuel || ""} onChange={(v) => setNewData({ ...newData, fuel: v })} />
            <InputField label="URL obrázku" value={newData.image_url || ""} onChange={(v) => setNewData({ ...newData, image_url: v })} />
            <InputField label="Motor" value={newData.engine || ""} onChange={(v) => setNewData({ ...newData, engine: v })} />
            <InputField label="Převodovka" value={newData.transmission || ""} onChange={(v) => setNewData({ ...newData, transmission: v })} />
            <InputField label="Výkon" value={newData.power || ""} onChange={(v) => setNewData({ ...newData, power: v })} />
            <InputField label="Barva" value={newData.color || ""} onChange={(v) => setNewData({ ...newData, color: v })} />
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Popis</label>
              <textarea value={newData.description || ""} onChange={(e) => setNewData({ ...newData, description: e.target.value })} rows={2} className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} className="chrome-button inline-flex items-center gap-2 text-sm"><Save className="w-4 h-4" /> Uložit</button>
            <button onClick={() => { setShowNew(false); setNewData(emptyVehicle); }} className="outline-button inline-flex items-center gap-2 text-sm"><X className="w-4 h-4" /> Zrušit</button>
          </div>
        </motion.div>
      )}

      {isLoading && <p className="text-muted-foreground text-center py-10">Načítání...</p>}

      <div className="space-y-4">
        {vehicles?.map((vehicle) => (
          <motion.div key={vehicle.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <div className="flex flex-col lg:flex-row gap-4">
              {vehicle.image_url && (
                <img src={vehicle.image_url} alt={vehicle.name} className="w-full lg:w-44 h-28 object-cover rounded-md" loading="lazy" />
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground normal-case">{vehicle.name}</h3>
                    <p className="text-xs text-muted-foreground">{vehicle.year} · {vehicle.vin}</p>
                    <p className="text-lg font-bold text-primary mt-1">{formatPrice(vehicle.price_with_vat)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={vehicle.status}
                      onChange={(e) => handleToggle(vehicle, "status", e.target.value)}
                      className={`${statusStylesMap[vehicle.status as VehicleStatus]} text-xs font-semibold px-2.5 py-1 rounded-full bg-transparent`}
                    >
                      {(Object.keys(statusLabels) as VehicleStatus[]).map((s) => (
                        <option key={s} value={s} className="bg-card text-foreground">{statusLabels[s]}</option>
                      ))}
                    </select>
                    {vehicle.status !== "prodano" && (
                      <button onClick={() => handleSell(vehicle)} className="p-1.5 text-muted-foreground hover:text-amber-400 transition-colors" title="Prodat">
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setQrVehicleId(qrVehicleId === vehicle.id ? null : vehicle.id)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="QR">
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button onClick={() => editingId === vehicle.id ? setEditingId(null) : startEdit(vehicle)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(vehicle.id, vehicle.name)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {qrVehicleId === vehicle.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 p-4 bg-foreground rounded-lg flex flex-col items-center gap-2">
                    <QRCodeSVG id={`qr-${vehicle.id}`} value={`${SITE_URL}/vozidla/${vehicle.id}`} size={200} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin />
                    <p className="text-xs text-background/60">{SITE_URL}/vozidla/{vehicle.id}</p>
                    <div className="flex gap-2">
                      <button onClick={() => downloadQR(vehicle.id, vehicle.name)} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md flex items-center gap-1.5"><Download className="w-3 h-3" /> PNG</button>
                      <button onClick={() => setQrVehicleId(null)} className="text-xs text-background/60 hover:text-background px-3 py-1.5">Zavřít</button>
                    </div>
                  </motion.div>
                )}

                {editingId === vehicle.id && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <InputField label="Název" value={editData.name || ""} onChange={(v) => setEditData({ ...editData, name: v })} />
                    <InputField label="Rok" type="number" value={String(editData.year || "")} onChange={(v) => setEditData({ ...editData, year: Number(v) })} />
                    <InputField label="Cena" type="number" value={String(editData.price_with_vat || "")} onChange={(v) => setEditData({ ...editData, price_with_vat: Number(v) })} />
                    <InputField label="Nájezd" type="number" value={String(editData.mileage || "")} onChange={(v) => setEditData({ ...editData, mileage: Number(v) })} />
                    <InputField label="VIN" value={editData.vin || ""} onChange={(v) => setEditData({ ...editData, vin: v })} />
                    <InputField label="Palivo" value={editData.fuel || ""} onChange={(v) => setEditData({ ...editData, fuel: v })} />
                    <InputField label="URL obrázku" value={editData.image_url || ""} onChange={(v) => setEditData({ ...editData, image_url: v })} />
                    <InputField label="Motor" value={editData.engine || ""} onChange={(v) => setEditData({ ...editData, engine: v })} />
                    <InputField label="Převodovka" value={editData.transmission || ""} onChange={(v) => setEditData({ ...editData, transmission: v })} />
                    <InputField label="Výkon" value={editData.power || ""} onChange={(v) => setEditData({ ...editData, power: v })} />
                    <InputField label="Barva" value={editData.color || ""} onChange={(v) => setEditData({ ...editData, color: v })} />
                    <InputField label="Carfax URL" value={editData.carfax_url || ""} onChange={(v) => setEditData({ ...editData, carfax_url: v })} />
                    <InputField label="LPG popis" value={editData.lpg_description || ""} onChange={(v) => setEditData({ ...editData, lpg_description: v })} />
                    <InputField label="Video ID" value={editData.video_id || ""} onChange={(v) => setEditData({ ...editData, video_id: v })} />
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Popis</label>
                      <textarea value={editData.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={2} className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none" />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
                      <button onClick={saveEdit} className="chrome-button inline-flex items-center gap-2 text-sm"><Save className="w-4 h-4" /> Uložit</button>
                      <button onClick={() => setEditingId(null)} className="outline-button inline-flex items-center gap-2 text-sm"><X className="w-4 h-4" /> Zrušit</button>
                    </div>
                  </motion.div>
                )}

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <ToggleItem icon={<Receipt className="w-3.5 h-3.5 text-primary" />} label="DPH" checked={vehicle.show_vat} onChange={(v) => handleToggle(vehicle, "show_vat", v)} />
                  <ToggleItem icon={<Shield className="w-3.5 h-3.5 text-primary" />} label="Carfax" checked={vehicle.carfax_enabled} onChange={(v) => handleToggle(vehicle, "carfax_enabled", v)} />
                  <ToggleItem icon={<Leaf className="w-3.5 h-3.5 text-emerald-400" />} label="LPG" checked={vehicle.lpg_enabled} onChange={(v) => handleToggle(vehicle, "lpg_enabled", v)} />
                  <ToggleItem icon={<Video className="w-3.5 h-3.5 text-primary" />} label="Video" checked={vehicle.video_enabled} onChange={(v) => handleToggle(vehicle, "video_enabled", v)} />
                  <ToggleItem icon={<Award className="w-3.5 h-3.5 text-gold" />} label="Záruka" checked={vehicle.warranty_enabled} onChange={(v) => handleToggle(vehicle, "warranty_enabled", v)} />
                  <div className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                    <div className="flex items-center gap-1.5 text-xs">
                      {vehicle.status === "prodano" ? <EyeOff className="w-3.5 h-3.5 text-destructive" /> : <Eye className="w-3.5 h-3.5 text-primary" />}
                      <span className="text-muted-foreground">{vehicle.status === "prodano" ? "Skryto" : "Viditelné"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="file" accept="image/*" multiple className="hidden" id={`file-${vehicle.id}`} onChange={(e) => handlePhotoUpload(vehicle.id, e.target.files)} />
                  <button onClick={() => document.getElementById(`file-${vehicle.id}`)?.click()} disabled={uploadingFor === vehicle.id} className="outline-button inline-flex items-center gap-1.5 text-xs !px-3 !py-2">
                    <ImagePlus className="w-3.5 h-3.5" />{uploadingFor === vehicle.id ? "Nahrávám..." : "Fotky"}
                  </button>
                  <button onClick={() => setGalleryVehicleId(galleryVehicleId === vehicle.id ? null : vehicle.id)} className="outline-button inline-flex items-center gap-1.5 text-xs !px-3 !py-2">
                    <Images className="w-3.5 h-3.5" />Galerie
                  </button>
                </div>

                {galleryVehicleId === vehicle.id && (
                  <VehicleGalleryManager
                    vehicleId={vehicle.id}
                    onDeleteImage={(id) => deleteImage.mutate({ id, vehicleId: vehicle.id })}
                    onSetMain={(id, url) => setMainImage.mutate({ id, vehicleId: vehicle.id, imageUrl: url })}
                  />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {vehicles?.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground py-20">Žádná vozidla.</p>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════
// SCRAPE TAB
// ════════════════════════════════════════════════════
const ScrapeTab = () => {
  const { toast } = useToast();
  const { data: logs } = useScrapeLog();
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const startScrape = async () => {
    setScraping(true);
    setProgress(10);
    setStatusText("Vytváření záznamu...");

    try {
      // Create log entry
      const { data: logEntry, error: logErr } = await supabase
        .from("scrape_log")
        .insert({ triggered_by: "manual", status: "starting" })
        .select("id")
        .single();

      if (logErr) throw logErr;

      setProgress(25);
      setStatusText("Scrapuji chrysler.cz...");

      const { data, error } = await supabase.functions.invoke("scrape-vehicles", {
        body: { log_id: logEntry?.id },
      });

      if (error) throw error;

      setProgress(90);
      setStatusText("Dokončuji...");

      setTimeout(() => {
        setProgress(100);
        setStatusText(`Hotovo! Nalezeno ${data?.vehicles_found || 0} vozidel, aktualizováno ${data?.vehicles_updated || 0}.`);
        toast({
          title: "Aktualizace dokončena",
          description: `${data?.vehicles_updated || 0} vozidel aktualizováno, ${data?.images_downloaded || 0} fotek staženo.`,
        });
        setScraping(false);
      }, 500);
    } catch (err: any) {
      setStatusText(`Chyba: ${err.message}`);
      toast({ title: "Chyba aktualizace", description: err.message, variant: "destructive" });
      setScraping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="deep-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className={`w-6 h-6 text-primary ${scraping ? "animate-spin" : ""}`} />
          <div>
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wider">Aktualizace nabídky vozidel</h2>
            <p className="text-xs text-muted-foreground">Stáhne aktuální nabídku a fotky z chrysler.cz</p>
          </div>
        </div>

        <button onClick={startScrape} disabled={scraping} className="gold-button inline-flex items-center gap-2 mb-4">
          {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scraping ? "Probíhá aktualizace..." : "Aktualizovat nabídku vozidel"}
        </button>

        {(scraping || statusText) && (
          <div className="space-y-2">
            <Progress value={progress} className="h-3" />
            <p className="text-xs text-muted-foreground">{statusText}</p>
          </div>
        )}
      </div>

      <div className="deep-card p-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Historie aktualizací</h3>
        {logs?.length === 0 && <p className="text-xs text-muted-foreground">Zatím žádné aktualizace.</p>}
        <div className="space-y-2">
          {logs?.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-secondary/30 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                log.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                log.status === "error" ? "bg-red-500/20 text-red-400" :
                "bg-blue-500/20 text-blue-400"
              }`}>{log.status}</span>
              <span className="text-muted-foreground">{new Date(log.started_at).toLocaleString("cs-CZ")}</span>
              <span className="text-foreground">{log.vehicles_found} nalezeno · {log.vehicles_updated} aktualizováno · {log.images_downloaded} fotek</span>
              {log.error_message && <span className="text-destructive">{log.error_message}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Automatická aktualizace:</strong> Nabídka se automaticky synchronizuje 1× denně. Můžete také spustit aktualizaci ručně tlačítkem výše.
        </p>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════
// CONTACTS TAB
// ════════════════════════════════════════════════════
const ContactsTab = () => {
  const { data: contacts, isLoading } = useSiteContacts();
  const updateContact = useUpdateContact();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const fields = [
    { key: "phone", label: "Telefon", icon: <Phone className="w-4 h-4 text-primary" /> },
    { key: "email", label: "E-mail", icon: <Mail className="w-4 h-4 text-primary" /> },
    { key: "address", label: "Adresa", icon: <MapPin className="w-4 h-4 text-primary" /> },
    { key: "hours_weekday", label: "Pracovní doba (Po-Pá)", icon: <Clock className="w-4 h-4 text-primary" /> },
    { key: "hours_weekend", label: "Víkend", icon: <Clock className="w-4 h-4 text-muted-foreground" /> },
  ];

  const handleSave = (key: string) => {
    updateContact.mutate({ key, value: editing[key] }, {
      onSuccess: () => {
        toast({ title: "Kontakt aktualizován" });
        setEditing((prev) => { const next = { ...prev }; delete next[key]; return next; });
      },
    });
  };

  if (isLoading) return <p className="text-muted-foreground">Načítání...</p>;

  return (
    <div className="deep-card p-6">
      <h2 className="text-lg font-bold text-foreground uppercase tracking-wider mb-6">Správa kontaktů</h2>
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-md bg-secondary/30">
            <div className="flex items-center gap-2 min-w-[180px]">
              {f.icon}
              <span className="text-sm font-semibold text-foreground">{f.label}</span>
            </div>
            {editing[f.key] !== undefined ? (
              <div className="flex-1 flex gap-2 w-full">
                <input
                  value={editing[f.key]}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  className="flex-1 bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
                <button onClick={() => handleSave(f.key)} className="chrome-button !px-4 !py-2 text-xs"><Save className="w-3 h-3" /></button>
                <button onClick={() => setEditing((prev) => { const next = { ...prev }; delete next[f.key]; return next; })} className="outline-button !px-4 !py-2 text-xs"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between gap-2 w-full">
                <span className="text-sm text-muted-foreground">{contacts?.[f.key] || "–"}</span>
                <button onClick={() => setEditing({ ...editing, [f.key]: contacts?.[f.key] || "" })} className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════
// TICKER TAB
// ════════════════════════════════════════════════════
const TickerTab = () => {
  const { data: items, isLoading } = useTickerItems();
  const createItem = useCreateTickerItem();
  const updateItem = useUpdateTickerItem();
  const deleteItem = useDeleteTickerItem();
  const { toast } = useToast();
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    createItem.mutate(newText.trim(), {
      onSuccess: () => { setNewText(""); toast({ title: "Novinka přidána" }); },
    });
  };

  const handleSave = (id: string) => {
    updateItem.mutate({ id, text: editText }, {
      onSuccess: () => { setEditingId(null); toast({ title: "Uloženo" }); },
    });
  };

  return (
    <div className="deep-card p-6">
      <h2 className="text-lg font-bold text-foreground uppercase tracking-wider mb-2">Pohyblivý text s novinkami</h2>
      <p className="text-xs text-muted-foreground mb-6">Tyto texty se zobrazují v běžícím pásu na hlavní stránce.</p>

      <div className="flex gap-2 mb-6">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Nová novinka..."
          className="flex-1 bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd} className="chrome-button !px-4 text-xs"><Plus className="w-4 h-4" /></button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Načítání...</p>}
      <div className="space-y-2">
        {items?.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/30">
            <Switch checked={item.is_active} onCheckedChange={(v) => updateItem.mutate({ id: item.id, is_active: v })} />
            {editingId === item.id ? (
              <div className="flex-1 flex gap-2">
                <input value={editText} onChange={(e) => setEditText(e.target.value)} className="flex-1 bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                <button onClick={() => handleSave(item.id)} className="p-1.5 text-primary"><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <span className={`flex-1 text-sm ${item.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>{item.text}</span>
                <button onClick={() => { setEditingId(item.id); setEditText(item.text); }} className="p-1.5 text-muted-foreground hover:text-primary"><Edit className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm("Smazat?")) deleteItem.mutate(item.id); }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════
// FACILITY TAB
// ════════════════════════════════════════════════════
const FacilityTab = () => {
  const { data: photos, isLoading } = useFacilityPhotos();
  const addPhoto = useAddFacilityPhoto();
  const deletePhoto = useDeleteFacilityPhoto();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await addPhoto.mutateAsync({ file, caption: caption || file.name });
      }
      toast({ title: "Fotky nahrány" });
      setCaption("");
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="deep-card p-6">
      <h2 className="text-lg font-bold text-foreground uppercase tracking-wider mb-2">Fotky zázemí</h2>
      <p className="text-xs text-muted-foreground mb-6">Fotografie zobrazené v sekci „Naše zázemí" na stránce O nás.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Popisek fotky..." className="flex-1 min-w-[200px] bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
        <input type="file" accept="image/*" multiple className="hidden" ref={fileRef} onChange={(e) => handleUpload(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="chrome-button inline-flex items-center gap-2 text-xs">
          <ImagePlus className="w-4 h-4" />{uploading ? "Nahrávám..." : "Nahrát fotky"}
        </button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Načítání...</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos?.map((photo) => (
          <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-border">
            <img src={photo.image_url} alt={photo.alt_text} className="w-full h-32 object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
              <p className="text-xs text-white px-2 text-center">{photo.caption}</p>
              <button onClick={() => { if (confirm("Smazat?")) deletePhoto.mutate(photo.id); }} className="text-xs text-white bg-destructive/80 px-2 py-1 rounded">Smazat</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════
const InputField = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
  </div>
);

const ToggleItem = ({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
    <div className="flex items-center gap-1.5 text-xs">
      {icon}
      <span className="text-muted-foreground">{label}</span>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const VehicleGalleryManager = ({ vehicleId, onDeleteImage, onSetMain }: { vehicleId: string; onDeleteImage: (id: string) => void; onSetMain: (id: string, url: string) => void }) => {
  const { data: images, isLoading } = useVehicleImages(vehicleId);

  if (isLoading) return <p className="text-xs text-muted-foreground mt-2">Načítání...</p>;
  if (!images || images.length === 0) return <p className="text-xs text-muted-foreground mt-2">Žádné fotky.</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
      <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Galerie ({images.length})</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {images.map((img) => (
          <div key={img.id} className={`relative group rounded-md overflow-hidden border-2 ${img.is_main ? "border-primary" : "border-border"}`}>
            <img src={img.image_url} alt="" className="w-full h-14 object-cover" loading="lazy" />
            {img.is_main && <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[8px] px-1 font-bold">HLAVNÍ</div>}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              {!img.is_main && <button onClick={() => onSetMain(img.id, img.image_url)} className="text-[9px] text-white bg-primary/80 px-1 py-0.5 rounded">★</button>}
              <button onClick={() => onDeleteImage(img.id)} className="text-[9px] text-white bg-destructive/80 px-1 py-0.5 rounded">✕</button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default AdminPage;

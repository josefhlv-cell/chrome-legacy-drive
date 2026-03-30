import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Shield, Leaf, Video, Receipt, Award, Eye, EyeOff, Plus, Trash2, Edit, Save, X, LogIn, LogOut, QrCode, Download, ImagePlus, Images } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, type DbVehicle } from "@/hooks/useVehicles";
import { formatPrice, statusLabels } from "@/data/vehicles";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useVehicleImages, useAddVehicleImage, useDeleteVehicleImage, useSetMainImage } from "@/hooks/useVehicleImages";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import logoPardubice from "@/assets/logo-pardubice.png";

type VehicleStatus = "skladem" | "na-ceste" | "rezervovano" | "prodano";

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

const AdminPage = () => {
  const { user, isAdmin, loading: authLoading, signIn, signOut } = useAuth();
  const { data: vehicles, isLoading } = useVehicles(true);
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const { toast } = useToast();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

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
    deleteVehicle.mutate(id, {
      onSuccess: () => toast({ title: "Smazáno" }),
    });
  };

  const handlePrintQR = (vehicleId: string) => {
    setQrVehicleId(vehicleId);
  };

  const handlePhotoUpload = async (vehicleId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingFor(vehicleId);
    try {
      for (const file of Array.from(files)) {
        await addImage.mutateAsync({ vehicleId, file });
      }
      toast({ title: `${files.length} foto nahráno a přiřazeno k vozu` });
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
    canvas.width = 400;
    canvas.height = 400;
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

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Načítání...</p></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 w-full max-w-sm">
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={logoPardubice} alt="Autorizovaný přístup" className="h-14 w-auto drop-shadow-lg" />
              <div>
                <h1 className="section-heading text-2xl">Správa vozidel</h1>
                <p className="text-xs text-muted-foreground">{user.email} · Autorizovaný přístup</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowNew(true)} className="chrome-button inline-flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Přidat vůz</button>
              <button onClick={signOut} className="outline-button inline-flex items-center gap-2 text-sm"><LogOut className="w-4 h-4" /> Odhlásit</button>
            </div>
          </motion.div>

          {showNew && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Nový vůz</h2>
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

          {isLoading && <p className="text-muted-foreground text-center py-10">Načítání vozidel...</p>}

          <div className="space-y-6">
            {vehicles?.map((vehicle) => (
              <motion.div key={vehicle.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {vehicle.image_url && (
                    <img src={vehicle.image_url} alt={vehicle.name} className="w-full lg:w-48 h-32 object-cover rounded-md" loading="lazy" />
                  )}

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground normal-case">{vehicle.name}</h3>
                        <p className="text-sm text-muted-foreground">{vehicle.year} · {vehicle.vin}</p>
                        <p className="text-lg font-bold text-primary mt-1">{formatPrice(vehicle.price_with_vat)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={vehicle.status}
                          onChange={(e) => handleToggle(vehicle, "status", e.target.value)}
                          className={`${statusStylesMap[vehicle.status as VehicleStatus]} text-xs font-semibold px-3 py-1.5 rounded-full bg-transparent`}
                        >
                          {(Object.keys(statusLabels) as VehicleStatus[]).map((s) => (
                            <option key={s} value={s} className="bg-card text-foreground">{statusLabels[s]}</option>
                          ))}
                        </select>
                        <button onClick={() => handlePrintQR(vehicle.id)} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="QR kód pro tisk">
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button onClick={() => editingId === vehicle.id ? setEditingId(null) : startEdit(vehicle)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(vehicle.id, vehicle.name)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* QR Code Modal */}
                    {qrVehicleId === vehicle.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 p-4 bg-foreground rounded-lg flex flex-col items-center gap-3">
                        <p className="text-xs text-background font-semibold uppercase tracking-wider">QR kód pro tisk — {vehicle.name}</p>
                        <QRCodeSVG
                          id={`qr-${vehicle.id}`}
                          value={`${SITE_URL}/vozidla/${vehicle.id}`}
                          size={200}
                          bgColor="#ffffff"
                          fgColor="#000000"
                          level="H"
                          includeMargin
                        />
                        <p className="text-xs text-background/60">{SITE_URL}/vozidla/{vehicle.id}</p>
                        <div className="flex gap-2">
                          <button onClick={() => downloadQR(vehicle.id, vehicle.name)} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md flex items-center gap-1.5">
                            <Download className="w-3 h-3" /> Stáhnout PNG
                          </button>
                          <button onClick={() => setQrVehicleId(null)} className="text-xs text-background/60 hover:text-background px-3 py-1.5">
                            Zavřít
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {editingId === vehicle.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <InputField label="Název" value={editData.name || ""} onChange={(v) => setEditData({ ...editData, name: v })} />
                        <InputField label="Rok" type="number" value={String(editData.year || "")} onChange={(v) => setEditData({ ...editData, year: Number(v) })} />
                        <InputField label="Cena s DPH" type="number" value={String(editData.price_with_vat || "")} onChange={(v) => setEditData({ ...editData, price_with_vat: Number(v) })} />
                        <InputField label="Nájezd (km)" type="number" value={String(editData.mileage || "")} onChange={(v) => setEditData({ ...editData, mileage: Number(v) })} />
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

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <ToggleItem icon={<Receipt className="w-4 h-4 text-primary" />} label="Zobrazit DPH" checked={vehicle.show_vat} onChange={(v) => handleToggle(vehicle, "show_vat", v)} />
                      <ToggleItem icon={<Shield className="w-4 h-4 text-primary" />} label="Carfax" checked={vehicle.carfax_enabled} onChange={(v) => handleToggle(vehicle, "carfax_enabled", v)} />
                      <ToggleItem icon={<Leaf className="w-4 h-4 text-emerald-400" />} label="LPG" checked={vehicle.lpg_enabled} onChange={(v) => handleToggle(vehicle, "lpg_enabled", v)} />
                      <ToggleItem icon={<Video className="w-4 h-4 text-primary" />} label="Video" checked={vehicle.video_enabled} onChange={(v) => handleToggle(vehicle, "video_enabled", v)} />
                      <ToggleItem icon={<Award className="w-4 h-4 text-gold" />} label="Záruka" checked={vehicle.warranty_enabled} onChange={(v) => handleToggle(vehicle, "warranty_enabled", v)} />
                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-2 text-sm">
                          {vehicle.status === "prodano" ? <EyeOff className="w-4 h-4 text-destructive" /> : <Eye className="w-4 h-4 text-primary" />}
                          <span className="text-muted-foreground">{vehicle.status === "prodano" ? "Skryto" : "Viditelné"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Photo management */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        id={`file-${vehicle.id}`}
                        onChange={(e) => handlePhotoUpload(vehicle.id, e.target.files)}
                      />
                      <button
                        onClick={() => document.getElementById(`file-${vehicle.id}`)?.click()}
                        disabled={uploadingFor === vehicle.id}
                        className="outline-button inline-flex items-center gap-2 text-xs"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        {uploadingFor === vehicle.id ? "Nahrávám..." : "Přidat fotky"}
                      </button>
                      <button
                        onClick={() => setGalleryVehicleId(galleryVehicleId === vehicle.id ? null : vehicle.id)}
                        className="outline-button inline-flex items-center gap-2 text-xs"
                      >
                        <Images className="w-3.5 h-3.5" />
                        Správa galerie
                      </button>
                    </div>

                    {/* Gallery manager inline */}
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
            <p className="text-center text-muted-foreground py-20">Žádná vozidla. Přidejte první vůz tlačítkem výše.</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

const InputField = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
  </div>
);

const ToggleItem = ({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span className="text-muted-foreground">{label}</span>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default AdminPage;

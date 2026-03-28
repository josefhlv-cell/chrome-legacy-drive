import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Shield, Leaf, Video, Receipt, Award, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { mockVehicles, formatPrice, statusLabels, statusStyles, type Vehicle, type VehicleStatus } from "@/data/vehicles";

const AdminPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" />
              <h1 className="section-heading">Správa vozidel</h1>
            </div>
            <p className="section-subheading mt-2">Admin panel — správa nabídky a modulárních přepínačů</p>
          </motion.div>

          <div className="space-y-6">
            {vehicles.map((vehicle) => (
              <motion.div
                key={vehicle.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  <img src={vehicle.image} alt={vehicle.name} className="w-full lg:w-48 h-32 object-cover rounded-md" loading="lazy" />

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground normal-case">{vehicle.name}</h3>
                        <p className="text-sm text-muted-foreground">{vehicle.year} · {vehicle.vin}</p>
                        <p className="text-lg font-bold text-primary mt-1">{formatPrice(vehicle.priceWithVat)}</p>
                      </div>
                      <select
                        value={vehicle.status}
                        onChange={(e) => updateVehicle(vehicle.id, { status: e.target.value as VehicleStatus })}
                        className={`${statusStyles[vehicle.status]} text-xs font-semibold px-3 py-1.5 rounded-full bg-transparent`}
                      >
                        {(Object.keys(statusLabels) as VehicleStatus[]).map((s) => (
                          <option key={s} value={s} className="bg-card text-foreground">{statusLabels[s]}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-2 text-sm">
                          <Receipt className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">Zobrazit DPH</span>
                        </div>
                        <Switch checked={vehicle.showVat} onCheckedChange={(v) => updateVehicle(vehicle.id, { showVat: v })} />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-2 text-sm">
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">Carfax</span>
                        </div>
                        <Switch checked={vehicle.carfaxEnabled} onCheckedChange={(v) => updateVehicle(vehicle.id, { carfaxEnabled: v })} />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-2 text-sm">
                          <Leaf className="w-4 h-4 text-emerald-400" />
                          <span className="text-muted-foreground">LPG</span>
                        </div>
                        <Switch checked={vehicle.lpgEnabled} onCheckedChange={(v) => updateVehicle(vehicle.id, { lpgEnabled: v })} />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-2 text-sm">
                          <Video className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">Video</span>
                        </div>
                        <Switch checked={vehicle.videoEnabled} onCheckedChange={(v) => updateVehicle(vehicle.id, { videoEnabled: v })} />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-2 text-sm">
                          <Award className="w-4 h-4 text-gold" />
                          <span className="text-muted-foreground">Záruka</span>
                        </div>
                        <Switch checked={vehicle.warrantyEnabled} onCheckedChange={(v) => updateVehicle(vehicle.id, { warrantyEnabled: v })} />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                        <div className="flex items-center gap-2 text-sm">
                          {vehicle.status === "prodano" ? <EyeOff className="w-4 h-4 text-destructive" /> : <Eye className="w-4 h-4 text-primary" />}
                          <span className="text-muted-foreground">{vehicle.status === "prodano" ? "Skryto" : "Viditelné"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminPage;

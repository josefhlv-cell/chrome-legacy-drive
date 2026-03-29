import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Fuel, Gauge, Cog, Palette, Shield, Leaf, ExternalLink, Play } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VehicleGallery from "@/components/VehicleGallery";
import { formatPrice, priceWithoutVat, statusLabels, statusStyles } from "@/data/vehicles";
import { useVehicle } from "@/hooks/useVehicles";
import { useVehicleGallery } from "@/hooks/useVehicleGallery";

const VehicleDetail = () => {
  const { id } = useParams();
  const { data: dbVehicle, isLoading, error } = useVehicle(id);
  const { images, loading: galleryLoading } = useVehicleGallery(dbVehicle?.image_url);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 container mx-auto px-4 text-center py-20">
          <p className="text-muted-foreground">Načítání vozidla...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !dbVehicle) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 container mx-auto px-4 text-center py-20">
          <p className="text-muted-foreground">Vůz nebyl nalezen.</p>
          <Link to="/vozidla" className="text-primary hover:underline mt-4 inline-block">← Zpět na nabídku</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const vehicle = dbVehicle;
  const status = vehicle.status as keyof typeof statusLabels;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-16">
        <div className="container mx-auto px-4">
          <Link to="/vozidla" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 mt-4">
            <ArrowLeft className="w-4 h-4" /> Zpět na nabídku
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative">
              {galleryLoading ? (
                <div className="w-full rounded-lg bg-secondary animate-pulse aspect-[4/3]" />
              ) : (
                <div className="relative">
                  <VehicleGallery images={images} vehicleName={vehicle.name} />
                  <div className="absolute top-4 left-4 z-10">
                    <span className={`${statusStyles[status]} text-xs font-semibold px-3 py-1.5 rounded-full`}>
                      {statusLabels[status]}
                    </span>
                  </div>
                  {vehicle.warranty_enabled && (
                    <div className="absolute top-4 right-4 z-10 bg-gold text-gold-foreground text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5">
                      <Shield className="w-4 h-4" /> Prodloužená záruka v ceně
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-wide normal-case">{vehicle.name}</h1>
              <p className="text-muted-foreground mt-1">{vehicle.year}{vehicle.vin ? ` · VIN: ${vehicle.vin}` : ""}</p>

              <div className="mt-6">
                <p className="text-4xl font-black text-primary">{formatPrice(vehicle.price_with_vat)}</p>
                {vehicle.show_vat && (
                  <p className="text-sm text-muted-foreground mt-1">Cena bez DPH: {formatPrice(priceWithoutVat(vehicle.price_with_vat))}</p>
                )}
              </div>

              <div className="glass-card p-5 mt-6 grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" /><span className="text-muted-foreground">Tachometr:</span><span className="text-foreground font-medium">{vehicle.mileage.toLocaleString("cs-CZ")} km</span></div>
                <div className="flex items-center gap-2"><Fuel className="w-4 h-4 text-primary" /><span className="text-muted-foreground">Palivo:</span><span className="text-foreground font-medium">{vehicle.fuel}</span></div>
                <div className="flex items-center gap-2"><Cog className="w-4 h-4 text-primary" /><span className="text-muted-foreground">Převodovka:</span><span className="text-foreground font-medium">{vehicle.transmission}</span></div>
                <div className="flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /><span className="text-muted-foreground">Barva:</span><span className="text-foreground font-medium">{vehicle.color}</span></div>
              </div>

              <div className="mt-4 glass-card p-5">
                <p className="text-sm font-semibold text-foreground mb-1">Motor: {vehicle.engine}</p>
                <p className="text-sm text-muted-foreground">Výkon: {vehicle.power}</p>
              </div>

              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{vehicle.description}</p>

              {vehicle.lpg_enabled && (
                <div className="mt-4 glass-card p-4 border-emerald-500/30 flex items-start gap-3">
                  <Leaf className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">LPG Systém</p>
                    <p className="text-xs text-muted-foreground">{vehicle.lpg_description}</p>
                  </div>
                </div>
              )}

              {vehicle.carfax_enabled && vehicle.carfax_url && (
                <a href={vehicle.carfax_url} target="_blank" rel="noopener noreferrer" className="mt-4 glass-card p-4 flex items-center gap-3 hover:border-primary/50 transition-colors block">
                  <ExternalLink className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Prověřit historii (Carfax)</p>
                    <p className="text-xs text-muted-foreground">Kompletní zpráva o historii vozu</p>
                  </div>
                </a>
              )}

              <div className="mt-6 flex gap-4">
                <Link to="/kontakt" className="chrome-button inline-block text-center flex-1">Mám zájem o tento vůz</Link>
              </div>
            </motion.div>
          </div>

          {vehicle.video_enabled && vehicle.video_id && (
            <div className="mt-12">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2"><Play className="w-5 h-5 text-primary" /> Video prohlídka</h2>
              <div className="aspect-video rounded-lg overflow-hidden glass-card">
                <iframe
                  src={`https://www.youtube.com/embed/${vehicle.video_id}`}
                  title="Video prohlídka"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default VehicleDetail;

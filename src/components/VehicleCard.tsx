import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Fuel, Gauge, Shield, Leaf } from "lucide-react";
import { formatPrice, priceWithoutVat, statusLabels, statusStyles } from "@/data/vehicles";
import type { DbVehicle } from "@/hooks/useVehicles";
import logoPardubice from "@/assets/logo-pardubice.webp";

interface VehicleCardProps {
  vehicle: DbVehicle;
  index?: number;
}

const VehicleCard = ({ vehicle, index = 0 }: VehicleCardProps) => {
  if (!vehicle?.name || !vehicle?.id) return null;

  const status = vehicle.status as keyof typeof statusLabels;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link to={`/vozidla/${vehicle.id}`} className="glass-card block group overflow-hidden">
        <div className="relative overflow-hidden">
          <img
            src={vehicle.image_url}
            alt={vehicle.name}
            className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            width={800}
            height={600}
          />
          <div className="absolute bottom-2 right-2 pointer-events-none opacity-20">
            <img src={logoPardubice} alt="" className="h-8 w-auto" />
          </div>
          <div className="absolute top-3 left-3">
            <span className={`${statusStyles[status]} text-xs font-semibold px-3 py-1 rounded-full font-montserrat`}>
              {statusLabels[status]}
            </span>
          </div>
          {vehicle.warranty_enabled && (
            <div className="absolute top-3 right-3 bg-primary/90 text-primary-foreground text-xs font-bold px-2 py-1 rounded flex items-center gap-1 font-montserrat">
              <Shield className="w-3 h-3" /> Záruka
            </div>
          )}
          {vehicle.lpg_enabled && (
            <div className="absolute bottom-3 left-3 bg-emerald-600/90 text-foreground text-xs font-bold px-2 py-1 rounded flex items-center gap-1 font-montserrat">
              <Leaf className="w-3 h-3" /> LPG
            </div>
          )}
        </div>

        <div className="p-5">
          <h3 className="text-lg font-bold text-foreground tracking-wide font-serif">{vehicle.name}</h3>
          <p className="text-sm text-muted-foreground mt-1 font-montserrat">{vehicle.year} · {vehicle.engine}</p>

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-montserrat">
            <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> {vehicle.mileage.toLocaleString("cs-CZ")} km</span>
            <span className="flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> {vehicle.fuel}</span>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-xl font-bold text-primary font-montserrat">
              {formatPrice(vehicle.price_with_vat)}
              {vehicle.show_vat && <span className="text-xs font-semibold text-muted-foreground ml-1">Bez DPH</span>}
            </p>
            {vehicle.show_vat && (
              <p className="text-xs text-muted-foreground mt-0.5 font-montserrat">
                Cena bez DPH: {formatPrice(priceWithoutVat(vehicle.price_with_vat))}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default VehicleCard;

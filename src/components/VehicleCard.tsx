import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Fuel, Gauge, Shield, Leaf } from "lucide-react";
import type { Vehicle } from "@/data/vehicles";
import { formatPrice, priceWithoutVat, statusLabels, statusStyles } from "@/data/vehicles";
import logoPardubice from "@/assets/logo-pardubice.png";

interface VehicleCardProps {
  vehicle: Vehicle;
  index?: number;
}

const VehicleCard = ({ vehicle, index = 0 }: VehicleCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
  >
    <Link to={`/vozidla/${vehicle.id}`} className="glass-card block group overflow-hidden">
      <div className="relative overflow-hidden">
        <img
          src={vehicle.image}
          alt={vehicle.name}
          className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          width={800}
          height={600}
        />
        {/* Watermark overlay */}
        <div className="absolute bottom-2 right-2 pointer-events-none opacity-30">
          <img src={logoPardubice} alt="" className="h-10 w-auto" />
        </div>
        <div className="absolute top-3 left-3">
          <span className={`${statusStyles[vehicle.status]} text-xs font-semibold px-3 py-1 rounded-full`}>
            {statusLabels[vehicle.status]}
          </span>
        </div>
        {vehicle.warrantyEnabled && (
          <div className="absolute top-3 right-3 bg-gold/90 text-gold-foreground text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
            <Shield className="w-3 h-3" /> Záruka
          </div>
        )}
        {vehicle.lpgEnabled && (
          <div className="absolute bottom-3 left-3 bg-emerald-600/90 text-foreground text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
            <Leaf className="w-3 h-3" /> LPG
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-lg font-bold text-foreground tracking-wide normal-case">{vehicle.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{vehicle.year} · {vehicle.engine}</p>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> {vehicle.mileage.toLocaleString("cs-CZ")} km</span>
          <span className="flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> {vehicle.fuel}</span>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xl font-bold text-primary">{formatPrice(vehicle.priceWithVat)}</p>
          {vehicle.showVat && (
            <p className="text-xs text-muted-foreground mt-0.5">
              bez DPH: {formatPrice(priceWithoutVat(vehicle.priceWithVat))}
            </p>
          )}
        </div>
      </div>
    </Link>
  </motion.div>
);

export default VehicleCard;

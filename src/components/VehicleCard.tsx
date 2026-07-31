import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Fuel, Gauge, Shield, Leaf } from "lucide-react";
import { formatPrice, priceWithVatFromNet, statusLabels, statusStyles } from "@/data/vehicles";
import type { DbVehicle } from "@/hooks/useVehicles";
import { getVehicleCardImage, VEHICLE_IMAGE_PLACEHOLDER } from "@/lib/vehicleImageSelection";
import { useCompare } from "@/contexts/CompareContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import logoPardubice from "@/assets/logo-pardubice.webp";

interface VehicleCardProps {
  vehicle: DbVehicle;
  index?: number;
}

const VehicleCard = ({ vehicle, index = 0 }: VehicleCardProps) => {
  const PLACEHOLDER = VEHICLE_IMAGE_PLACEHOLDER;
  const compareEnabled = useFeatureFlag("feature_vehicle_compare_enabled");
  const { isSelected, toggle } = useCompare();

  const cardImageUrl = useMemo(() => {
    const chosen = getVehicleCardImage(vehicle);
    if (import.meta.env.DEV) {
      // Helps verify in console that we never serve a chrysler-pardubice.cz URL.
      // eslint-disable-next-line no-console
      console.debug(`[VehicleCard] ${vehicle?.name} → ${chosen || "PLACEHOLDER"}`);
    }
    return chosen;
  }, [vehicle]);

  if (!vehicle?.name || !vehicle?.id) return null;

  const isPriority = index < 4;
  const hasImage = Boolean(cardImageUrl);
  const selected = isSelected(vehicle.id);

  const status = vehicle.status as keyof typeof statusLabels;


  return (
    <div className="h-full">
      <Link to={`/vozidla/${vehicle.id}`} className="glass-card group overflow-hidden flex flex-col h-full">
        <div className="relative overflow-hidden rounded-t-lg bg-background aspect-[4/3]">
          {hasImage ? (
            <img
              src={cardImageUrl}
              alt={vehicle.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading={isPriority ? "eager" : "lazy"}
              fetchPriority={isPriority ? "high" : "auto"}
              decoding="async"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.src.endsWith(PLACEHOLDER)) {
                  img.src = PLACEHOLDER;
                  img.srcset = "";
                }
              }}
            />
          ) : (
            <img
              src={PLACEHOLDER}
              alt={vehicle.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
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

        <div className="p-5 flex flex-col flex-grow">
          <h3 className="text-lg font-bold text-foreground tracking-wide font-serif line-clamp-2">{vehicle.name}</h3>

          <div className="flex flex-col gap-1.5 mt-3 text-xs text-muted-foreground font-montserrat">
            <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> {vehicle.mileage.toLocaleString("cs-CZ")} km</span>
            <span className="flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> {vehicle.fuel}</span>
            {vehicle.vin && (
              <span className="flex items-center gap-1 text-foreground">
                <span className="uppercase tracking-wider text-muted-foreground">VIN:</span> {vehicle.vin}
              </span>
            )}
          </div>

          {(vehicle as any).inventory_number && (
            <div className="mt-3 inline-flex self-start items-center gap-2 text-[11px] font-montserrat px-2 py-1 rounded-md border border-primary/30 bg-primary/5">
              <span className="text-muted-foreground uppercase tracking-wider">Ev.č.</span>
              <span className="text-primary font-bold">{(vehicle as any).inventory_number}</span>
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-border/50">
            <p className="text-xl font-bold text-primary font-montserrat">
              {formatPrice(vehicle.price_with_vat)}
              {vehicle.show_vat && <span className="text-xs font-semibold text-muted-foreground ml-1">Bez DPH</span>}
            </p>
            {vehicle.show_vat && (
              <p className="text-xs text-muted-foreground mt-0.5 font-montserrat">
                S DPH: {formatPrice(priceWithVatFromNet(vehicle.price_with_vat))}
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

// Memoize so changing a sort/filter in the parent doesn't re-render every card.
// Re-renders only when the underlying vehicle row or its position changes.
export default memo(VehicleCard, (prev, next) =>
  prev.index === next.index &&
  prev.vehicle.id === next.vehicle.id &&
  prev.vehicle.updated_at === next.vehicle.updated_at,
);

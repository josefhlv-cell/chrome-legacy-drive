import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import VehicleCard from "./VehicleCard";
import { mockVehicles } from "@/data/vehicles";
import { useVehicles } from "@/hooks/useVehicles";

const FeaturedVehicles = () => {
  const { data: dbVehicles } = useVehicles();

  const featured = useMemo(() => {
    if (dbVehicles && dbVehicles.length > 0) {
      return dbVehicles
        .filter((v) => v.status !== "prodano")
        .slice(0, 6)
        .map((v) => ({
          id: v.id,
          name: v.name,
          year: v.year,
          priceWithVat: v.price_with_vat,
          mileage: v.mileage,
          vin: v.vin,
          fuel: v.fuel,
          image: v.image_url,
          status: v.status as any,
          showVat: v.show_vat,
          carfaxEnabled: v.carfax_enabled,
          carfaxUrl: v.carfax_url,
          lpgEnabled: v.lpg_enabled,
          lpgDescription: v.lpg_description,
          videoEnabled: v.video_enabled,
          videoId: v.video_id,
          warrantyEnabled: v.warranty_enabled,
          engine: v.engine,
          transmission: v.transmission,
          power: v.power,
          color: v.color,
          description: v.description,
        }));
    }

    return mockVehicles.filter((v) => v.status !== "prodano").slice(0, 6);
  }, [dbVehicles]);

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="section-heading">Aktuální nabídka</h2>
            <p className="section-subheading mt-2">Pečlivě vybrané vozy připravené k předání</p>
          </div>
          <Link to="/vozidla" className="hidden md:flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium uppercase tracking-wider">
            Všechny vozy <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featured.map((vehicle, i) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} index={i} />
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Link to="/vozidla" className="outline-button inline-flex items-center gap-2">
            Zobrazit všechny vozy <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedVehicles;

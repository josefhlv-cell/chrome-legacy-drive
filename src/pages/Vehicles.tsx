import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { useVehicles } from "@/hooks/useVehicles";

const fuelOptions = ["Vše", "Ba 95", "BA 95 LPG", "Diesel", "BA95 Hybrid Plug-in", "Ba 95 E85"];
const yearOptions = ["Vše", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2012", "2011", "2009", "2008"];
const sortOptions = [
  { label: "Nejnovější", value: "newest" },
  { label: "Cena ↑", value: "price-asc" },
  { label: "Cena ↓", value: "price-desc" },
];

const PAGE_SIZE = 9;

const VehiclesPage = () => {
  const [fuel, setFuel] = useState("Vše");
  const [year, setYear] = useState("Vše");
  const [sort, setSort] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { data: dbVehicles, isLoading } = useVehicles();
  const lastCardRef = useRef<HTMLDivElement>(null);

  const vehicles = useMemo(() => {
    if (!dbVehicles) return [];
    return dbVehicles.map((v) => ({
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
  }, [dbVehicles]);

  const filtered = useMemo(() => {
    let result = [...vehicles];
    if (fuel !== "Vše") result = result.filter((v) => v.fuel === fuel);
    if (year !== "Vše") result = result.filter((v) => v.year.toString() === year);
    if (sort === "price-asc") result.sort((a, b) => a.priceWithVat - b.priceWithVat);
    if (sort === "price-desc") result.sort((a, b) => b.priceWithVat - a.priceWithVat);
    if (sort === "newest") result.sort((a, b) => b.year - a.year);
    return result;
  }, [vehicles, fuel, year, sort]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [fuel, year, sort]);

  const visibleVehicles = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleLoadMore = useCallback(() => {
    const scrollTarget = lastCardRef.current;
    setVisibleCount((prev) => prev + PAGE_SIZE);
    requestAnimationFrame(() => {
      scrollTarget?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
            <h1 className="section-heading">Skladové vozy</h1>
            <p className="section-subheading mt-2">Pečlivě vybrané vozy Chrysler - Dodge připravené k předání</p>
          </motion.div>

          <div className="glass-card p-4 mb-8 flex flex-wrap items-center gap-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select value={fuel} onChange={(e) => setFuel(e.target.value)} className="bg-secondary text-secondary-foreground text-sm px-3 py-2 rounded-md border border-border">
              {fuelOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-secondary text-secondary-foreground text-sm px-3 py-2 rounded-md border border-border">
              {yearOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-secondary text-secondary-foreground text-sm px-3 py-2 rounded-md border border-border">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} vozů</span>
          </div>

          {isLoading && <p className="text-center text-muted-foreground py-10">Načítání vozidel...</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleVehicles.map((vehicle, i) => (
              <div key={vehicle.id} ref={i === visibleVehicles.length - PAGE_SIZE ? lastCardRef : undefined}>
                <VehicleCard vehicle={vehicle} index={i < PAGE_SIZE ? i : 0} />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-10">
              <button onClick={handleLoadMore} className="chrome-button inline-flex items-center gap-2">
                Načíst další ({filtered.length - visibleCount} zbývá)
              </button>
            </div>
          )}

          {filtered.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-20">Žádné vozy neodpovídají zvoleným filtrům.</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default VehiclesPage;

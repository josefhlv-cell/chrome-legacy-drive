import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { useVehicles } from "@/hooks/useVehicles";

const fuelOptions = ["Vše", "Ba 95", "BA 95 LPG", "Diesel", "BA95 Hybrid Plug-in", "Ba 95 E85", "Ba 95 E10"];
const sortOptions = [
  { label: "Nejnovější", value: "newest" },
  { label: "Cena ↑", value: "price-asc" },
  { label: "Cena ↓", value: "price-desc" },
];

const PAGE_SIZE = 9;

const VehiclesPage = () => {
  const [fuel, setFuel] = useState("Vše");
  const [sort, setSort] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { data: dbVehicles, isLoading } = useVehicles();
  const lastCardRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!dbVehicles) return [];
    let result = dbVehicles.filter((v) => v.status !== "prodano");
    if (fuel !== "Vše") result = result.filter((v) => v.fuel === fuel);
    if (sort === "price-asc") result.sort((a, b) => a.price_with_vat - b.price_with_vat);
    if (sort === "price-desc") result.sort((a, b) => b.price_with_vat - a.price_with_vat);
    if (sort === "newest") result.sort((a, b) => b.year - a.year);
    return result;
  }, [dbVehicles, fuel, sort]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [fuel, sort]);

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
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-secondary text-secondary-foreground text-sm px-3 py-2 rounded-md border border-border">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="ml-auto text-xs text-muted-foreground font-montserrat">{filtered.length} vozů</span>
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

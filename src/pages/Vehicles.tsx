import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { useVehicles } from "@/hooks/useVehicles";

const sortOptions = [
  { label: "Rok", value: "year" },
  { label: "Cena", value: "price" },
  { label: "Značka", value: "brand" },
  { label: "Značka – Model", value: "brand-model" },
];

const PAGE_SIZE = 9;

const VehiclesPage = () => {
  const [sort, setSort] = useState("year");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { data: dbVehicles, isLoading } = useVehicles();
  const loaderRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!dbVehicles) return [];
    let result = dbVehicles.filter((v) => v.status !== "prodano");
    if (sort === "price") result.sort((a, b) => a.price_with_vat - b.price_with_vat);
    if (sort === "year") result.sort((a, b) => b.year - a.year);
    if (sort === "brand") result.sort((a, b) => a.name.localeCompare(b.name, "cs"));
    if (sort === "brand-model") result.sort((a, b) => a.name.localeCompare(b.name, "cs"));
    return result;
  }, [dbVehicles, sort]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sort]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visibleVehicles = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

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
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-secondary text-secondary-foreground text-sm px-3 py-2 rounded-md border border-border">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="ml-auto text-xs text-muted-foreground font-montserrat">{filtered.length} vozů</span>
          </div>

          {isLoading && <p className="text-center text-muted-foreground py-10">Načítání vozidel...</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleVehicles.map((vehicle, i) => (
              <div key={vehicle.id}>
                <VehicleCard vehicle={vehicle} index={i < PAGE_SIZE ? i : 0} />
              </div>
            ))}
          </div>

          {hasMore && (
            <div ref={loaderRef} className="text-center py-10">
              <p className="text-sm text-muted-foreground">Načítání dalších vozů...</p>
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

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { mockVehicles } from "@/data/vehicles";

const fuelOptions = ["Vše", "Benzín", "Benzín + LPG", "Plug-in Hybrid"];
const yearOptions = ["Vše", "2024", "2023", "2022"];
const sortOptions = [
  { label: "Nejnovější", value: "newest" },
  { label: "Cena ↑", value: "price-asc" },
  { label: "Cena ↓", value: "price-desc" },
];

const VehiclesPage = () => {
  const [fuel, setFuel] = useState("Vše");
  const [year, setYear] = useState("Vše");
  const [sort, setSort] = useState("newest");

  const filtered = useMemo(() => {
    let result = mockVehicles.filter((v) => v.status !== "prodano");
    if (fuel !== "Vše") result = result.filter((v) => v.fuel === fuel);
    if (year !== "Vše") result = result.filter((v) => v.year.toString() === year);
    if (sort === "price-asc") result = [...result].sort((a, b) => a.priceWithVat - b.priceWithVat);
    if (sort === "price-desc") result = [...result].sort((a, b) => b.priceWithVat - a.priceWithVat);
    if (sort === "newest") result = [...result].sort((a, b) => b.year - a.year);
    return result;
  }, [fuel, year, sort]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
            <h1 className="section-heading">Skladové vozy</h1>
            <p className="section-subheading mt-2">Pečlivě vybrané vozy Chrysler připravené k předání</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((vehicle, i) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-20">Žádné vozy neodpovídají zvoleným filtrům.</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default VehiclesPage;

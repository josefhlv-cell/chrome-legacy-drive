import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Filter, ShieldCheck } from "lucide-react";
import ownerPulling from "@/assets/owner-pulling.gif";
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <h1 className="section-heading">Skladové vozy</h1>
            <p className="section-subheading mt-2">Pečlivě vybrané vozy Chrysler - Dodge připravené k předání</p>
          </motion.div>

          {/* Scrolling guarantee banner */}
          <div className="relative overflow-hidden mb-8 rounded-lg border border-border/30 bg-secondary/30 flex items-stretch min-h-[72px] md:min-h-[90px]">
            {/* Owner pulling the rope — flipped to face right, showing upper body & arms */}
            <motion.div
              className="shrink-0 relative z-10 flex items-end overflow-hidden"
              animate={{ x: [0, -5, 0, -7, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src={ownerPulling}
                alt="Majitel táhne lano"
                className="w-20 md:w-28 h-full object-cover object-center"
                loading="lazy"
              />
              {/* Overlay gradient to blend into banner */}
              <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-secondary/30 to-transparent" />
            </motion.div>

            {/* Animated rope from his hands to the text */}
            <div className="shrink-0 relative flex items-center" style={{ width: "40px" }}>
              <svg viewBox="0 0 40 40" className="w-full h-10" preserveAspectRatio="none">
                {/* Main rope */}
                <motion.path
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M2,20 C10,14 20,18 28,20 S36,22 38,20",
                      "M2,20 C10,24 20,16 28,20 S36,18 38,20",
                      "M2,20 C10,14 20,18 28,20 S36,22 38,20",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Tension lines */}
                <motion.path
                  fill="none"
                  stroke="hsl(var(--accent) / 0.3)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  animate={{
                    d: [
                      "M2,18 C12,12 22,16 30,18 S36,20 38,18",
                      "M2,22 C12,26 22,20 30,22 S36,20 38,22",
                      "M2,18 C12,12 22,16 30,18 S36,20 38,18",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Knot at hand */}
                <circle cx="3" cy="20" r="2" fill="hsl(var(--accent))" />
              </svg>
            </div>

            {/* Scrolling text */}
            <div className="overflow-hidden flex-1 flex items-center">
              <div className="flex items-center gap-3 animate-marquee whitespace-nowrap">
                {[0, 1].map((i) => (
                  <span key={i} className="inline-flex items-center gap-3 text-sm text-muted-foreground font-montserrat tracking-wide px-4">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-primary font-semibold">Garantujeme stav vozu díky přísné výstupní kontrole</span>
                    <span className="mx-4 text-border">—</span>
                    <span>Zakládáme si na tom, že od nás odjíždíte v naprosto bezpečném a prověřeném voze. Každý automobil v naší nabídce prochází důkladným procesem kontroly všech klíčových částí. Pokud během prohlídky narazíme na díl vykazující známky poškození, automaticky ji opravujeme nebo měníme za nový. Za kvalitu našich vozů si plně stojíme.</span>
                    <span className="mx-8" />
                  </span>
                ))}
              </div>
            </div>
          </div>

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

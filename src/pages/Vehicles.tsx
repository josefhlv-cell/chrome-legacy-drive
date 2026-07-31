import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Filter, ShieldCheck } from "lucide-react";
import ownerPullingMp4 from "@/assets/owner-pulling.mp4";
import ownerPullingWebm from "@/assets/owner-pulling.webm";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import VehicleCardSkeleton from "@/components/VehicleCardSkeleton";
import BannerSlot from "@/components/BannerSlot";
import WatchdogDialog from "@/components/WatchdogDialog";
import { useVehicles } from "@/hooks/useVehicles";

const sortOptions = [
  { label: "Rok výroby (od nejnovějšího)", value: "year" },
  { label: "Nejdražší", value: "price-desc" },
  { label: "Nejlevnější", value: "price-asc" },
  { label: "Podle značky (A–Z)", value: "brand" },
];

const PAGE_SIZE = 12;

const VehiclesPage = () => {
  const [sort, setSort] = useState("price-desc");
  const { data, isLoading } = useVehicles(false);

  const allVehicles = useMemo(() => data ?? [], [data]);

  // Sort client-side over the full list — order is stable across navigation.
  const filtered = useMemo(() => {
    const result = [...allVehicles];
    if (sort === "price-asc") result.sort((a, b) => a.price_with_vat - b.price_with_vat);
    if (sort === "price-desc") result.sort((a, b) => b.price_with_vat - a.price_with_vat);
    if (sort === "year") result.sort((a, b) => b.year - a.year);
    if (sort === "brand") result.sort((a, b) => a.name.localeCompare(b.name, "cs"));
    return result;
  }, [allVehicles, sort]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BannerSlot page="vehicles" position="hero" priority="high" />
      <div className="pt-24 pb-16">
        <div className="mx-auto w-full max-w-[1920px] px-4 md:px-12">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <h1 className="section-heading">Skladové vozy</h1>
            <p className="section-subheading mt-2">Pečlivě vybrané vozy Chrysler - Dodge připravené k předání</p>
          </motion.div>

          {/* Scrolling guarantee banner */}
          <div className="relative overflow-hidden mb-8 rounded-lg border border-border/30 bg-secondary/30 flex items-stretch min-h-[72px] md:min-h-[90px]">
            {/* Owner pulling the rope — flipped to face right, showing upper body & arms */}
            <div className="shrink-0 relative z-10 flex items-end overflow-hidden">
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label="Majitel táhne lano"
                className="w-20 md:w-28 h-full object-cover object-center"
                width={200}
                height={181}
              >
                <source src={ownerPullingWebm} type="video/webm" />
                <source src={ownerPullingMp4} type="video/mp4" />
              </video>
              {/* Overlay gradient to blend into banner */}
              <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-secondary/30 to-transparent" />
            </div>

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
                    <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground font-semibold">Garantujeme stav vozu díky přísné výstupní kontrole</span>
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
            <WatchdogDialog />
            <span className="ml-auto text-xs text-muted-foreground font-montserrat">{filtered.length} vozů</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <VehicleCardSkeleton key={`sk-${i}`} />
                ))
              : filtered.map((vehicle, i) => (
                  <div key={vehicle.id} className="h-full">
                    {/* Pass real index so only the first row gets eager/high priority. */}
                    <VehicleCard vehicle={vehicle} index={i} />
                  </div>
                ))}
          </div>

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

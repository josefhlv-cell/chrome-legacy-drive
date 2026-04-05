import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import ownerPulling from "@/assets/owner-pulling.gif";
import VehicleCard from "./VehicleCard";
import { useVehicles } from "@/hooks/useVehicles";

const FeaturedVehicles = () => {
  const { data: dbVehicles } = useVehicles();

  const featured = useMemo(() => {
    if (!dbVehicles) return [];
    return dbVehicles
      .filter((v) => v.status !== "prodano")
      .slice(0, 6);
  }, [dbVehicles]);

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="section-heading">Aktuální nabídka</h2>
            <p className="section-subheading mt-2">Pečlivě vybrané vozy připravené k předání</p>
          </div>
          <Link to="/vozidla" className="hidden md:flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium uppercase tracking-wider font-montserrat">
            Všechny vozy <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Scrolling guarantee banner – duplicate from Vehicles page */}
        <div className="relative overflow-hidden mb-8 rounded-lg border border-border/30 bg-secondary/30 flex items-stretch min-h-[72px] md:min-h-[90px]">
          <div className="shrink-0 relative z-10 flex items-end overflow-hidden">
            <img
              src={ownerPulling}
              alt="Majitel táhne lano"
              className="w-20 md:w-28 h-full object-cover object-center"
              loading="lazy"
            />
            <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-secondary/30 to-transparent" />
          </div>

          <div className="shrink-0 relative flex items-center" style={{ width: "40px" }}>
            <svg viewBox="0 0 40 40" className="w-full h-10" preserveAspectRatio="none">
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
              <circle cx="3" cy="20" r="2" fill="hsl(var(--accent))" />
            </svg>
          </div>

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

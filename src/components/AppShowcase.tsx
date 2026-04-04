import { motion } from "framer-motion";
import { Package, Wrench, Gem, CalendarDays } from "lucide-react";
import logoPardubice from "@/assets/logo-pardubice.png";
import appScreenshot from "@/assets/app-screenshot.png";

const APP_URL = "https://chryslerpardubice.site/";

const features = [
  { icon: Package, text: "Katalog dílů Mopar s VIN filtrem" },
  { icon: Wrench, text: "Expresní poptávka servisu a dílů přes fotku" },
  { icon: Gem, text: "Prioritní termíny a členské slevy na díly" },
  { icon: CalendarDays, text: "Historie úprav a servisu vašeho vozu" },
];

const AppShowcase = () => (
  <section className="py-20 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/30 to-background" />
    <div className="container mx-auto px-4 relative z-10">
      <div className="glass-card p-8 md:p-12 flex flex-col md:flex-row items-center gap-10">
        {/* Phone mockup with real screenshot */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="shrink-0"
        >
          <div className="relative w-56 h-[420px] rounded-[2.5rem] border-2 border-primary/30 bg-black shadow-2xl overflow-hidden">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-10" />
            {/* Screenshot — properly centered in the "screen" area below the notch */}
            <div className="absolute top-6 left-0 right-0 bottom-0 overflow-hidden">
              <img
                src={appScreenshot}
                alt="Chrysler - Dodge Pardubice – aplikace"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex-1"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Vaše digitální garáž a servisní knížka
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Vše, co potřebujete pro váš Chrysler nebo Dodge — v jedné aplikaci.
          </p>

          <ul className="space-y-4 mb-8">
            {features.map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <f.icon className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm text-foreground">{f.text}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="chrome-button inline-flex items-center gap-2 text-center"
            >
              <img src={logoPardubice} alt="" className="h-5" />
              Otevřít aplikaci
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default AppShowcase;

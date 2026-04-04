import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wrench, Cog, ShieldCheck, Fuel, ArrowRight } from "lucide-react";

const services = [
  { icon: Wrench, title: "Pravidelná údržba", desc: "Kompletní servisní prohlídky dle výrobce pro Chrysler, Dodge a Lancia." },
  { icon: Cog, title: "Diagnostika a opravy", desc: "Počítačová diagnostika, opravy elektroniky, převodovek a motorů." },
  { icon: Fuel, title: "Přestavby na LPG", desc: "Certifikované systémy Prins a BRC s plnou zárukou." },
  { icon: ShieldCheck, title: "STK a homologace", desc: "STK, ME, homologace a výjimky MDČR pro americké vozy." },
];

const ServicePreview = () => (
  <section className="py-24 relative overflow-hidden" style={{
    background: 'linear-gradient(180deg, hsl(218 42% 10%) 0%, hsl(218 45% 8%) 100%)',
  }}>
    <div className="absolute top-0 left-0 right-0 section-separator" />
    <div className="container mx-auto px-4 relative z-10">
      <div className="flex items-end justify-between mb-12">
        <div>
          <h2 className="section-heading">Autoservis</h2>
          <p className="section-subheading mt-2">Odborná péče o americké vozy s autorizací FCA</p>
        </div>
        <Link to="/servis" className="hidden md:flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium uppercase tracking-wider font-montserrat">
          Všechny služby <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6"
          >
            <s.icon className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-2 font-montserrat">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-montserrat">{s.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 text-center md:hidden">
        <Link to="/servis" className="outline-button inline-flex items-center gap-2">
          Všechny služby <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </section>
);

export default ServicePreview;

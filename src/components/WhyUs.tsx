import { motion } from "framer-motion";
import { Award, Shield, Users, Clock } from "lucide-react";

const reasons = [
  { icon: Award, title: "20+ let zkušeností", desc: "Specializace na americké vozy Chrysler, Dodge a RAM od roku 2003." },
  { icon: Shield, title: "Autorizace FCA", desc: "Oficiální servisní partner s přístupem k originální diagnostice." },
  { icon: Users, title: "Osobní přístup", desc: "Rodinná firma, kde je každý zákazník vítán jménem." },
  { icon: Clock, title: "Komplexní služby", desc: "Prodej, servis, dovoz, výkup a náhradní díly pod jednou střechou." },
];

const WhyUs = () => (
  <section className="py-24 bg-background relative overflow-hidden">
    <div className="absolute inset-0" style={{
      background: 'radial-gradient(ellipse at 30% 50%, hsla(215, 55%, 48%, 0.04) 0%, transparent 60%)',
    }} />
    <div className="container mx-auto px-4 relative z-10">
      <div className="text-center mb-16">
        <h2 className="section-heading">Proč Chrysler Pardubice</h2>
        <p className="section-subheading mt-3 max-w-2xl mx-auto">
          Firma, která bezesporu patří mezi ty, jež se snaží být vždy průhlednou, legitimní a korektní.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {reasons.map((r, i) => (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="deep-card p-6 text-center"
          >
            <div className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, hsla(215, 55%, 48%, 0.15), hsla(215, 55%, 48%, 0.05))',
              border: '1px solid hsla(215, 55%, 48%, 0.2)',
            }}>
              <r.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2 font-serif">{r.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-montserrat">{r.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default WhyUs;

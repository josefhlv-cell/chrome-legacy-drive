import { motion } from "framer-motion";
import { Clock, Phone, CalendarHeart, Wrench } from "lucide-react";

const advantages = [
  {
    icon: Clock,
    title: "Prioritní servis",
    description: "Vždy přednostní termín pro naše členy. Vaše auto nepočká.",
  },
  {
    icon: Phone,
    title: "Odborné poradenství 24/7",
    description: "Jsme na telefonu, když potřebujete poradit s ovládáním nebo technologií.",
  },
  {
    icon: CalendarHeart,
    title: "VIP akce",
    description: "Pozvánky na testování nových modelů a srazy majitelů Chrysler.",
  },
  {
    icon: Wrench,
    title: "Doživotní sleva na ND",
    description: "Zvýhodněné ceny náhradních dílů pro vozy zakoupené u nás.",
  },
];

const FamilyAdvantage = () => (
  <section className="py-24 bg-card relative overflow-hidden">
    {/* Subtle metallic grain */}
    <div className="absolute inset-0 opacity-[0.03]" style={{
      backgroundImage: 'radial-gradient(circle at 25% 25%, hsl(210 15% 70%) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }} />

    <div className="container mx-auto px-4 relative z-10">
      <div className="text-center mb-16">
        <h2 className="section-heading">Chrysler Family Advantage</h2>
        <p className="section-subheading mt-3 max-w-2xl mx-auto">
          Koupě vozu u nás není jen transakce. Je to moment, kdy se stáváte součástí komunity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {advantages.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="glass-card p-6 text-center group hover:border-primary/30 transition-all duration-300"
          >
            <div className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center transition-all duration-300" style={{
              background: 'linear-gradient(135deg, hsla(215, 55%, 48%, 0.15), hsla(215, 55%, 48%, 0.05))',
              border: '1px solid hsla(215, 55%, 48%, 0.2)',
            }}>
              <item.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2 font-serif">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-montserrat">{item.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <div className="metallic-divider max-w-xs mx-auto mb-6" />
        <p className="text-muted-foreground italic text-sm max-w-xl mx-auto font-serif">
          „Nejsme jen prodejci, jsme vaši partneři na každém kilometru vaší cesty."
        </p>
      </div>
    </div>
  </section>
);

export default FamilyAdvantage;

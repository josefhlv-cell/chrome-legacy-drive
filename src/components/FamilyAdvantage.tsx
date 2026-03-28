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
  <section className="py-24 bg-card">
    <div className="container mx-auto px-4">
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
            className="glass-card p-6 text-center group hover:border-gold/40 transition-colors"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
              <item.icon className="w-6 h-6 text-gold" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-2 normal-case">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground italic text-sm max-w-xl mx-auto">
          „Nejsme jen prodejci, jsme vaši partneři na každém kilometru vaší cesty."
        </p>
      </div>
    </div>
  </section>
);

export default FamilyAdvantage;

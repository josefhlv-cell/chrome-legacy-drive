import { motion } from "framer-motion";
import { CheckCircle, Search, Shield, Wrench } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const reasons = [
  { icon: Search, title: "Specializace", text: "Chrysler není jen jedna z mnoha značek v našem portfoliu. Je to naše vášeň. Známe každý šroubek modelů Pacifica, Voyager i Grand Caravan." },
  { icon: Shield, title: "Transparentnost", text: "Každý vůz v naší nabídce prochází přísnou kontrolou. U nás neexistují skryté vady – ke každému vozu dodáváme kompletní historii a prověření Carfax." },
  { icon: Wrench, title: "Komplexní péče", text: "Prodejem to u nás nekončí. Zajišťujeme odborný servis, dodávky originálních náhradních dílů a profesionální přestavby na LPG." },
  { icon: CheckCircle, title: "Dovoz bez rizika", text: "Pokud si nevyberete z našich skladových zásob, najdeme a dovezeme vám vůz snů přímo z USA nebo EU. Vyřešíme za vás clo, homologaci i přihlášení." },
];

const AboutPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="section-heading">Více než jen auto</h1>
          <p className="text-primary text-lg font-medium mt-2 tracking-wide">Tradice, která definuje komfort.</p>
          <p className="section-subheading mt-1">Jsme specialisté na značku Chrysler v České republice. Přinášíme vám americký luxus bez kompromisů.</p>

          <div className="mt-10 glass-card p-8">
            <p className="text-foreground leading-relaxed">
              Značka Chrysler vždy stála na vrcholu inovací a rodinného pohodlí. Od ikonického sedanu 300C
              až po revoluční rodinné vozy Pacifica, Chrysler definuje, co znamená cestovat první třídou.
              Naším posláním na Chrysler.cz je zprostředkovat tento zážitek i českým řidičům.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-foreground mt-12 mb-6 tracking-wider">Proč zvolit právě nás?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reasons.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6"
              >
                <r.icon className="w-6 h-6 text-gold mb-3" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-2">{r.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 glass-card p-8 border-gold/30 text-center">
            <p className="text-lg text-foreground font-semibold">
              Staňte se součástí rodiny Chrysler.
            </p>
            <p className="text-muted-foreground mt-2">
              Přijďte si vyzkoušet, jak chutná americký sen na českých silnicích.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
    <Footer />
  </div>
);

export default AboutPage;

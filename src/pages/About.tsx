import { motion } from "framer-motion";
import { CheckCircle, Search, Shield, Wrench, Star, Quote, MapPin, Clock, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const reasons = [
  { icon: Search, title: "Specializace", text: "Chrysler není jen jedna z mnoha značek v našem portfoliu. Je to naše vášeň. Známe každý šroubek modelů Pacifica, Voyager i Grand Caravan." },
  { icon: Shield, title: "Transparentnost", text: "Každý vůz v naší nabídce prochází přísnou kontrolou. U nás neexistují skryté vady – ke každému vozu dodáváme kompletní historii a prověření Carfax." },
  { icon: Wrench, title: "Komplexní péče", text: "Prodejem to u nás nekončí. Zajišťujeme odborný servis, dodávky originálních náhradních dílů a profesionální přestavby na LPG." },
  { icon: CheckCircle, title: "Dovoz bez rizika", text: "Pokud si nevyberete z našich skladových zásob, najdeme a dovezeme vám vůz snů přímo z USA nebo EU. Vyřešíme za vás clo, homologaci i přihlášení." },
];

const milestones = [
  { year: "2003", text: "Založení firmy v Lukovně u Pardubic — začátek specializace na americké vozy Chrysler a Dodge." },
  { year: "2008", text: "Partnerství s Chrysler Club CZ — stáváme se oficiálním partnerem největší české komunity majitelů." },
  { year: "2012", text: "Rozšíření servisu o diagnostiku automatických převodovek a přestavby na LPG." },
  { year: "2018", text: "Autorizace FCA (Fiat Chrysler Automobiles) — certifikovaní mechanici s přístupem k originální diagnostice." },
  { year: "2024", text: "Spuštění digitální platformy Chrysler & Dodge Pardubice — katalog dílů, servisní knížka a AI diagnostika v jedné aplikaci." },
];

const reviews = [
  {
    name: "Hans (Honza)",
    source: "Chrysler Club CZ",
    text: "Mám auto z Lukovny a jsem zatím maximálně spokojený. Auto slouží bezvadně! Nikde nic nebouchá, nerachtá, nehučí. Důležité je mít zázemí, když kupujete ameriku — to vám jiný bazar určitě nedá.",
    rating: 5,
  },
  {
    name: "Chylik (Jirka)",
    source: "Chrysler Club CZ",
    text: "Taky jsem měl zkušenosti se servisem v Lukovně a můžu zatím říci jen pozitivní. Jarda je nejlepší servismen! Vždy poradí, je suprověj.",
    rating: 5,
  },
  {
    name: "xpatx (Martin)",
    source: "Chrysler Club CZ",
    text: "S Lukovnou jsem žádný problém neměl. Co se týče rad — Jarda ochotně poradil, pomohl, nasměroval. Ohledně dílů také žádný problém. Je vidět, že ten podnik není otevřený rok ani dva, ale už pár let.",
    rating: 5,
  },
  {
    name: "dandyMaverick",
    source: "Chrysler Club CZ",
    text: "Jsem s Lukovnou maximálně spokojený, pánové jen tak dál!",
    rating: 5,
  },
  {
    name: "Soryu (Standa)",
    source: "Chrysler Club CZ",
    text: "Já si taky nemůžu stěžovat — ochotní a poradí.",
    rating: 5,
  },
  {
    name: "0610",
    source: "Chrysler Club CZ",
    text: "Dobré zkušenosti. I servis v Rakousku doporučují Mopar. Jinak jste vždy pomohli.",
    rating: 5,
  },
];

const AboutPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-5xl">
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

          {/* Company History */}
          <h2 className="text-2xl font-bold text-foreground mt-16 mb-2 tracking-wider flex items-center gap-3">
            <Clock className="w-6 h-6 text-primary" />
            Historie firmy
          </h2>
          <p className="text-muted-foreground text-sm mb-8">Od malé dílny v Lukovně k přednímu specialistovi na americké vozy v ČR.</p>

          <div className="relative pl-8 border-l-2 border-primary/30 space-y-8">
            {milestones.map((m, i) => (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="absolute -left-[calc(1rem+5px)] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <div className="glass-card p-5">
                  <span className="text-primary font-bold text-lg">{m.year}</span>
                  <p className="text-sm text-foreground mt-1">{m.text}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Key Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            <div className="glass-card p-6 text-center">
              <MapPin className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">Lukovna 11, Sezemice</p>
              <p className="text-xs text-muted-foreground">533 04, u Pardubic</p>
            </div>
            <div className="glass-card p-6 text-center">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">20+ let praxe</p>
              <p className="text-xs text-muted-foreground">Na trhu od roku 2003</p>
            </div>
            <div className="glass-card p-6 text-center">
              <Users className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">Stovky spokojených klientů</p>
              <p className="text-xs text-muted-foreground">Partner Chrysler Club CZ</p>
            </div>
          </div>

          {/* Why Us */}
          <h2 className="text-2xl font-bold text-foreground mt-16 mb-6 tracking-wider">Proč zvolit právě nás?</h2>
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

          {/* Customer Reviews */}
          <h2 className="text-2xl font-bold text-foreground mt-16 mb-2 tracking-wider flex items-center gap-3">
            <Star className="w-6 h-6 text-primary fill-primary" />
            Co o nás říkají zákazníci
          </h2>
          <p className="text-muted-foreground text-sm mb-8">
            Autentické reference z komunity{" "}
            <a
              href="https://www.chrysler-club.net/forum-tema/lukovna-chrysler-pardubice-10753"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Chrysler Club CZ
            </a>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review, i) => (
              <motion.div
                key={review.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6 flex flex-col"
              >
                <Quote className="w-5 h-5 text-primary/40 mb-3" />
                <p className="text-sm text-foreground leading-relaxed flex-1 italic">
                  „{review.text}"
                </p>
                <div className="mt-4 pt-3 border-t border-primary/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{review.name}</p>
                    <p className="text-xs text-muted-foreground">{review.source}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 text-primary fill-primary" />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
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

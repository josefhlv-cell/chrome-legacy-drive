import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Search, Shield, Wrench, Star, Quote, MapPin, Clock, Users, Phone, Mail, Camera, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFacilityPhotos } from "@/hooks/useAdminContent";
import workshop1 from "@/assets/workshop-1.jpg";
import workshop2 from "@/assets/workshop-2.jpg";
import workshop3 from "@/assets/workshop-3.jpg";
import workshop4 from "@/assets/workshop-4.jpg";

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
  { year: "2026", text: "Spuštění digitální platformy Chrysler - Dodge Pardubice — katalog dílů, servisní knížka a AI diagnostika v jedné aplikaci." },
];

const reviews = [
  { name: "Hans (Honza)", source: "Chrysler Club CZ", text: "Mám auto z Lukovny a jsem zatím maximálně spokojený. Auto slouží bezvadně! Nikde nic nebouchá, nerachtá, nehučí. Důležité je mít zázemí, když kupujete ameriku — to vám jiný bazar určitě nedá.", rating: 5 },
  { name: "Chylik (Jirka)", source: "Chrysler Club CZ", text: "Taky jsem měl zkušenosti se servisem v Lukovně a můžu zatím říci jen pozitivní. Jarda je nejlepší servismen! Vždy poradí, je suprověj.", rating: 5 },
  { name: "xpatx (Martin)", source: "Chrysler Club CZ", text: "S Lukovnou jsem žádný problém neměl. Co se týče rad — Jarda ochotně poradil, pomohl, nasměroval. Ohledně dílů také žádný problém. Je vidět, že ten podnik není otevřený rok ani dva, ale už pár let.", rating: 5 },
  { name: "dandyMaverick", source: "Chrysler Club CZ", text: "Jsem s Lukovnou maximálně spokojený, pánové jen tak dál!", rating: 5 },
  { name: "Soryu (Standa)", source: "Chrysler Club CZ", text: "Já si taky nemůžu stěžovat — ochotní a poradí.", rating: 5 },
  { name: "0610", source: "Chrysler Club CZ", text: "Dobré zkušenosti. I servis v Rakousku doporučují Mopar. Jinak jste vždy pomohli.", rating: 5 },
];

const galleryImages = [
  { src: workshop1, alt: "Profesionální autodílna — hydraulické zvedáky", caption: "Moderní dílna s hydraulickými zvedáky" },
  { src: workshop2, alt: "Oprava automatické převodovky", caption: "Specializace na automatické převodovky" },
  { src: workshop3, alt: "Diagnostika motoru", caption: "Profesionální diagnostické vybavení" },
  { src: workshop4, alt: "Autolakovna", caption: "Vlastní lakovací kabina" },
];

const AboutPage = () => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
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
                <motion.div key={m.year} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative">
                  <div className="absolute -left-[calc(1rem+5px)] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  <div className="glass-card p-5">
                    <span className="text-primary font-bold text-lg">{m.year}</span>
                    <p className="text-sm text-foreground mt-1">{m.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Workshop Gallery */}
            <h2 className="text-2xl font-bold text-foreground mt-16 mb-2 tracking-wider flex items-center gap-3">
              <Camera className="w-6 h-6 text-primary" />
              Naše zázemí
            </h2>
            <p className="text-muted-foreground text-sm mb-8">Profesionální dílna a vybavení v Lukovně u Pardubic.</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {galleryImages.map((img, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => setLightboxIndex(i)}
                  className="group relative overflow-hidden rounded-lg aspect-[3/2]"
                >
                  <img src={img.src} alt={img.alt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" width={1024} height={680} />
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <p className="text-xs text-foreground font-medium">{img.caption}</p>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Lightbox */}
            <AnimatePresence>
              {lightboxIndex !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-4"
                  onClick={() => setLightboxIndex(null)}
                >
                  <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 text-foreground hover:text-primary transition-colors">
                    <X className="w-8 h-8" />
                  </button>
                  <img
                    src={galleryImages[lightboxIndex].src}
                    alt={galleryImages[lightboxIndex].alt}
                    className="max-w-full max-h-[85vh] rounded-lg object-contain"
                  />
                  <p className="absolute bottom-6 text-foreground text-sm font-medium">{galleryImages[lightboxIndex].caption}</p>
                </motion.div>
              )}
            </AnimatePresence>

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
                <motion.div key={r.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass-card p-6">
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
              <a href="https://www.chrysler-club.net/forum-tema/lukovna-chrysler-pardubice-10753" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Chrysler Club CZ
              </a>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review, i) => (
                <motion.div key={review.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="glass-card p-6 flex flex-col">
                  <Quote className="w-5 h-5 text-primary/40 mb-3" />
                  <p className="text-sm text-foreground leading-relaxed flex-1 italic">„{review.text}"</p>
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

            {/* Map & Contact */}
            <h2 className="text-2xl font-bold text-foreground mt-16 mb-2 tracking-wider flex items-center gap-3">
              <MapPin className="w-6 h-6 text-primary" />
              Kde nás najdete
            </h2>
            <p className="text-muted-foreground text-sm mb-8">Lukovna 11, 533 04 Sezemice u Pardubic</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-lg overflow-hidden glass-card aspect-[16/9]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2559.5!2d15.8667!3d50.0667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x470dc94d5a2b0f1d%3A0x400af0f661460e0!2sLukovna%2011%2C%20533%2004%20Sezemice!5e0!3m2!1scs!2scz!4v1700000000000!5m2!1scs!2scz"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Mapa — Chrysler - Dodge Pardubice, Lukovna 11"
                />
              </div>

              <div className="space-y-4">
                <div className="glass-card p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4">Kontakt</h3>
                  <div className="space-y-3">
                    <a href="tel:+420603559767" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                      <Phone className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-foreground font-medium">+420 603 559 767</p>
                        <p className="text-xs">Prodej vozidel</p>
                      </div>
                    </a>
                    <a href="mailto:obchod@chrysler.cz" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                      <Mail className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-foreground font-medium">obchod@chrysler.cz</p>
                        <p className="text-xs">E-mail</p>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Otevírací doba</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Po – Pá</span><span className="text-foreground font-medium">8:00 – 17:00</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Sobota</span><span className="text-foreground font-medium">Po domluvě</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Neděle</span><span className="text-foreground font-medium">Zavřeno</span></div>
                  </div>
                </div>

                <a
                  href="https://www.google.com/maps/dir//Lukovna+11,+533+04+Sezemice"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chrome-button w-full text-center block"
                >
                  Navigovat do Lukovny
                </a>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12 glass-card p-8 border-gold/30 text-center">
              <p className="text-lg text-foreground font-semibold">Staňte se součástí rodiny Chrysler.</p>
              <p className="text-muted-foreground mt-2">Přijďte si vyzkoušet, jak chutná americký sen na českých silnicích.</p>
            </div>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AboutPage;

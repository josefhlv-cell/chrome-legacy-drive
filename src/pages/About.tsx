import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Search, Shield, Wrench, Star, Quote, MapPin, Clock, Users, Phone, Mail, Camera, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFacilityPhotos } from "@/hooks/useAdminContent";
import workshop1 from "@/assets/workshop-1.webp";
import workshop2 from "@/assets/workshop-2.webp";
import workshop3 from "@/assets/workshop-3.webp";
import workshop4 from "@/assets/workshop-4.webp";
import CardBg from "@/components/CardBg";

const reasons = [
  { icon: Search, title: "Specializace", text: "Chrysler není jen jedna z mnoha značek v našem portfoliu. Je to naše vášeň. Známe každý šroubek modelů Pacifica, Voyager i Grand Caravan." },
  { icon: Shield, title: "Transparentnost", text: "Každý vůz v naší nabídce prochází přísnou kontrolou. U nás neexistují skryté vady – ke každému vozu dodáváme kompletní historii a prověření Carfax." },
  { icon: Wrench, title: "Komplexní péče", text: "Prodejem to u nás nekončí. Zajišťujeme odborný servis, dodávky originálních náhradních dílů a profesionální přestavby na LPG." },
  { icon: CheckCircle, title: "Dovoz bez rizika", text: "Pokud si nevyberete z našich skladových zásob, najdeme a dovezeme vám vůz snů přímo z USA nebo EU. Vyřešíme za vás clo, homologaci i přihlášení." },
];

const milestones = [
  { year: "2003", text: "Založení společnosti CHDP s.r.o. — začátek specializace na vozy Chrysler, Dodge a Lancia." },
  { year: "2008", text: "Naše společnost posouvá služby i autoservis pod autorizaci DaimlerChrysler Praha. Tato spolupráce otevřela možnosti odborné diagnostiky, programování jednotek i školení mechaniků." },
  { year: "2012", text: "Rozšíření servisu o diagnostiku a opravy automatických převodovek. V rámci přípravy vozidel pro zákazníky zajišťujeme u našich partnerů přestavby vozidel na LPG." },
  { year: "2014", text: "Přechod pod správu FCA. V tomto roce vznikl koncern FCA (Fiat Chrysler Automobiles) sloučením Fiatu a Chrysleru." },
  { year: "2016", text: "Seznamování s novým modelem Pacifica. Servisní postupy, speciální přípravky, školení, hybridní pohon a spoustu dalších osvojených dovedností pro tento konkrétní model." },
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

const fallbackFacilityPhotos = [
  { id: "f1", url: workshop1, caption: "Hlavní servisní hala" },
  { id: "f2", url: workshop2, caption: "Diagnostické pracoviště" },
  { id: "f3", url: workshop3, caption: "Sklad náhradních dílů" },
  { id: "f4", url: workshop4, caption: "Zázemí pro zákazníky" },
];

export default function About() {
  const { data: dbPhotos } = useFacilityPhotos();
  const facilityPhotos = dbPhotos && dbPhotos.length > 0
    ? dbPhotos.map(p => ({ id: p.id, url: p.url, caption: p.caption || "" }))
    : fallbackFacilityPhotos;

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600 selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-black to-black pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="text-red-500 font-semibold tracking-wider uppercase text-sm">O nás</span>
            <h1 className="text-4xl md:text-6xl font-bold mt-2 mb-6 tracking-tight">
              Specialisté na <span className="text-red-500">Chrysler & Dodge</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
              Jsme rodinná firma s více než 20letou tradicí. Žijeme americkými vozy a poskytujeme kompletní péči pro vašeho miláčka.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 relative">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {reasons.map((reason, index) => {
              const Icon = reason.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative group p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-red-500/50 transition-all duration-300"
                >
                  <CardBg />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-white">{reason.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{reason.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-16 relative bg-zinc-950/50 border-y border-zinc-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold mb-4">Naše historie</h2>
            <p className="text-gray-400">Jak jsme se stali předním specialistou na americké vozy v ČR</p>
          </div>

          <div className="max-w-4xl mx-auto relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-zinc-800 hidden md:block" />

            <div className="space-y-8">
              {milestones.map((ms, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex flex-col md:flex-row items-center ${
                    index % 2 === 0 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className="w-full md:w-1/2 p-4">
                    <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                      <span className="text-red-500 font-bold text-xl block mb-1">{ms.year}</span>
                      <p className="text-gray-300 text-sm">{ms.text}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-red-600 border-4 border-black flex items-center justify-center relative z-10 my-2 md:my-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div className="w-full md:w-1/2 p-4 hidden md:block" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Facility Gallery */}
      <section className="py-16 relative">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold mb-4">Prostory nášho servisu</h2>
            <p className="text-gray-400">Nahlédněte do našeho moderně vybaveného zázemí</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {facilityPhotos.map((photo) => (
              <motion.div
                key={photo.id}
                whileHover={{ scale: 1.02 }}
                className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group bg-zinc-900 border border-zinc-800"
                onClick={() => setSelectedPhoto(photo.url)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || "Servisní prostory"}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-sm font-medium text-white flex items-center gap-2">
                    <Camera className="w-4 h-4 text-red-500" />
                    {photo.caption || "Zvětšit"}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-16 relative bg-zinc-950/50 border-t border-zinc-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold mb-4">Co o nás říkají zákazníci</h2>
            <p className="text-gray-400">Reálné recenze z komunity Chrysler Club CZ</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col justify-between"
              >
                <div>
                  <Quote className="w-8 h-8 text-red-500/40 mb-4" />
                  <p className="text-gray-300 text-sm mb-6 italic">{review.text}</p>
                </div>
                <div>
                  <div className="flex gap-1 mb-2">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <h4 className="font-bold text-white text-sm">{review.name}</h4>
                  <span className="text-xs text-gray-500">{review.source}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setSelectedPhoto(null)}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full bg-zinc-900/80"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={selectedPhoto}
              alt="Zvětšený náhled"
              className="max-w-full max-h-[90vh] object-contain rounded-xl border border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

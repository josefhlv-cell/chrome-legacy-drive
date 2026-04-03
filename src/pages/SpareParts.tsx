import { motion } from "framer-motion";
import { Wrench, Search, Smartphone, Phone, ShieldCheck, Truck, Package } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import logoPardubice from "@/assets/logo-pardubice.png";

const APP_URL = "https://chryslerpardubice.site/";

const advantages = [
  { icon: ShieldCheck, title: "Originální Mopar díly", desc: "Dodáváme originální díly Mopar pro všechny modely Chrysler a Dodge." },
  { icon: Search, title: "Vyhledávání podle VIN", desc: "Přesná identifikace dílu podle VIN kódu vašeho vozu — žádné omyly." },
  { icon: Truck, title: "Rychlé dodání", desc: "Díly ze skladu v EU obvykle do 3–5 pracovních dnů." },
  { icon: Package, title: "Aftermarket alternativy", desc: "Nabízíme i kvalitní aftermarket díly za příznivější cenu." },
];

const SpareParts = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero with blueprint pattern */}
      <div className="pt-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: "8px 8px",
        }} />

        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Wrench className="w-8 h-8 text-primary" />
              <h1 className="section-heading">Náhradní díly</h1>
            </div>
            <p className="section-subheading">
              Originální i aftermarket díly pro Chrysler a Dodge.
              Využijte naši aplikaci s VIN filtrem pro přesné vyhledání.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 max-w-4xl">
        {/* Advantages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12"
        >
          {advantages.map((a) => (
            <div key={a.title} className="glass-card p-5 flex items-start gap-3">
              <a.icon className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">{a.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* App CTA — primary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 md:p-8 border-primary/40 mb-12"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg font-bold text-foreground mb-1">
                Objednejte díly přes aplikaci
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Mopar katalog s VIN filtrem — zadejte VIN, najděte díl, poptejte cenu.
                Vše z mobilu, bez čekání na telefonu.
              </p>
              <a
                href={APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="chrome-button inline-flex items-center gap-2"
              >
                <img src={logoPardubice} alt="" className="h-5" />
                Otevřít katalog dílů
              </a>
            </div>
          </div>
        </motion.div>

        {/* Phone fallback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 text-center"
        >
          <Phone className="w-6 h-6 text-primary mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Preferujete telefon?</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Zavolejte nám a náš tým vám pomůže s identifikací a objednáním dílu.
          </p>
          <a href="tel:+420777123456" className="text-primary font-bold text-lg hover:underline">
            +420 777 123 456
          </a>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default SpareParts;

import { useState } from "react";
import { motion } from "framer-motion";
import { Wrench, Fuel, Cog, Send, ShieldCheck, Clock, Phone, Award, Paintbrush, Car, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateLead } from "@/hooks/useLeads";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LPGCalculator from "@/components/LPGCalculator";

const services = [
  {
    icon: Wrench,
    title: "Pravidelná údržba",
    desc: "Kompletní servisní prohlídky dle výrobce. Výměna olejů, filtrů, brzdových destiček a další běžná údržba amerických vozů Chrysler - Dodge.",
  },
  {
    icon: Fuel,
    title: "Přestavby na LPG",
    desc: "Zprostředkujme vám profesionální přestavby motorů Pentastar V6 a HEMI V8 na LPG. Certifikované systémy Prins a BRC s plnou zárukou. Tuto přestavbu s námi můžete konzultovat.",
  },
  {
    icon: Cog,
    title: "Originální náhradní díly Mopar",
    desc: "Dodávky originálních i kvalitních aftermarket dílů přímo z USA. Brzdy, filtry, svíčky, řemeny, podvozek i karoserie.",
  },
  {
    icon: ShieldCheck,
    title: "Diagnostika - Opravy",
    desc: "Počítačová diagnostika amerických vozů. Opravy elektroniky, převodovek, motorů a klimatizačních systémů.",
  },
];

const ServicePage = () => {
  const { toast } = useToast();
  const createLead = useCreateLead();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);

    try {
      await createLead.mutateAsync({
        type: "service",
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        phone: fd.get("phone") as string,
        vehicle_model: fd.get("vehicle") as string,
        message: fd.get("message") as string,
      });
      toast({ title: "Objednávka přijata", description: "Ozveme se vám s termínem." });
      form.reset();
    } catch {
      toast({ title: "Chyba", description: "Nepodařilo se odeslat. Zkuste to znovu.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="section-heading">Servis - LPG</h1>
            <p className="section-subheading mt-2">Odborná péče o vaše americké vozy Chrysler a Dodge</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            {services.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6"
              >
                <s.icon className="w-8 h-8 text-gold mb-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Detailed Service Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
            {/* Category 1 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0 }} className="glass-card p-6 space-y-3">
              <Award className="w-8 h-8 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Odborný servis vozidel</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Chrysler, Dodge, Lancia</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Individuální přístup k zákazníkům</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Autorizace FCA</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Více než 20letá zkušenost</li>
              </ul>
            </motion.div>

            {/* Category 2 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="glass-card p-6 space-y-3">
              <Cog className="w-8 h-8 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Technické vybavení</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Opravy automatických převodovek</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Moderně vybavené autodílny</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Diagnostické pomůcky</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Kamerový monitoring motorů</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Tlakové zkoušky všech systémů</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Diagnostika a plnění klimatizací</li>
              </ul>
            </motion.div>

            {/* Category 3 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="glass-card p-6 space-y-3">
              <Paintbrush className="w-8 h-8 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Nadstandardní služby</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Autolakovna</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Zastoupení při dopravních nehodách</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Čištění a renovace laku</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Autokosmetika, keramika laku</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Mobilní čištění přímo u Vás doma</li>
              </ul>
            </motion.div>

            {/* Category 4 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="glass-card p-6 space-y-3">
              <Car className="w-8 h-8 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Zajišťujeme</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> STK, ME, Homologace</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Výjimky MDČR</li>
              </ul>
            </motion.div>
          </div>

          {/* LPG Calculator */}
          <LPGCalculator />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-16">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold uppercase tracking-wider text-foreground mb-4">Objednat se na servis</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Jméno *</label>
                      <input name="name" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">E-mail *</label>
                      <input name="email" type="email" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Telefon *</label>
                      <input name="phone" type="tel" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Vůz *</label>
                      <input name="vehicle" required placeholder="např. Chrysler Pacifica 2022" className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Popis požadavku</label>
                    <textarea name="message" rows={4} placeholder="Popište závadu nebo požadovanou službu..." className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-muted-foreground" />
                  </div>
                  <button type="submit" disabled={loading} className="chrome-button w-full flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" /> {loading ? "Odesílám..." : "Objednat servis"}
                  </button>
                </form>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card p-6 space-y-6">
                <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">Servisní informace</h2>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Provozní doba servisu</p>
                    <p className="text-muted-foreground text-sm">Po–Pá: 8:00 – 17:00</p>
                    <p className="text-muted-foreground text-sm">So–Ne: Pouze po domluvě</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Servisní linka</p>
                    <p className="text-muted-foreground text-sm">+420 603 559 767</p>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-gold/10 border border-gold/20 rounded-lg">
                  <p className="text-sm font-semibold text-gold">💎 Zvýhodněný servis pro klienty</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Zákazníci, kteří zakoupili vůz u nás, získávají doživotní slevu na servis a náhradní díly.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ServicePage;

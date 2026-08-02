import { useState } from "react";
import { motion } from "framer-motion";
import { Wrench, Fuel, Cog, Send, ShieldCheck, Clock, Phone, Award, Paintbrush, Car, CheckCircle, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateLead } from "@/hooks/useLeads";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LPGCalculator from "@/components/LPGCalculator";
import BannerSlot from "@/components/BannerSlot";
import udrzbaAsset from "@/assets/servis/udrzba.jpg.asset.json";
import lpgAsset from "@/assets/servis/lpg.jpg.asset.json";
import moparAsset from "@/assets/servis/mopar.jpg.asset.json";
import diagnostikaAsset from "@/assets/servis/diagnostika.png.asset.json";
import stkAsset from "@/assets/servis/stk.jpg.asset.json";
import lakovnaAsset from "@/assets/servis/lakovna.jpg.asset.json";
import prevodovkyAsset from "@/assets/servis/prevodovky.jpg.asset.json";
import fcaAsset from "@/assets/servis/fca.png.asset.json";

/** Decentní obrázek v pozadí karty — zpracování identické s mobilním menu */
const CardBg = ({ src }: { src: string }) => (
  <div
    aria-hidden="true"
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center 40%',
      opacity: 0.16,
      filter: 'grayscale(0.55) contrast(0.95) brightness(0.9)',
      maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 75%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 75%, transparent 100%)',
    }}
  />
);

const services = [
  {
    icon: Wrench,
    title: "Pravidelná údržba",
    desc: "Kompletní servisní prohlídky dle výrobce. Výměna olejů, filtrů, brzdových destiček a další běžná údržba amerických vozů Chrysler - Dodge.",
    bg: udrzbaAsset.url,
  },
  {
    icon: Fuel,
    title: "Přestavby na LPG",
    desc: "Zprostředkujme vám profesionální přestavby motorů Pentastar V6 a HEMI V8 na LPG. Certifikované systémy Prins a BRC s plnou zárukou. Tuto přestavbu s námi můžete konzultovat.",
    bg: lpgAsset.url,
  },
  {
    icon: Cog,
    title: "Originální náhradní díly Mopar",
    desc: "Dodávky originálních i kvalitních aftermarket dílů přímo z USA. Brzdy, filtry, svíčky, řemeny, podvozek i karoserie.",
    bg: moparAsset.url,
  },
  {
    icon: ShieldCheck,
    title: "Diagnostika - Opravy",
    desc: "Počítačová diagnostika amerických vozů. (DRB II, DRB III, Star Scan, WiTech) Opravy elektroniky, převodovek, motorů a klimatizačních systémů.",
    bg: diagnostikaAsset.url,
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
      <BannerSlot page="service" position="hero" priority="high" />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:max-w-[1920px] lg:px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="section-heading">Servis</h1>
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
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Odborný značkový servis</h3>
              <p className="text-xs text-muted-foreground">Chrysler Dodge pod autorizací FCA CZ</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Chrysler, Dodge, Lancia</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Individuální přístup k zákazníkům</li>
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
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Financování vozidel</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Pojištění vozidel</li>
              </ul>
            </motion.div>
          </div>

          <BannerSlot page="service" position="mid" />

          {/* ─── CENÍK PRACÍ A ODBORNÉ DIAGNOSTIKY VOZŮ ─── */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 glass-card p-6 md:p-8"
            id="cenik"
          >
            <div className="flex items-center gap-3 mb-2">
              <Receipt className="w-7 h-7 text-gold" />
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground">
                Ceník prací a odborné diagnostiky vozů
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-6">
              Platný pro rok 2026 · Ceny jsou uvedeny bez DPH · CHDP s.r.o., Lukovna 11, 533 04 Sezemice ·
              IČ: 27527638 · DIČ: CZ27527638 · Odpovědná osoba: Marek Lejhanec
            </p>

            {/* Diagnostika */}
            <div className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gold mb-3">Diagnostika</h3>
              <ul className="divide-y divide-border/40 text-sm">
                {[
                  ["1. Odborná diagnostika vozů – DRB II, DRB III", "700,- Kč"],
                  ["2. Odborná diagnostika vozů – StarScan", "800,- Kč"],
                  ["3. Odborná diagnostika Witech", "1 000,- Kč"],
                  ["4. Pin – dohrání klíčů Witech", "2 000,- Kč"],
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4 py-2">
                    <span className="text-foreground">{k}</span>
                    <span className="font-semibold text-primary whitespace-nowrap">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Servis vozů */}
            <div className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gold mb-3">Servis vozů</h3>
              <ul className="divide-y divide-border/40 text-sm">
                {[
                  ["a) oleje, filtry, destičky, čepy, řemeny, mechanické části motorů i náprav atd.", "1 500,- Kč / 1 hod"],
                  ["b) diagnostika, programování, elektroinstalace", "1 500,- Kč / 1 hod"],
                  ["c) náplň klimatizace R134", "700,- Kč + 2,20,- Kč/g náplň"],
                  ["d) plnění klimatizace R1234YF", "700,- Kč + 6,00,- Kč/g náplň"],
                  ["e) geometrie vozů", "1 000,- Kč"],
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4 py-2">
                    <span className="text-foreground">{k}</span>
                    <span className="font-semibold text-primary whitespace-nowrap">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Výměny olejů */}
            <div className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gold mb-3">Výměny olejů</h3>
              <ul className="divide-y divide-border/40 text-sm">
                {[
                  ["a) motor 2,5i, 3,0i, 3,3i, 2,4i, 3,8i 10w40 Castrol vč. filtru, práce a likvidace starého oleje", "2 900,-"],
                  ["b) motor 2,5 TD, 2,5 TDi, 10w40 Castrol vč. filtru, práce a likvidace starého oleje", "2 900,-"],
                  ["c) motor 2,5 CRD 5w30 Castrol Mag. do 100 000 km vč. filtru a práce", "3 650,-"],
                  ["d) motor 2,5 CRD 10w40 Castrol, nad 100 000 km vč. filtru a práce", "2 900,-"],
                  ["e) motor 3,6 (2011–2016) 5w20 olej, filtr vč. práce", "3 800,-"],
                  ["f) motor 3,6 (2011–2016) 5w30 olej, filtr vč. práce", "3 800,-"],
                  ["g) motor 3,6 Pacifica olej, filtr vč. práce", "4 500,-"],
                  ["h) převodovka 3–4kv automat 1990–2000 vč. filtru, práce a likvidace starého oleje", "3 900,-"],
                  ["i) převodovka 4kv automat 2001–2006 ATF+4 vč. filtru, práce a likvidace oleje", "4 400,-"],
                  ["j) manuální převodovka vč. práce a likvidace starého oleje", "1 900,-"],
                  ["k) manuální převodovka 2001–2005", "2 950,-"],
                  ["l) automat 6kv 2008–2020 vč. filtrů a likvidace oleje", "4 990,-"],
                  ["m) převodovka 8&9 3,5l oleje (nad 3,5l doplatek 1l/1 350,-) … 2h", "7 400,-"],
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4 py-2">
                    <span className="text-foreground">{k}</span>
                    <span className="font-semibold text-primary whitespace-nowrap">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ceny olejů */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gold mb-3">Ceny olejů (za 1 litr)</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-sm divide-y divide-border/40 sm:divide-y-0">
                {[
                  ["Castrol 10w40", "220,-"],
                  ["Castrol 5w30 magnatec", "350,-"],
                  ["Mopar 5w20", "300,-"],
                  ["Mopar 5w30", "290,-"],
                  ["ATF dextron III", "220,-"],
                  ["ATF+4 Mopar", "355,-"],
                  ["Castrol SMX S Man", "600,-"],
                  ["Castrol 0w20 C5", "450,-"],
                  ["Automat 8&9", "1 350,-"],
                ].map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-4 py-2 sm:border-b sm:border-border/40">
                    <span className="text-foreground">{k}</span>
                    <span className="font-semibold text-primary whitespace-nowrap">{v} Kč</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-xs italic text-muted-foreground border-t border-border/40 pt-4">
              Ceny jsou uvedeny bez DPH. Vyhrazujeme si právo úpravy ceníku v průběhu roku.
            </p>
          </motion.section>

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
      <BannerSlot page="service" position="footer" />
      <Footer />
    </div>
  );
};

export default ServicePage;

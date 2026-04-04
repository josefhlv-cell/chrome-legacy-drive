import { useState } from "react";
import { motion } from "framer-motion";
import {
  Send, DollarSign, Upload, Handshake, Zap, Car, Recycle, Smartphone, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateLead } from "@/hooks/useLeads";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import logoPardubice from "@/assets/logo-pardubice.webp";

const APP_URL = "https://chryslerpardubice.site/";

const reasons = [
  { icon: Handshake, title: "Férové ocenění", desc: "Na základě pragmatických zkušeností a reálného stavu trhu." },
  { icon: Zap, title: "Rychlé jednání", desc: "Vyplacení peněz ihned po podpisu smlouvy." },
  { icon: Car, title: "Protiúčet", desc: "Možnost započítat cenu vašeho starého vozu do ceny nového ze skladu." },
  { icon: Recycle, title: "Vykupujeme i poškozené vozy", desc: "Máme zájem o vozy jakéhokoliv stáří." },
];

const TradeInPage = () => {
  const { toast } = useToast();
  const createLead = useCreateLead();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);

    try {
      await createLead.mutateAsync({
        type: "trade-in",
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        phone: fd.get("phone") as string,
        vehicle_model: fd.get("vin") as string || "neuvedeno",
        message: `Rok: ${fd.get("year")}, Stav: ${fd.get("notes")}`,
        metadata: { photos: files.length },
      });
      toast({ title: "Poptávka přijata", description: "Ozveme se vám s nabídkou co nejdříve." });
      form.reset();
      setFiles([]);
    } catch {
      toast({ title: "Chyba", description: "Nepodařilo se odeslat. Zkuste to znovu.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Part 1: Trust */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-8 h-8 text-primary" />
              <h1 className="section-heading">Vykoupíme váš Chrysler nebo Dodge. Férově a rychle.</h1>
            </div>
            <p className="section-subheading mb-8">
              Důvěřujte zkušenostem — více než 20 let na trhu s americkými vozy.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
              {reasons.map((r) => (
                <div key={r.title} className="glass-card p-5 flex items-start gap-3">
                  <r.icon className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{r.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Part 2: App CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-6 md:p-8 border-primary/40 mb-12"
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="shrink-0 w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-lg font-bold text-foreground mb-1">
                  Nejrychlejší cesta k nacenění
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Vyfoťte vaše auto mobilem, zadejte VIN a pošlete nám poptávku přímo z naší chytré aplikace.
                </p>
                <a
                  href={APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chrome-button inline-flex items-center gap-2"
                >
                  <img src={logoPardubice} alt="" className="h-5" />
                  Nacenit auto přes aplikaci
                </a>
              </div>
            </div>
          </motion.div>

          {/* Part 3: Web Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" /> Nebo vyplňte poptávku zde
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Pro ty, kteří preferují klasický formulář.
            </p>
            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Jméno *</label>
                  <input name="name" required className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">E-mail *</label>
                  <input name="email" type="email" required className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Telefon *</label>
                <input name="phone" type="tel" required className={inputClass} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">VIN (nepovinné)</label>
                  <input name="vin" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Rok výroby *</label>
                  <input name="year" type="number" required className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Stav vozu a poznámky</label>
                <textarea name="notes" rows={3} placeholder="Popište stav, případné závady, výbavu..." className={`${inputClass} resize-none placeholder:text-muted-foreground`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                  <Upload className="w-4 h-4 inline mr-1" /> Fotografie vozu
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm file:mr-3 file:bg-primary/20 file:text-primary file:border-0 file:rounded file:px-3 file:py-1 file:text-xs file:font-semibold"
                />
                {files.length > 0 && <p className="text-xs text-muted-foreground mt-1">{files.length} soubor(ů) vybráno</p>}
              </div>
              <button type="submit" disabled={loading} className="chrome-button w-full flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> {loading ? "Odesílám..." : "Odeslat poptávku na web"}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TradeInPage;

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Ship } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ImportPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Poptávka odeslána", description: "Náš specialista se vám ozve do 24 hodin." });
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <Ship className="w-8 h-8 text-primary" />
              <h1 className="section-heading">Dovoz na zakázku</h1>
            </div>
            <p className="section-subheading mb-8">Najdeme a dovezeme vůz snů přímo z USA nebo EU. Vyřešíme clo, homologaci i přihlášení.</p>

            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Jméno *</label>
                  <input required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">E-mail *</label>
                  <input type="email" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Telefon *</label>
                <input type="tel" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Požadovaný model *</label>
                <input required placeholder="např. Chrysler Pacifica Hybrid 2024" className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Region dovozu</label>
                  <select className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm">
                    <option>USA</option>
                    <option>EU</option>
                    <option>Kanada</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Rozpočet</label>
                  <input placeholder="např. do 1 500 000 Kč" className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Další požadavky</label>
                <textarea rows={3} placeholder="Barva, výbava, max. nájezd km..." className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-muted-foreground" />
              </div>
              <button type="submit" disabled={loading} className="chrome-button w-full flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> {loading ? "Odesílám..." : "Odeslat poptávku"}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ImportPage;

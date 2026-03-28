import { useState } from "react";
import { motion } from "framer-motion";
import { Send, DollarSign, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateLead } from "@/hooks/useLeads";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
        vehicle_model: fd.get("model") as string,
        message: `Rok: ${fd.get("year")}, Tachometr: ${fd.get("mileage")} km, Cena: ${fd.get("price")}, Stav: ${fd.get("notes")}`,
        metadata: { photos: files.length },
      });
      toast({ title: "Podklady přijaty", description: "Naši technici provedou nacenění a ozvou se vám." });
      form.reset();
      setFiles([]);
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
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-8 h-8 text-primary" />
              <h1 className="section-heading">Výkup / Protiúčet</h1>
            </div>
            <p className="section-subheading mb-8">Zašlete nám údaje o vašem voze a my vám připravíme férovou nabídku.</p>

            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
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
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Telefon *</label>
                <input name="phone" type="tel" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Značka a model *</label>
                  <input name="model" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Rok výroby *</label>
                  <input name="year" type="number" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Stav tachometru (km) *</label>
                  <input name="mileage" type="number" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Očekávaná cena (Kč)</label>
                  <input name="price" type="number" className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Stav vozu a poznámky</label>
                <textarea name="notes" rows={3} placeholder="Popište stav, případné závady, výbavu..." className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-muted-foreground" />
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
                <Send className="w-4 h-4" /> {loading ? "Odesílám..." : "Odeslat k nacenění"}
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

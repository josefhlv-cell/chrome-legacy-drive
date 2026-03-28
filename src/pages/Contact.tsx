import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Phone, Mail, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ContactPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Zpráva odeslána", description: "Děkujeme, ozveme se vám co nejdříve." });
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="section-heading">Kontakt</h1>
            <p className="section-subheading mt-2">Rádi vám pomůžeme s výběrem vašeho nového Chrysleru</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <Phone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Telefon</p>
                    <p className="text-muted-foreground text-sm">+420 123 456 789</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Mail className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">E-mail</p>
                    <p className="text-muted-foreground text-sm">info@chrysler.cz</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Adresa</p>
                    <p className="text-muted-foreground text-sm">Praha, Česká republika</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Otevírací doba</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Pondělí – Pátek: 9:00 – 18:00</p>
                  <p>Sobota: 9:00 – 13:00</p>
                  <p>Neděle: Zavřeno</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
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
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Předmět</label>
                  <input className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Zpráva *</label>
                  <textarea required rows={5} className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none" />
                </div>
                <button type="submit" disabled={loading} className="chrome-button w-full flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {loading ? "Odesílám..." : "Odeslat zprávu"}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactPage;

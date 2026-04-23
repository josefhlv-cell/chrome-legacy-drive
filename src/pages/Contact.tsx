import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Phone, Mail, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const ContactPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);

    const ACCESS_KEY = "f88c48be-a30f-477a-b188-1869e7a4f183"; 

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          name: String(fd.get("name") || ""),
          email: String(fd.get("email") || ""),
          subject: "Nová poptávka: " + (String(fd.get("subject") || "") || "Chrysler.cz"),
          message: String(fd.get("message") || ""),
          from_name: "Web Chrysler.cz",
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Zpráva odeslána",
          description: "Děkujeme, ozveme se vám co nejdříve.",
        });
        form.reset();
      } else {
        throw new Error("Nepodařilo se odeslat");
      }
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Omlouváme se, zprávu se nepodařilo odeslat. Zkuste to znovu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="section-heading">Kontakt</h1>
            <p className="section-subheading mt-2">
              Rádi vám pomůžeme s výběrem vašeho nového Chrysleru
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
            {/* Levý sloupec - Kontaktní údaje */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <Phone className="w-5 h-5 text-primary mt-0.5" />
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm">Prodej a výkup vozidel</p>
                      <p className="text-muted-foreground text-sm">+420 603 559 767</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Prodej nových autodílů</p>
                      <p className="text-muted-foreground text-sm">+420 737 842 460</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Prodej použitých autodílů</p>
                      <p className="text-muted-foreground text-sm">+420 603 372 911</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Autoservis</p>
                      <p className="text-muted-foreground text-sm">+420 603 559 767</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Mail className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">E-mail</p>
                    <p className="text-muted-foreground text-sm">obchod@chrysler.cz</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Adresa</p>
                    <p className="text-muted-foreground text-sm">Lukovna 11, Pardubice</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">Otevírací doba</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Pondělí – Pátek: 8:00 – 11:30 a 12:30 – 17:00</p>
                  <p>Sobota – Neděle: Zavřeno</p>
                </div>
              </div>
            </motion.div>

            {/* Pravý sloupec - Kontaktní formulář */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                      Jméno *
                    </label>
                    <input
                      name="name"
                      required
                      type="text"
                      className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                      E-mail *
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Předmět
                  </label>
                  <input
                    name="subject"
                    type="text"
                    className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                    Zpráva *
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="chrome-button w-full flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {loading ? "Odesílám..." : "Odeslat zprávu"}
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

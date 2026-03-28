import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Ship, Car, DollarSign, User, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useCreateLead } from "@/hooks/useLeads";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const models = [
  { id: "pacifica", name: "Chrysler Pacifica", icon: "🚐" },
  { id: "300", name: "Chrysler 300", icon: "🏎️" },
  { id: "voyager", name: "Chrysler Voyager", icon: "🚐" },
  { id: "challenger", name: "Dodge Challenger", icon: "💪" },
  { id: "charger", name: "Dodge Charger", icon: "⚡" },
  { id: "durango", name: "Dodge Durango", icon: "🏔️" },
  { id: "ram", name: "RAM 1500", icon: "🛻" },
  { id: "other", name: "Jiný model", icon: "🔧" },
];

const regions = ["USA", "EU", "Kanada"];

const ImportPage = () => {
  const { toast } = useToast();
  const createLead = useCreateLead();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");

  // Step 2
  const [budget, setBudget] = useState(800000);
  const [yearRange, setYearRange] = useState(2022);
  const [region, setRegion] = useState("USA");

  // Step 3
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const modelLabel = selectedModel === "other" ? customModel : models.find((m) => m.id === selectedModel)?.name || "";

  const canNext = () => {
    if (step === 1) return selectedModel !== "" && (selectedModel !== "other" || customModel.trim() !== "");
    if (step === 2) return true;
    if (step === 3) return name.trim() !== "" && email.trim() !== "" && phone.trim() !== "";
    return false;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await createLead.mutateAsync({
        type: "import",
        name,
        email,
        phone,
        vehicle_model: modelLabel,
        message: `Region: ${region}, Rozpočet: do ${budget.toLocaleString("cs-CZ")} Kč, Rok od: ${yearRange}, Poznámky: ${notes}`,
      });
      toast({ title: "Poptávka odeslána ✓", description: "Náš specialista se vám ozve do 24 hodin." });
      setStep(1);
      setSelectedModel("");
      setCustomModel("");
      setBudget(800000);
      setYearRange(2022);
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
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
              <Ship className="w-8 h-8 text-primary" />
              <h1 className="section-heading">Dovoz na zakázku</h1>
            </div>
            <p className="section-subheading mb-8">Najdeme a dovezeme vůz snů přímo z USA nebo EU. Vyřešíme clo, homologaci i přihlášení.</p>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                  }`}>
                    {step > s ? <Check className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-primary" : "bg-border"}`} />}
                </div>
              ))}
            </div>

            <div className="glass-card p-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Car className="w-5 h-5 text-primary" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">1. Vyberte model</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModel(m.id)}
                          className={`p-4 rounded-lg border text-center transition-all ${
                            selectedModel === m.id
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <span className="text-2xl block mb-1">{m.icon}</span>
                          <span className="text-xs font-semibold">{m.name}</span>
                        </button>
                      ))}
                    </div>
                    {selectedModel === "other" && (
                      <div className="mt-4">
                        <input
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          placeholder="Zadejte model..."
                          className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="flex items-center gap-2 mb-6">
                      <DollarSign className="w-5 h-5 text-primary" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">2. Rozpočet a parametry</h2>
                    </div>
                    <div className="space-y-8">
                      <div>
                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-3">
                          Maximální rozpočet: <span className="text-primary">{budget.toLocaleString("cs-CZ")} Kč</span>
                        </label>
                        <Slider value={[budget]} onValueChange={(v) => setBudget(v[0])} min={200000} max={3000000} step={50000} />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>200 000 Kč</span>
                          <span>3 000 000 Kč</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-3">
                          Rok výroby od: <span className="text-primary">{yearRange}</span>
                        </label>
                        <Slider value={[yearRange]} onValueChange={(v) => setYearRange(v[0])} min={2010} max={2026} step={1} />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>2010</span>
                          <span>2026</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-3">Region dovozu</label>
                        <div className="flex gap-3">
                          {regions.map((r) => (
                            <button
                              key={r}
                              onClick={() => setRegion(r)}
                              className={`flex-1 py-2.5 rounded-md text-sm font-semibold border transition-all ${
                                region === r
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-primary" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">3. Vaše údaje</h2>
                    </div>
                    <div className="space-y-4">
                      <div className="glass-card p-3 text-xs text-muted-foreground">
                        <strong className="text-foreground">Shrnutí:</strong> {modelLabel} · {region} · do {budget.toLocaleString("cs-CZ")} Kč · od roku {yearRange}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Jméno *</label>
                          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">E-mail *</label>
                          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Telefon *</label>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" required className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1.5">Další požadavky</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Barva, výbava, max. nájezd km..." className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-muted-foreground" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between mt-6">
                {step > 1 ? (
                  <button onClick={() => setStep(step - 1)} className="outline-button inline-flex items-center gap-2 text-sm">
                    <ChevronLeft className="w-4 h-4" /> Zpět
                  </button>
                ) : <div />}
                {step < 3 ? (
                  <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="chrome-button inline-flex items-center gap-2 text-sm disabled:opacity-50">
                    Další <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={handleSubmit} disabled={!canNext() || loading} className="chrome-button inline-flex items-center gap-2 text-sm disabled:opacity-50">
                    <Send className="w-4 h-4" /> {loading ? "Odesílám..." : "Odeslat poptávku"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ImportPage;

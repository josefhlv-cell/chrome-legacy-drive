import { useState } from "react";
import { BellPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { toast } from "@/hooks/use-toast";

/**
 * "Watchdog" subscription — the visitor gets an e-mail as soon as a matching
 * vehicle appears in stock. Entry point disappears when the admin disables it.
 */
const WatchdogDialog = () => {
  const enabled = useFeatureFlag("feature_watchdog_enabled");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [keyword, setKeyword] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [consent, setConsent] = useState(false);

  if (!enabled) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast({ title: "Zadejte platný e-mail", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Bez souhlasu nemůžeme e-mail uložit", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("watchdog_subscriptions").insert({
      email: email.trim(),
      keyword: keyword.trim() || null,
      price_max: priceMax ? Number(priceMax) : null,
      year_min: yearMin ? Number(yearMin) : null,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Hlídání se nepodařilo uložit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Hlídání aktivováno", description: "O nových vozech vám dáme vědět e-mailem." });
    setOpen(false);
    setEmail("");
    setKeyword("");
    setPriceMax("");
    setYearMin("");
    setConsent(false);
  };

  const inputCls =
    "w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="outline-button !px-3 !py-2 text-xs inline-flex items-center gap-2">
          <BellPlus className="w-3.5 h-3.5" /> Hlídat nové vozy
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hlídací pes</DialogTitle>
          <DialogDescription>
            Jakmile naskladníme vůz podle vašich kritérií, pošleme vám e-mail. Prázdná pole znamenají „na tom nezáleží“.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Váš e-mail" className={inputCls} />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Značka / model (např. Voyager)" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min={0} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Max. cena (Kč)" className={inputCls} />
            <input type="number" min={1950} max={2100} value={yearMin} onChange={(e) => setYearMin(e.target.value)} placeholder="Min. rok" className={inputCls} />
          </div>
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground leading-snug">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>
              Souhlasím se zpracováním svého e-mailu za účelem zasílání upozornění na nové vozy. Souhlas lze kdykoli odvolat
              odkazem v každém e-mailu.
            </span>
          </label>
          <button type="submit" disabled={saving} className="chrome-button w-full !py-2 text-xs inline-flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Aktivovat hlídání
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WatchdogDialog;

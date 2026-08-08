import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Mail, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { useCreateLead } from "@/hooks/useLeads";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { toast } from "@/hooks/use-toast";

/**
 * Floating "live chat" widget. There is no realtime backend behind it —
 * a message becomes a normal lead (type: "live-chat"), which already triggers
 * the e-mail notification to obchod@chrysler.cz.
 */
const LiveChatWidget = () => {
  const enabled = useFeatureFlag("feature_live_chat_enabled");
  // Zákaznický widget nemá co dělat v administraci — překrýval spoušť Smart Capture.
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const createLead = useCreateLead();

  if (!enabled || pathname.startsWith("/admin")) return null;

  const looksLikeEmail = contact.includes("@");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !message.trim()) {
      toast({ title: "Vyplňte prosím všechna pole", variant: "destructive" });
      return;
    }
    createLead.mutate(
      {
        type: "live-chat",
        name: name.trim(),
        email: looksLikeEmail ? contact.trim() : "",
        phone: looksLikeEmail ? "" : contact.trim(),
        message: message.trim(),
        vehicle_model: "",
        metadata: { source: "live-chat", page: window.location.pathname },
      },
      {
        onSuccess: () => {
          setSent(true);
          setName("");
          setContact("");
          setMessage("");
        },
        onError: (err: unknown) =>
          toast({
            title: "Zprávu se nepodařilo odeslat",
            description: err instanceof Error ? err.message : "Zkuste to prosím znovu.",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border/60">
            <span className="text-sm font-bold text-foreground font-montserrat">Napište nám</span>
            <button onClick={() => setOpen(false)} aria-label="Zavřít chat" className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            <div className="p-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
              <p className="text-sm text-foreground font-montserrat">Děkujeme, ozveme se vám co nejdříve.</p>
              <button onClick={() => setSent(false)} className="outline-button !px-4 !py-2 text-xs">
                Napsat další zprávu
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jméno"
                className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Telefon nebo e-mail"
                className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Vaše zpráva"
                rows={3}
                className="w-full bg-secondary text-secondary-foreground border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <button type="submit" disabled={createLead.isPending} className="chrome-button w-full !py-2 text-xs inline-flex items-center justify-center gap-2">
                {createLead.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Odeslat
              </button>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Odesláním souhlasíte se zpracováním uvedených kontaktních údajů za účelem vyřízení vašeho dotazu.
              </p>
            </form>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Otevřít chat"
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
      </button>
    </>
  );
};

export default LiveChatWidget;

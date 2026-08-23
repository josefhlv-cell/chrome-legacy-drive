import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { useCreateLead } from "@/hooks/useLeads";
import { toast } from "@/hooks/use-toast";
import { BODY_COLORS } from "../data/tourData";
import { trackTourEvent } from "../lib/tourAnalytics";
import { sfx } from "../lib/tourSound";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Zvolená barva laku z prohlídky — předvyplní se do poptávky. */
  colorKey: string;
  /** Odkud poptávka vznikla: konec prohlídky, AR, barva… */
  source: string;
  title?: string;
  subtitle?: string;
};

const inputClass =
  "h-12 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 text-[13px] text-white placeholder:text-white/35 outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/60";

/**
 * Poptávkový formulář na konci prohlídky / po AR náhledu.
 * Ukládá se do stejné tabulky `leads` jako ostatní formuláře na webu,
 * takže lead spadne do adminu i do e-mailové notifikace.
 */
export const LeadCapture = ({
  open,
  onClose,
  colorKey,
  source,
  title = "Chci vidět Pacificu naživo",
  subtitle = "Ozveme se vám a připravíme vůz k prohlídce v Pardubicích. Nezávazně.",
}: Props) => {
  const createLead = useCreateLead();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const firstField = useRef<HTMLInputElement>(null);

  const color = BODY_COLORS.find((c) => c.key === colorKey);
  const colorLabel = color?.key === "original" ? "Originální lak vozu" : color?.label;

  useEffect(() => {
    if (!open) return;

    trackTourEvent("lead_open", { color: colorKey, meta: { source } });

    const timer = window.setTimeout(() => firstField.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open, colorKey, source]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim() || (!phone.trim() && !email.trim())) {
      toast({
        title: "Doplňte prosím kontakt",
        description: "Potřebujeme jméno a telefon nebo e-mail.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createLead.mutateAsync({
        type: "pacifica_tour",
        name: name.trim(),
        email: email.trim() || "neuvedeno@chryslerpardubice.site",
        phone: phone.trim(),
        vehicle_model: "Chrysler Pacifica",
        message:
          `${message.trim() || "Poptávka z virtuální prohlídky Chrysler Pacifica."}\n\n` +
          `Zvolená barva v prohlídce: ${colorLabel}\nZdroj: ${source}`,
        metadata: {
          source,
          tour_color_key: colorKey,
          tour_color_label: colorLabel,
        },
      });

      sfx.chime();
      setSent(true);
      trackTourEvent("lead_submit", { color: colorKey, meta: { source } });
    } catch (error) {
      toast({
        title: "Odeslání se nepodařilo",
        description: "Zkuste to prosím znovu, nebo nám zavolejte.",
        variant: "destructive",
      });
      console.error("Pacifica tour lead failed:", error);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-[26px] border border-white/10 bg-[#0b0d12] p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-primary">
              Chrysler Pardubice
            </p>
            <h2 className="mt-1 font-serif text-xl leading-tight text-white">
              {sent ? "Děkujeme!" : title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít formulář"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="mt-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15">
              <Check className="h-6 w-6 text-primary" />
            </div>

            <p className="mt-4 text-center text-[13px] leading-relaxed text-white/70">
              Poptávku máme. Ozveme se vám nejpozději následující pracovní den
              a vůz připravíme k osobní prohlídce.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 h-12 w-full rounded-full bg-primary text-[13px] font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Zpět do prohlídky
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-2.5">
            <p className="text-[13px] leading-relaxed text-white/60">{subtitle}</p>

            <div className="!mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <span
                aria-hidden="true"
                className="h-7 w-7 shrink-0 rounded-full border border-white/25"
                style={{
                  background: color?.hex
                    ? `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), ${color.hex} 62%)`
                    : "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.5), #2b2d31 62%)",
                }}
              />
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/40">
                  Barva z prohlídky
                </p>
                <p className="text-[12.5px] text-white/85">{colorLabel}</p>
              </div>
            </div>

            <input
              ref={firstField}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jméno a příjmení"
              aria-label="Jméno a příjmení"
              autoComplete="name"
              className={inputClass}
            />

            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Telefon"
              aria-label="Telefon"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
            />

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-mail (nepovinné)"
              aria-label="E-mail"
              type="email"
              autoComplete="email"
              className={inputClass}
            />

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Co vás na Pacifice zajímá? (nepovinné)"
              aria-label="Zpráva"
              rows={2}
              className={`${inputClass} h-auto resize-none py-3`}
            />

            <button
              type="submit"
              disabled={createLead.isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {createLead.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Nezávazně poptat
            </button>

            <p className="pt-1 text-center text-[10px] leading-relaxed text-white/35">
              Odesláním souhlasíte se zpracováním kontaktních údajů pro vyřízení
              poptávky. Barvy laku v prohlídce jsou orientační vizualizace.
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default LeadCapture;

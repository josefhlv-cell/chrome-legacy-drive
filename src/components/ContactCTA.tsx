import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import { trackPhoneClick } from "@/lib/trackPhoneClick";

const ContactCTA = () => (
  <section className="py-20 relative overflow-hidden" style={{
    background: 'linear-gradient(180deg, hsl(218 42% 10%) 0%, hsl(218 50% 7%) 100%)',
  }}>
    <div className="absolute top-0 left-0 right-0 section-separator" />
    <div className="container mx-auto px-4 relative z-10">
      <div className="glass-card p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground font-serif mb-4">
            Máte zájem o vůz nebo servis?
          </h2>
          <p className="text-muted-foreground mb-6 font-montserrat">
            Kontaktujte nás telefonicky nebo nám napište. Rádi vám poradíme s výběrem vozu, domluvíme prohlídku nebo naplánujeme servisní termín.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="tel:+420603559767" onClick={() => trackPhoneClick("+420603559767", "contact-cta")} className="chrome-button inline-flex items-center gap-2">
              <Phone className="w-4 h-4" /> +420 603 559 767
            </a>
            <Link to="/kontakt" className="outline-button inline-flex items-center gap-2">
              <Mail className="w-4 h-4" /> Napsat zprávu
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-3 text-sm text-muted-foreground font-montserrat shrink-0">
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +420 603 559 767 <span className="text-xs">(prodej a výkup)</span></div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +420 737 842 460 <span className="text-xs">(nové díly)</span></div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +420 603 372 911 <span className="text-xs">(použité díly)</span></div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +420 603 559 767 <span className="text-xs">(autoservis)</span></div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> 466 931 611 <span className="text-xs">(pevná linka)</span></div>
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> obchod@chrysler.cz</div>
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Lukovna 11, Pardubice</div>
        </div>
      </div>
    </div>
  </section>
);

export default ContactCTA;

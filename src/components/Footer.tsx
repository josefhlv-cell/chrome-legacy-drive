import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import logoPardubice from "@/assets/logo-pardubice.png";

const Footer = () => (
  <footer className="border-t border-border" style={{
    background: 'linear-gradient(180deg, hsl(218 45% 8%), hsl(218 50% 6%))',
  }}>
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <img src={logoPardubice} alt="Chrysler - Dodge Pardubice" className="h-16 w-auto mb-4 drop-shadow-lg" />
          <p className="text-sm text-muted-foreground leading-relaxed font-montserrat">
            U nás prodejem cesta teprve začíná. Vítejte v rodině Chrysler - Dodge.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4 font-serif">Navigace</h4>
          <div className="flex flex-col gap-2">
            {[
              { label: "Skladové vozy", path: "/vozidla" },
              { label: "Dovoz na zakázku", path: "/dovoz" },
              { label: "Výkup vozidel", path: "/vykup" },
              { label: "Servis - LPG", path: "/servis" },
              { label: "O nás", path: "/o-nas" },
            ].map((item) => (
              <Link key={item.path} to={item.path} className="text-sm text-muted-foreground hover:text-primary transition-colors font-montserrat">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4 font-serif">Kontakt</h4>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground font-montserrat">
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +420 603 559 767</div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> obchod@chrysler.cz</div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Pardubice, Česká republika</div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4 font-serif">Otevírací doba</h4>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground font-montserrat">
            <p>Po–Pá: 8:00 – 11:30 a 12:30 – 17:00</p>
            <p>So–Ne: Zavřeno</p>
          </div>
        </div>
      </div>

      <div className="metallic-divider mt-12 mb-6" />
      <div className="text-center text-xs text-muted-foreground font-montserrat">
        © {new Date().getFullYear()} Chrysler - Dodge Pardubice — Všechna práva vyhrazena.
      </div>
    </div>
  </footer>
);

export default Footer;

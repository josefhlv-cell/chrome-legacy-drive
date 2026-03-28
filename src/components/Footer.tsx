import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

const Footer = () => (
  <footer className="bg-card border-t border-border">
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <h3 className="text-lg font-bold tracking-[0.3em] text-primary mb-4">CHRYSLER.CZ</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            U nás prodejem cesta teprve začíná. Vítejte v rodině Chrysler.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">Navigace</h4>
          <div className="flex flex-col gap-2">
            {[
              { label: "Skladové vozy", path: "/vozidla" },
              { label: "Dovoz na zakázku", path: "/dovoz" },
              { label: "Výkup vozidel", path: "/vykup" },
              { label: "Servis", path: "/servis" },
              { label: "O nás", path: "/o-nas" },
            ].map((item) => (
              <Link key={item.path} to={item.path} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">Kontakt</h4>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +420 123 456 789</div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> info@chrysler.cz</div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Praha, Česká republika</div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">Otevírací doba</h4>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>Po–Pá: 9:00 – 18:00</p>
            <p>So: 9:00 – 13:00</p>
            <p>Ne: Zavřeno</p>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Chrysler.cz — Všechna práva vyhrazena.
      </div>
    </div>
  </footer>
);

export default Footer;

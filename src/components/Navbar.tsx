import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoPardubice from "@/assets/logo-pardubice.webp";

const navItems = [
  { label: "Nabídka vozidel", path: "/vozidla" },
  { label: "Dovoz", path: "/dovoz" },
  { label: "Výkup", path: "/vykup" },
  { label: "Náhradní díly", path: "/nahradni-dily" },
  { label: "Servis - LPG", path: "/servis" },
  { label: "O nás", path: "/o-nas" },
  { label: "Kontakt", path: "/kontakt" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{
      background: 'hsla(218, 50%, 10%, 0.82)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      borderBottom: '1px solid hsla(210, 15%, 50%, 0.15)',
      boxShadow: '0 4px 30px -10px hsla(0, 0%, 0%, 0.5)',
    }}>
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoPardubice} alt="Chrysler - Dodge Pardubice" className="h-12 w-auto drop-shadow-lg" width={179} height={200} />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-xs font-semibold tracking-[0.15em] uppercase transition-colors duration-200 font-montserrat ${
                location.pathname === item.path
                  ? "text-primary"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* CSS-only mobile menu transition (no framer-motion) */}
      <div
        className="md:hidden border-t border-border/30 overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: mobileOpen ? '400px' : '0',
          opacity: mobileOpen ? 1 : 0,
          background: 'hsla(218, 50%, 8%, 0.95)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-semibold tracking-[0.12em] uppercase text-foreground/70 hover:text-primary transition-colors font-montserrat"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

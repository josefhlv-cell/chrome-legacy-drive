import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Play } from "lucide-react";
import logoPardubice from "@/assets/logo-pardubice.webp";
import menuBg from "@/assets/menu-bg.jpg.asset.json";

// Pending-replay flag is read by IntroAnimation when it mounts on the homepage.
const REPLAY_FLAG = "intro:replay-pending";

const navItems = [
  { label: "Nabídka vozidel", path: "/vozidla" },
  { label: "Dovoz", path: "/dovoz" },
  { label: "Výkup", path: "/vykup" },
  { label: "Náhradní díly", path: "/nahradni-dily" },
  { label: "Servis", path: "/servis" },
  { label: "O nás", path: "/o-nas" },
  { label: "Kontakt", path: "/kontakt" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleReplayIntro = () => {
    sessionStorage.removeItem("chrysler_intro_seen");
    if (location.pathname === "/") {
      window.dispatchEvent(new CustomEvent("intro:replay"));
    } else {
      // IntroAnimation only mounts on the homepage — go there and trigger on arrival.
      sessionStorage.setItem(REPLAY_FLAG, "1");
      navigate("/");
    }
  };

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

        {/* Chrome Play button — replays the intro animation */}
        <button
          type="button"
          onClick={handleReplayIntro}
          aria-label="Přehrát úvodní animaci"
          title="Přehrát úvodní animaci"
          className="ml-1 md:ml-2 inline-flex items-center justify-center w-8 h-8 rounded-full transition-transform duration-200 hover:scale-110 active:scale-95"
          style={{
            background:
              "linear-gradient(145deg, hsl(210 15% 92%), hsl(210 12% 70%) 45%, hsl(210 14% 50%) 75%, hsl(210 16% 35%))",
            boxShadow:
              "inset 0 1px 1px hsla(0,0%,100%,0.7), inset 0 -1px 2px hsla(0,0%,0%,0.45), 0 2px 6px hsla(0,0%,0%,0.45)",
            border: "1px solid hsla(0,0%,100%,0.25)",
          }}
        >
          <Play className="w-3.5 h-3.5 fill-current" style={{ color: "hsl(218 45% 12%)" }} />
        </button>

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
        className="md:hidden border-t border-border/30 overflow-hidden transition-all duration-300 ease-out relative"
        style={{
          maxHeight: mobileOpen ? '400px' : '0',
          opacity: mobileOpen ? 1 : 0,
          background: 'hsla(218, 50%, 8%, 0.95)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Decentní obrázek v pozadí — 10 % krytí, odbarvený, plynulé prolnutí */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${menuBg.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
            filter: 'grayscale(0.7) contrast(0.9)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 35%, black 70%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 35%, black 70%, transparent 100%)',
          }}
        />
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4 relative z-10">
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

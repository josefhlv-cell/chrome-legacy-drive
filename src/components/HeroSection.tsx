import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-chrysler.jpg";
import logoPardubice from "@/assets/logo-pardubice.png";

const HeroSection = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
    <div className="absolute inset-0">
      <img src={heroImage} alt="Chrysler - Dodge Pardubice" className="w-full h-full object-cover" width={1920} height={1080} />
      {/* Deep navy overlay matching Chrysler.cz DNA */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to right, hsl(218 50% 7% / 0.92), hsl(218 50% 7% / 0.7), hsl(218 50% 7% / 0.35))',
      }} />
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to top, hsl(218 50% 7%) 0%, transparent 50%, hsl(218 50% 7% / 0.2) 100%)',
      }} />
    </div>

    <div className="container mx-auto px-4 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl"
      >
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-wide text-foreground leading-tight mb-6 italic font-serif">
          „Nejsme jen prodejci,
          <br />
          jsme vaši <span className="text-primary">partneři</span>
          <br />
          na každém kilometru vaší cesty."
        </h1>
        <blockquote className="border-l-2 border-primary/40 pl-4 mb-10 max-w-lg">
          <p className="text-sm md:text-base text-muted-foreground italic leading-relaxed font-montserrat">
            Vítejte na stránkách www.chrysler.cz. Představujeme Vám tímto firmu, která bezesporu patří mezi ty, jež se snaží být vždy firmou průhlednou, legitimní a ve svém přístupu ke klientům vždy korektní.
          </p>
        </blockquote>
        <img src={logoPardubice} alt="Chrysler - Dodge Pardubice" className="h-12 md:h-16 mb-8 drop-shadow-lg" />
        <div className="flex flex-wrap gap-4">
          <Link to="/vozidla" className="chrome-button inline-block text-center">
            Prohlédnout vozy
          </Link>
          <Link to="/dovoz" className="outline-button inline-block text-center">
            Poptat dovoz
          </Link>
        </div>
      </motion.div>
    </div>
  </section>
);

export default HeroSection;

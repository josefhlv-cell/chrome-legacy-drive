import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-chrysler.jpg";

const HeroSection = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
    <div className="absolute inset-0">
      <img src={heroImage} alt="Chrysler & Dodge Pardubice" className="w-full h-full object-cover" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
    </div>

    <div className="container mx-auto px-4 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl"
      >
        <h1 className="text-5xl md:text-7xl font-black tracking-wider text-foreground leading-tight mb-6">
          Americká síla
          <br />
          a luxus.
          <br />
          <span className="text-primary">Nyní skladem v ČR.</span>
        </h1>
        <p className="text-lg text-muted-foreground font-light leading-relaxed mb-10 max-w-lg">
          Chrysler & Dodge — objevte pohodlí, výkon a technologie, které definují novou éru amerického cestování.
        </p>
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

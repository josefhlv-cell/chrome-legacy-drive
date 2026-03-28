import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-chrysler.jpg";
import logoPardubice from "@/assets/logo-pardubice.png";

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
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-wide text-foreground leading-tight mb-6 italic">
          „Nejsme jen prodejci,
          <br />
          jsme vaši <span className="text-primary">partneři</span>
          <br />
          na každém kilometru vaší cesty."
        </h1>
        <blockquote className="border-l-2 border-primary/50 pl-4 mb-10 max-w-lg">
          <p className="text-sm md:text-base text-muted-foreground italic leading-relaxed">
            Management firmy Chrysler Pardubice si dovoluje prezentovat v těchto stránkách názory ve vztahu k vozům Chrysler Voyager, Grand Voyager, Lancia Voyager, Town &amp; Country, Dodge — získané na základě pragmatických zkušeností za dobu naší praxe s touto exkluzivní značkou.
          </p>
        </blockquote>
        <img src={logoPardubice} alt="Chrysler & Dodge Pardubice" className="h-12 md:h-16 mb-8 drop-shadow-lg" />
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

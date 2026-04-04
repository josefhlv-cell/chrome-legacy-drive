import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoShield from "@/assets/logo-shield.png";
import introPacifica from "@/assets/intro-pacifica.png";
import introRam from "@/assets/intro-ram.png";
import introChallenger from "@/assets/intro-challenger.png";

const INTRO_KEY = "chrysler_intro_seen";

const IntroAnimation = () => {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState(0); // 0=cars, 1=lights, 2=logo, 3=fadeout

  useEffect(() => {
    if (localStorage.getItem(INTRO_KEY)) return;
    setShow(true);
    document.body.style.overflow = "hidden";

    // Phase timeline
    const t1 = setTimeout(() => setPhase(1), 800);   // lights on
    const t2 = setTimeout(() => setPhase(2), 2000);  // logo reveal
    const t3 = setTimeout(() => setPhase(3), 4200);  // fade out
    const t4 = setTimeout(() => {
      setShow(false);
      localStorage.setItem(INTRO_KEY, "1");
      document.body.style.overflow = "";
    }, 5000);

    return () => { [t1, t2, t3, t4].forEach(clearTimeout); document.body.style.overflow = ""; };
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      {phase < 3 ? (
        <motion.div
          key="intro"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: "radial-gradient(ellipse at center, hsl(218 45% 5%) 0%, hsl(0 0% 0%) 100%)" }}
        >
          {/* Ambient dust particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 3 + 1,
                height: Math.random() * 3 + 1,
                background: `hsla(210, 15%, 60%, ${Math.random() * 0.3 + 0.1})`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30 - Math.random() * 40],
                x: [0, (Math.random() - 0.5) * 20],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* Floor reflection line */}
          <div className="absolute bottom-[28%] left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent 10%, hsla(210,15%,40%,0.15) 50%, transparent 90%)" }} />

          {/* LEFT — Pacifica */}
          <motion.div
            className="absolute bottom-[22%] left-[2%] md:left-[5%] w-[30%] md:w-[28%]"
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: phase >= 0 ? 1 : 0, x: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          >
            <motion.img
              src={introPacifica}
              alt="Chrysler Pacifica"
              className="w-full h-auto drop-shadow-2xl"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Headlight glow */}
            <motion.div
              className="absolute top-[35%] right-[-5%] w-24 h-12 md:w-40 md:h-20"
              style={{
                background: "radial-gradient(ellipse at left center, hsla(200,80%,85%,0.5) 0%, hsla(200,60%,70%,0.15) 40%, transparent 80%)",
                filter: "blur(8px)",
              }}
              initial={{ opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, scaleX: phase >= 1 ? 1.8 : 0.3 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </motion.div>

          {/* CENTER — Ram 1500 */}
          <motion.div
            className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[40%] md:w-[32%] z-10"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: phase >= 0 ? 1 : 0, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          >
            <motion.img
              src={introRam}
              alt="Ram 1500"
              className="w-full h-auto drop-shadow-2xl"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Headlight glow — center beams */}
            <motion.div
              className="absolute top-[30%] left-[10%] w-32 h-16 md:w-48 md:h-24"
              style={{
                background: "radial-gradient(ellipse at center, hsla(45,60%,85%,0.6) 0%, hsla(45,40%,70%,0.2) 40%, transparent 75%)",
                filter: "blur(12px)",
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1.5 : 0.5 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            />
          </motion.div>

          {/* RIGHT — Challenger */}
          <motion.div
            className="absolute bottom-[22%] right-[2%] md:right-[5%] w-[30%] md:w-[28%]"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: phase >= 0 ? 1 : 0, x: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          >
            <motion.img
              src={introChallenger}
              alt="Dodge Challenger"
              className="w-full h-auto drop-shadow-2xl"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
            {/* Headlight glow */}
            <motion.div
              className="absolute top-[35%] left-[-5%] w-24 h-12 md:w-40 md:h-20"
              style={{
                background: "radial-gradient(ellipse at right center, hsla(200,80%,85%,0.5) 0%, hsla(200,60%,70%,0.15) 40%, transparent 80%)",
                filter: "blur(8px)",
              }}
              initial={{ opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, scaleX: phase >= 1 ? 1.8 : 0.3 }}
              transition={{ duration: 1.2, delay: 0.1, ease: "easeOut" }}
            />
          </motion.div>

          {/* Center light convergence */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 md:w-64 md:h-64 z-20"
            style={{
              background: "radial-gradient(circle, hsla(210,30%,90%,0.25) 0%, hsla(210,30%,70%,0.08) 40%, transparent 70%)",
              filter: "blur(20px)",
            }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 2 ? 2 : 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />

          {/* Logo reveal */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{
              opacity: phase >= 2 ? 1 : 0,
              scale: phase >= 2 ? 1 : 0.7,
            }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={logoShield}
              alt="Chrysler - Dodge Pardubice"
              className="w-36 h-auto md:w-56 drop-shadow-2xl"
              style={{ filter: "drop-shadow(0 0 30px hsla(210,30%,70%,0.4))" }}
            />
          </motion.div>

          {/* Cinematic fog / atmosphere */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(0deg, hsla(218,45%,5%,0.8) 0%, transparent 30%, transparent 70%, hsla(218,45%,5%,0.5) 100%)",
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="intro-exit"
          className="fixed inset-0 z-[9999]"
          style={{ background: "hsl(0 0% 0%)" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;

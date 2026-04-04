import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import introPacifica from "@/assets/intro-pacifica.webp";
import introRam from "@/assets/intro-ram.webp";
import introChallenger from "@/assets/intro-challenger.webp";
import logoShield from "@/assets/logo-shield.webp";

const INTRO_KEY = "chrysler_intro_seen";
const TOTAL_DURATION = 4500; // ms before fade-out starts

const IntroAnimation = () => {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState(0); // 0=cars, 1=lights, 2=logo, 3=fadeout

  const dismiss = useCallback(() => {
    setPhase(3);
    setTimeout(() => {
      setShow(false);
      localStorage.setItem(INTRO_KEY, "1");
      document.body.style.overflow = "";
    }, 900);
  }, []);

  useEffect(() => {
    if (localStorage.getItem(INTRO_KEY)) return;
    setShow(true);
    document.body.style.overflow = "hidden";

    // Phase timeline
    const t1 = setTimeout(() => setPhase(1), 800);   // lights on
    const t2 = setTimeout(() => setPhase(2), 1600);   // logo appear
    const t3 = setTimeout(() => dismiss(), TOTAL_DURATION);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      document.body.style.overflow = "";
    };
  }, [dismiss]);

  if (!show) return null;

  return (
    <AnimatePresence>
      {phase < 3 ? (
        <motion.div
          key="intro-scene"
          className="fixed inset-0 z-[9999] overflow-hidden"
          style={{ background: "linear-gradient(180deg, #050508 0%, #0a0a12 60%, #0d0d18 100%)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          onClick={dismiss}
        >
          {/* Ambient floor reflection */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: "30%",
              background: "linear-gradient(to top, rgba(30,35,50,0.4), transparent)",
            }}
          />

          {/* Headlight cone – directional toward logo */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
            style={{
              opacity: phase >= 1 ? 1 : 0,
              background: `
                radial-gradient(ellipse 60% 50% at 50% 55%, rgba(255,250,220,0.18) 0%, transparent 70%),
                radial-gradient(ellipse 30% 40% at 25% 70%, rgba(255,250,200,0.10) 0%, transparent 60%),
                radial-gradient(ellipse 30% 40% at 75% 70%, rgba(255,250,200,0.10) 0%, transparent 60%)
              `,
              filter: "blur(15px)",
            }}
          />

          {/* Light beams */}
          <div
            className="absolute pointer-events-none transition-opacity duration-700"
            style={{
              opacity: phase >= 1 ? 0.6 : 0,
              top: "30%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "clamp(200px, 50vw, 600px)",
              height: "clamp(100px, 25vh, 300px)",
              background: "radial-gradient(ellipse at center, rgba(255,255,230,0.12) 0%, transparent 70%)",
              filter: "blur(25px)",
            }}
          />

          {/* Cars */}
          <motion.img
            src={introPacifica}
            alt="Chrysler Pacifica"
            className="absolute pointer-events-none"
            style={{
              bottom: "8%",
              left: "5%",
              width: "clamp(100px, 22vw, 320px)",
              height: "auto",
              filter: phase >= 1
                ? "drop-shadow(0 0 20px rgba(255,250,200,0.3)) brightness(1.1)"
                : "brightness(0.6)",
              transition: "filter 0.8s ease",
            }}
            initial={{ opacity: 0, x: -60, y: 20 }}
            animate={{ opacity: 1, x: 0, y: [0, -4, 0] }}
            transition={{
              opacity: { duration: 0.7, delay: 0.1 },
              x: { duration: 0.8, delay: 0.1, ease: "easeOut" },
              y: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 1 },
            }}
          />

          <motion.img
            src={introRam}
            alt="Ram 1500"
            className="absolute pointer-events-none"
            style={{
              bottom: "8%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "clamp(130px, 26vw, 380px)",
              height: "auto",
              filter: phase >= 1
                ? "drop-shadow(0 0 25px rgba(255,250,200,0.35)) brightness(1.15)"
                : "brightness(0.6)",
              transition: "filter 0.8s ease",
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: [0, -5, 0] }}
            transition={{
              opacity: { duration: 0.7 },
              y: { duration: 3.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 1.2 },
            }}
          />

          <motion.img
            src={introChallenger}
            alt="Dodge Challenger"
            className="absolute pointer-events-none"
            style={{
              bottom: "8%",
              right: "5%",
              width: "clamp(100px, 22vw, 320px)",
              height: "auto",
              filter: phase >= 1
                ? "drop-shadow(0 0 20px rgba(255,250,200,0.3)) brightness(1.1)"
                : "brightness(0.6)",
              transition: "filter 0.8s ease",
            }}
            initial={{ opacity: 0, x: 60, y: 20 }}
            animate={{ opacity: 1, x: 0, y: [0, -4, 0] }}
            transition={{
              opacity: { duration: 0.7, delay: 0.1 },
              x: { duration: 0.8, delay: 0.1, ease: "easeOut" },
              y: { duration: 3.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.8 },
            }}
          />

          {/* Headlight glow spots on cars */}
          <div
            className="absolute pointer-events-none transition-opacity duration-500"
            style={{
              opacity: phase >= 1 ? 1 : 0,
              bottom: "12%",
              left: "clamp(40px, 8vw, 120px)",
              width: "clamp(20px, 4vw, 50px)",
              height: "clamp(10px, 2vw, 25px)",
              background: "radial-gradient(ellipse, rgba(255,255,220,0.7) 0%, transparent 70%)",
              filter: "blur(6px)",
            }}
          />
          <div
            className="absolute pointer-events-none transition-opacity duration-500"
            style={{
              opacity: phase >= 1 ? 1 : 0,
              bottom: "12%",
              right: "clamp(40px, 8vw, 120px)",
              width: "clamp(20px, 4vw, 50px)",
              height: "clamp(10px, 2vw, 25px)",
              background: "radial-gradient(ellipse, rgba(255,255,220,0.7) 0%, transparent 70%)",
              filter: "blur(6px)",
            }}
          />

          {/* Logo */}
          <motion.img
            src={logoShield}
            alt="Chrysler Pardubice"
            className="absolute pointer-events-none"
            style={{
              top: "38%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "clamp(120px, 22vw, 360px)",
              height: "auto",
              filter: "drop-shadow(0 0 30px rgba(255,250,200,0.4))",
            }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {/* Cinematic dust particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${1 + Math.random() * 2}px`,
                  height: `${1 + Math.random() * 2}px`,
                  background: `rgba(255,255,220,${0.15 + Math.random() * 0.2})`,
                  left: `${Math.random() * 100}%`,
                  top: `${20 + Math.random() * 60}%`,
                }}
                animate={{
                  y: [0, -20 - Math.random() * 30],
                  x: [0, (Math.random() - 0.5) * 20],
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Skip hint */}
          <motion.span
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs tracking-widest uppercase pointer-events-none"
            style={{ color: "rgba(255,255,255,0.25)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 0.5 }}
          >
            Klikněte pro přeskočení
          </motion.span>
        </motion.div>
      ) : (
        <motion.div
          key="intro-exit"
          className="fixed inset-0 z-[9999]"
          style={{ background: "#050508" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;

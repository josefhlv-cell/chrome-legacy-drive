import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const INTRO_KEY = "chrysler_intro_seen";
const ALWAYS_SHOW_EMAILS = ["admin@chrysler-pardubice.cz"];

const IntroAnimation = () => {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dismiss = useCallback(() => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setShow(false);
      localStorage.setItem(INTRO_KEY, "1");
      document.body.style.overflow = "";
    }, 800);
  }, [fading]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const alwaysShow = user?.email && ALWAYS_SHOW_EMAILS.includes(user.email);

      if (!alwaysShow && localStorage.getItem(INTRO_KEY)) return;

      setShow(true);
      document.body.style.overflow = "hidden";
    };
    checkUser();
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      {!fading ? (
        <motion.div
          key="intro-video"
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          onClick={dismiss}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-contain sm:object-cover"
            autoPlay
            muted
            playsInline
            onEnded={dismiss}
          >
            <source src="/intro.webm" type="video/webm" />
            <source src="/intro.mp4" type="video/mp4" />
          </video>

          <motion.span
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs tracking-widest uppercase pointer-events-none"
            style={{ color: "rgba(255,255,255,0.25)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            Klikněte pro přeskočení
          </motion.span>
        </motion.div>
      ) : (
        <motion.div
          key="intro-exit"
          className="fixed inset-0 z-[9999] bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;

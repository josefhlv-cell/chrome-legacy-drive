import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const INTRO_KEY = "chrysler_intro_seen";

const IntroAnimation = () => {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localStorage.getItem(INTRO_KEY)) return;
    setShow(true);
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleVideoEnd = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShow(false);
      localStorage.setItem(INTRO_KEY, "1");
      document.body.style.overflow = "";
    }, 800);
  };

  // Fallback: if video fails to load, skip intro
  const handleError = () => {
    setShow(false);
    localStorage.setItem(INTRO_KEY, "1");
    document.body.style.overflow = "";
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {!fadeOut ? (
        <motion.div
          key="intro-video"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnd}
            onError={handleError}
            className="w-full h-full object-cover"
          >
            <source src="/intro.webm" type="video/webm" />
            <source src="/intro.mp4" type="video/mp4" />
          </video>
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

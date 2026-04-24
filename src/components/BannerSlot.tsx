import { useEffect, useRef } from "react";
import { useActiveBanners, trackBannerImpression, trackBannerClick, type Banner } from "@/hooks/useBanners";
import { useIsMobile } from "@/hooks/use-mobile";

interface BannerSlotProps {
  page: string;
  position: string;
  /** Render priority: 'high' for above-the-fold (eager), 'low' for below-fold (lazy). */
  priority?: "high" | "low";
}

const useDeviceClass = (b: Banner) => {
  const isMobile = useIsMobile();
  // Treat anything <1024px as mobile/tablet for our toggles
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  if (w < 768) return b.show_mobile;
  if (w < 1024) return b.show_tablet;
  return b.show_desktop;
};

const BannerView = ({ b, priority }: { b: Banner; priority: "high" | "low" }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(false);
  const visible = useDeviceClass(b);

  useEffect(() => {
    if (!visible || seen.current) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !seen.current) {
        seen.current = true;
        trackBannerImpression(b.id);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [b.id, visible]);

  if (!visible) return null;

  const styles = (b.styles as Record<string, any>) || {};
  const overlayOpacity = typeof styles.overlayOpacity === "number" ? styles.overlayOpacity : 0.45;
  const textColor = styles.textColor || "#ffffff";
  const align = styles.align || "center";

  const handleClick = () => {
    trackBannerClick(b.id);
    if (b.link_url) window.open(b.link_url, b.link_url.startsWith("/") ? "_self" : "_blank", "noopener");
  };

  const Media = () => {
    if (b.content_type === "video" && b.media_url) {
      return (
        <video
          src={b.media_url}
          autoPlay
          loop
          muted
          playsInline
          preload={priority === "high" ? "auto" : "metadata"}
          className="absolute inset-0 w-full h-full object-cover"
        />
      );
    }
    if (b.media_url) {
      return (
        <img
          src={b.media_url}
          alt={b.headline || b.name}
          loading={priority === "high" ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority === "high" ? "high" : "auto"}
          className="absolute inset-0 w-full h-full object-cover"
        />
      );
    }
    return null;
  };

  // Layout: HERO — full width, tall
  if (b.layout_variant === "hero") {
    return (
      <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 7", minHeight: 280 }}>
        <Media />
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
        <div className={`relative h-full w-full flex flex-col justify-center px-6 md:px-12 text-${align}`}
             style={{ color: textColor, alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
          {b.headline && <h2 className="font-serif text-3xl md:text-5xl font-bold drop-shadow-lg max-w-3xl">{b.headline}</h2>}
          {b.subheadline && <p className="font-montserrat mt-3 text-base md:text-lg max-w-2xl opacity-90">{b.subheadline}</p>}
          {b.cta_text && (
            <button onClick={handleClick} className="chrome-button mt-6 inline-flex items-center gap-2">
              {b.cta_text}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Layout: BOX — contained card
  if (b.layout_variant === "box") {
    return (
      <div ref={ref} className="container mx-auto px-4 my-8">
        <div className="relative overflow-hidden rounded-2xl border border-border deep-card" style={{ minHeight: 200 }}>
          <Media />
          <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
          <div className="relative p-6 md:p-10" style={{ color: textColor }}>
            {b.headline && <h3 className="font-serif text-2xl md:text-3xl font-bold">{b.headline}</h3>}
            {b.subheadline && <p className="font-montserrat mt-2 opacity-90">{b.subheadline}</p>}
            {b.cta_text && (
              <button onClick={handleClick} className="chrome-button mt-4 inline-flex">{b.cta_text}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Layout: STICKY — slim notification bar
  return (
    <div ref={ref}
         className="w-full"
         style={{ background: styles.bgColor || "hsl(var(--primary))", color: textColor }}>
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4 text-sm font-montserrat">
        <div className="flex-1 min-w-0 truncate">
          {b.headline && <strong className="mr-2">{b.headline}</strong>}
          {b.subheadline && <span className="opacity-90">{b.subheadline}</span>}
        </div>
        {b.cta_text && (
          <button onClick={handleClick}
                  className="shrink-0 px-3 py-1 rounded bg-background/20 hover:bg-background/30 transition-colors uppercase tracking-wider text-xs font-semibold">
            {b.cta_text}
          </button>
        )}
      </div>
    </div>
  );
};

const BannerSlot = ({ page, position, priority = "low" }: BannerSlotProps) => {
  const { data: banners } = useActiveBanners(page, position);
  if (!banners || banners.length === 0) return null;
  return (
    <>
      {banners.map((b) => <BannerView key={b.id} b={b} priority={priority} />)}
    </>
  );
};

export default BannerSlot;

import { useEffect, useRef } from "react";
import { useActiveBanners, trackBannerImpression, trackBannerClick, isPreviewMode, type Banner } from "@/hooks/useBanners";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveDeepLink, isExternalUrl, type LinkConfig } from "@/lib/deepLink";
import { ArrowRight } from "lucide-react";

interface BannerSlotProps {
  page: string;
  position: string;
  /** 'high' for above-the-fold (eager), 'low' for below-fold (lazy). */
  priority?: "high" | "low";
}

const useDeviceClass = (b: Banner) => {
  // Re-evaluate on resize so toggle device toggles work
  const isMobile = useIsMobile();
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  if (w < 768) return b.show_mobile;
  if (w < 1024) return b.show_tablet;
  return b.show_desktop;
};

const useResolvedHref = (b: Banner) => {
  const link = (b.link_config as LinkConfig) || {};
  return resolveDeepLink(link, b.link_url);
};

const useImpression = (id: string, visible: boolean) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(false);
  useEffect(() => {
    if (!visible || seen.current || isPreviewMode()) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !seen.current) {
        seen.current = true;
        trackBannerImpression(id);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [id, visible]);
  return ref;
};

const handleClick = (b: Banner, href: string) => {
  if (!isPreviewMode()) trackBannerClick(b.id);
  if (!href) return;
  if (isExternalUrl(href)) window.open(href, "_blank", "noopener,noreferrer");
  else window.location.assign(href);
};

const Media = ({ b, priority }: { b: Banner; priority: "high" | "low" }) => {
  if (b.content_type === "video" && b.media_url) {
    return (
      <video
        src={b.media_url}
        autoPlay loop muted playsInline
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

const BannerView = ({ b, priority }: { b: Banner; priority: "high" | "low" }) => {
  const visible = useDeviceClass(b);
  const ref = useImpression(b.id, visible);
  const href = useResolvedHref(b);
  if (!visible) return null;

  const styles = (b.styles as Record<string, any>) || {};
  const content = (b.content_data as Record<string, any>) || {};
  const overlayOpacity = typeof styles.overlayOpacity === "number" ? styles.overlayOpacity : 0.45;
  const textColor = styles.textColor || "#ffffff";
  const align = styles.align || "center";

  const headline = content.title || b.headline;
  const subheadline = content.body || b.subheadline;
  const cta = content.button_text || b.cta_text;

  const preset = b.style_preset || b.layout_variant || "hero";
  const onClick = () => handleClick(b, href);

  // Draft badge in preview mode
  const DraftBadge = !b.is_active && isPreviewMode() ? (
    <span className="absolute top-2 left-2 z-20 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-black">
      Draft
    </span>
  ) : null;

  // ───────────────── NATIVE SERVICE CARD ─────────────────
  if (preset === "native_service_card") {
    return (
      <div ref={ref} className="container mx-auto px-4 my-8">
        <div className="relative deep-card p-6 md:p-8 group cursor-pointer hover:scale-[1.01] transition-transform" onClick={onClick}>
          {DraftBadge}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {content.icon_svg ? (
              <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0"
                   dangerouslySetInnerHTML={{ __html: content.icon_svg }} />
            ) : b.media_url ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary shrink-0">
                <img src={b.media_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div className="flex-1">
              {headline && <h3 className="font-serif text-2xl text-foreground font-bold">{headline}</h3>}
              {subheadline && <p className="font-montserrat text-muted-foreground mt-2 leading-relaxed">{subheadline}</p>}
              {cta && (
                <button className="chrome-button mt-4 inline-flex items-center gap-2">
                  {cta} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────── NATIVE VEHICLE CARD ─────────────────
  if (preset === "native_vehicle_card") {
    return (
      <div ref={ref} className="container mx-auto px-4 my-8">
        <div className="glass-card overflow-hidden cursor-pointer group" onClick={onClick}>
          {DraftBadge}
          <div className="relative aspect-[3/2] bg-background overflow-hidden">
            <Media b={b} priority={priority} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6" style={{ color: textColor }}>
              {headline && <h3 className="font-serif text-2xl md:text-3xl font-bold drop-shadow">{headline}</h3>}
              {subheadline && <p className="font-montserrat mt-1 opacity-90">{subheadline}</p>}
              {cta && (
                <button className="chrome-button mt-4 inline-flex items-center gap-2" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                  {cta} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────── HERO ─────────────────
  if (preset === "hero") {
    return (
      <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 7", minHeight: 280 }}>
        {DraftBadge}
        <Media b={b} priority={priority} />
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
        <div className="relative h-full w-full flex flex-col justify-center px-6 md:px-12"
             style={{ color: textColor, alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", textAlign: align as any }}>
          {headline && <h2 className="font-serif text-3xl md:text-5xl font-bold drop-shadow-lg max-w-3xl">{headline}</h2>}
          {subheadline && <p className="font-montserrat mt-3 text-base md:text-lg max-w-2xl opacity-90">{subheadline}</p>}
          {cta && (
            <button onClick={onClick} className="chrome-button mt-6 inline-flex items-center gap-2">
              {cta} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ───────────────── BOX ─────────────────
  if (preset === "box") {
    return (
      <div ref={ref} className="container mx-auto px-4 my-8">
        <div className="relative overflow-hidden rounded-2xl border border-border deep-card" style={{ minHeight: 200 }}>
          {DraftBadge}
          <Media b={b} priority={priority} />
          <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
          <div className="relative p-6 md:p-10" style={{ color: textColor }}>
            {headline && <h3 className="font-serif text-2xl md:text-3xl font-bold">{headline}</h3>}
            {subheadline && <p className="font-montserrat mt-2 opacity-90">{subheadline}</p>}
            {cta && <button onClick={onClick} className="chrome-button mt-4 inline-flex">{cta}</button>}
          </div>
        </div>
      </div>
    );
  }

  // ───────────────── STICKY (sticky/floating bar) ─────────────────
  return (
    <div ref={ref} className="w-full relative" style={{ background: styles.bgColor || "hsl(var(--primary))", color: textColor }}>
      {DraftBadge}
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4 text-sm font-montserrat">
        <div className="flex-1 min-w-0 truncate">
          {headline && <strong className="mr-2">{headline}</strong>}
          {subheadline && <span className="opacity-90">{subheadline}</span>}
        </div>
        {cta && (
          <button onClick={onClick}
                  className="shrink-0 px-3 py-1 rounded bg-background/20 hover:bg-background/30 transition-colors uppercase tracking-wider text-xs font-semibold">
            {cta}
          </button>
        )}
      </div>
    </div>
  );
};

const BannerSlot = ({ page, position, priority = "low" }: BannerSlotProps) => {
  const { data: banners, refetch } = useActiveBanners(page, position);
  // React to preview mode changes
  useEffect(() => {
    const h = () => refetch();
    window.addEventListener("cms-preview-changed", h);
    return () => window.removeEventListener("cms-preview-changed", h);
  }, [refetch]);

  if (!banners || banners.length === 0) return null;
  return (
    <>
      {banners.map((b) => <BannerView key={b.id} b={b} priority={priority} />)}
    </>
  );
};

export default BannerSlot;

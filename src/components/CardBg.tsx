/**
 * Shared decorative card background.
 * Single source of truth for the "decentní obrázek v pozadí" treatment used on
 * the Service page, the homepage service cards and the About page.
 * All images are local project assets (bundled by Vite) — no CDN pointers,
 * so Preview, Local and Production render identically.
 */
type CardBgProps = {
  src: string;
  /** Vertical focus of the image. */
  position?: string;
  /** Override opacity (default 0.16 — same as the mobile menu). */
  opacity?: number;
  /** Brighter treatment for logo/transparent artwork. */
  variant?: "photo" | "logo";
};

const MASK = "linear-gradient(to bottom, transparent 0%, black 30%, black 75%, transparent 100%)";
const LOGO_MASK = "linear-gradient(to bottom, black 0%, black 45%, transparent 85%)";

const CardBg = ({ src, position = "center 40%", opacity = 0.16, variant = "photo" }: CardBgProps) => (
  <div
    aria-hidden="true"
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: `url(${src})`,
      backgroundSize: variant === "logo" ? "contain" : "cover",
      backgroundPosition: position,
      backgroundRepeat: "no-repeat",
      opacity,
      filter:
        variant === "logo"
          ? "grayscale(0.55) contrast(1.05) brightness(1.15)"
          : "grayscale(0.55) contrast(0.95) brightness(0.9)",
      maskImage: variant === "logo" ? LOGO_MASK : MASK,
      WebkitMaskImage: variant === "logo" ? LOGO_MASK : MASK,
    }}
  />
);

export default CardBg;

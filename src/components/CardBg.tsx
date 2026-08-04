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
  /**
   * "cover" = image fills the frame (may crop),
   * "contain" = whole image always visible, fitted to the frame.
   */
  fit?: "cover" | "contain" | "stretch";
  /** Inner breathing room so the artwork doesn't touch the card edges. */
  inset?: string;
  /** Solid colour stretched across the whole card, behind the artwork. */
  backdrop?: string;
  /** Keep the original colours (no grayscale) — for coloured logo artwork. */
  keepColor?: boolean;
};

const MASK = "linear-gradient(to bottom, transparent 0%, black 30%, black 75%, transparent 100%)";
const LOGO_MASK = "linear-gradient(to bottom, black 0%, black 45%, transparent 85%)";
const SOFT_MASK = "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)";

const CardBg = ({
  src, position = "center 40%", opacity = 0.16, variant = "photo", fit, inset, backdrop, keepColor,
}: CardBgProps) => {
  const mask = inset || fit ? SOFT_MASK : variant === "logo" ? LOGO_MASK : MASK;
  return (
    <>
      {backdrop && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: backdrop, maskImage: mask, WebkitMaskImage: mask }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          padding: inset,
          boxSizing: "border-box",
          backgroundImage: `url(${src})`,
          backgroundClip: inset ? "content-box" : undefined,
          backgroundOrigin: inset ? "content-box" : undefined,
          backgroundSize:
            fit === "stretch" ? "100% 100%" : fit === "contain" ? "contain" : fit === "cover" ? "cover" : variant === "logo" ? "contain" : "cover",
          backgroundPosition: fit || inset ? "center" : position,
          backgroundRepeat: "no-repeat",
          opacity,
          filter: keepColor
            ? "contrast(1.05) brightness(1.1)"
            : variant === "logo"
              ? "grayscale(0.55) contrast(1.05) brightness(1.15)"
              : "grayscale(0.55) contrast(0.95) brightness(0.9)",
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
    </>
  );
};

export default CardBg;

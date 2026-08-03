/**
 * Local (bundled) background images for service cards.
 * Used by the Service page and the homepage service preview so both surfaces
 * always render the same artwork. No CDN / .asset.json pointers.
 */
import udrzba from "@/assets/servis/udrzba.webp";
import lpg from "@/assets/servis/lpg.webp";
import mopar from "@/assets/servis/mopar.webp";
import diagnostika from "@/assets/servis/diagnostika.webp";
import stk from "@/assets/servis/stk.webp";
import lakovna from "@/assets/servis/lakovna.webp";
import prevodovky from "@/assets/servis/prevodovky.webp";
import fca from "@/assets/servis/fca.webp";

export const SERVICE_BG = {
  udrzba,
  lpg,
  mopar,
  diagnostika,
  stk,
  lakovna,
  prevodovky,
  fca,
} as const;

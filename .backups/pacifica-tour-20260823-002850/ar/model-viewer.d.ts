/**
 * Minimální typové deklarace pro <model-viewer> (@google/model-viewer),
 * aby ho šlo použít jako běžný JSX/React element.
 *
 * Pokrývá jen atributy, které v projektu skutečně používáme.
 * Plná dokumentace: https://modelviewer.dev/docs/
 */
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        ModelViewerJSX,
        ModelViewerElement
      >;
    }
  }
}

interface ModelViewerJSX extends HTMLAttributes<HTMLElement> {
  src?: string;
  "ios-src"?: string;
  alt?: string;
  ar?: boolean;
  "ar-modes"?: string;
  "ar-scale"?: "auto" | "fixed";
  "ar-placement"?: "floor" | "wall";
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "shadow-intensity"?: string | number;
  exposure?: string | number;
  poster?: string;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "interaction" | "manual";
  "disable-zoom"?: boolean;
}

interface ModelViewerElement extends HTMLElement {
  src: string;
  canActivateAR: boolean;
  activateAR: () => Promise<void>;
}

export {};

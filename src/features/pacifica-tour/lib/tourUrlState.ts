/**
 * Deep-linky pro virtuální prohlídku.
 *
 * Podporované parametry:
 *   ?prohlidka=1        — prohlídka se spustí bez hero obrazovky
 *   ?krok=<hotspot id>  — otevře konkrétní bod zájmu v exteriéru
 *   ?interier=1         — otevře interiérovou část
 *   ?ikrok=<step id>    — konkrétní krok interiéru
 *   ?barva=<key>        — předvolená barva laku
 *   ?ar=1               — po otevření se hned pokusí spustit AR
 *
 * Stav se do URL zapisuje přes history.replaceState / pushState, takže
 * se nespouští re-render routeru, ale tlačítko „zpět“ v prohlížeči se chová
 * uvnitř prohlídky (nevyskočí z ní hned na homepage).
 */

export type TourUrlState = {
  started: boolean;
  hotspot: string | null;
  interior: boolean;
  interiorStep: string | null;
  color: string;
  ar: boolean;
};

export const readTourUrlState = (): TourUrlState => {
  if (typeof window === "undefined") {
    return {
      started: false,
      hotspot: null,
      interior: false,
      interiorStep: null,
      color: "original",
      ar: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const hotspot = params.get("krok");
  const interior = params.get("interier") === "1";
  const interiorStep = params.get("ikrok");

  return {
    started:
      params.get("prohlidka") === "1" ||
      !!hotspot ||
      interior ||
      !!interiorStep,
    hotspot,
    interior: interior || !!interiorStep,
    interiorStep,
    color: params.get("barva") || "original",
    ar: params.get("ar") === "1",
  };
};

type WriteOptions = {
  push?: boolean;
};

export const writeTourUrlState = (
  state: Partial<TourUrlState>,
  { push = false }: WriteOptions = {},
): void => {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);

  const set = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };

  if ("started" in state) set("prohlidka", state.started ? "1" : null);
  if ("hotspot" in state) set("krok", state.hotspot ?? null);
  if ("interior" in state) set("interier", state.interior ? "1" : null);
  if ("interiorStep" in state) set("ikrok", state.interiorStep ?? null);
  if ("color" in state)
    set("barva", state.color && state.color !== "original" ? state.color : null);

  // ?ar=1 je jednorázový spouštěč — po použití ho z URL vždy odstraníme.
  if ("ar" in state) set("ar", state.ar ? "1" : null);

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;

  if (push) window.history.pushState({ tour: true }, "", url);
  else window.history.replaceState({ tour: true }, "", url);
};

/** Absolutní URL pro QR kód / sdílení. */
export const buildShareUrl = (
  state: Partial<TourUrlState> & { ar?: boolean } = {},
): string => {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams();
  params.set("prohlidka", "1");

  if (state.hotspot) params.set("krok", state.hotspot);
  if (state.interior) params.set("interier", "1");
  if (state.interiorStep) params.set("ikrok", state.interiorStep);
  if (state.color && state.color !== "original") params.set("barva", state.color);
  if (state.ar) params.set("ar", "1");

  params.set("utm_source", "qr");
  params.set("utm_medium", "showroom");
  params.set("utm_campaign", "pacifica-ar");

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
};

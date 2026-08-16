const TOUR_ASSETS = "/pacifica/virtual-tour";

const extHeadlight = `${TOUR_ASSETS}/exterior-headlight.png`;
const extWheel = `${TOUR_ASSETS}/exterior-wheel.png`;
const doorVideo = `${TOUR_ASSETS}/01_sliding_door_opening.mp4`;

export type CameraShot = {
  position: [number, number, number];
  target: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
};

export const DEFAULT_SHOT: CameraShot = {
  position: [5.4, 2.1, 5.6],
  target: [0, 0.85, 0],
  minDistance: 3.6,
  maxDistance: 13,
};

export type HotspotMedia = {
  type: "image" | "video";
  src: string;
  poster?: string;
  caption?: string;
};

export type HotspotDetail = {
  eyebrow: string;
  title: string;
  text: string;
  bullets: string[];
  specs?: { label: string; value: string }[];
  media?: HotspotMedia;
  cta?: {
    label: string;
    action: "interior";
  };
  note?: string;
};

export type TourHotspot = {
  id: string;
  label: string;
  position: [number, number, number];
  focus: {
    position: [number, number, number];
    lookAt: [number, number, number];
  };
  detail: HotspotDetail;
};

const PHOTO_CAPTION = "Detail konkrétního vozu — Chrysler Pardubice";
const VIDEO_CAPTION = "Reálné video vozu — Chrysler Pardubice";
const EQUIP_NOTE = "Uvedené funkce se mohou lišit podle výbavy vozu.";

export const HOTSPOTS: TourHotspot[] = [
  {
    id: "headlights",
    label: "Přední světlomet",
    position: [0.74, 0.98, 2.16],
    focus: {
      position: [3.1, 1.5, 4.6],
      lookAt: [0.4, 0.9, 1.9],
    },
    detail: {
      eyebrow: "Přední část",
      title: "Přední světlomet",
      text:
        "Detail předního světlometu konkrétního vozu. Na fotografii je patrné pouzdro světlometu s výraznou světelnou grafikou a integrovaným směrovým světlem.",
      bullets: [
        "Členěná světelná grafika ve tmavém pouzdře",
        "Chromové orámování a navazující maska",
        "Konkrétní typ světlometu odpovídá výbavě vozu",
      ],
      note: EQUIP_NOTE,
      media: {
        type: "image",
        src: extHeadlight,
        caption: PHOTO_CAPTION,
      },
    },
  },

  {
    id: "wheels",
    label: "Kolo a pneumatika",
    position: [1.02, 0.42, 1.62],
    focus: {
      position: [3.4, 0.95, 2.9],
      lookAt: [0.6, 0.42, 1.6],
    },
    detail: {
      eyebrow: "Podvozek",
      title: "Kolo a pneumatika",
      text:
        "Detail kola konkrétního vozu. Na fotografii je vidět lehký slitinový ráfek s vícepaprskovým designem, středová krytka se znakem Chrysler a pneumatika s vyšším profilem.",
      bullets: [
        "Slitinový ráfek s vícepaprskovým designem",
        "Středová krytka se znakem Chrysler",
        "Rozměr pneumatiky i typ brzd odpovídá konkrétní výbavě vozu",
      ],
      note: EQUIP_NOTE,
      media: {
        type: "image",
        src: extWheel,
        caption: PHOTO_CAPTION,
      },
    },
  },

  {
    id: "engine",
    label: "Motor",
    position: [0.34, 1.18, 1.48],
    focus: {
      position: [2.6, 2.3, 4.4],
      lookAt: [0, 1.1, 1.5],
    },
    detail: {
      eyebrow: "Pohon",
      title: "3.6L Pentastar V6",
      text:
        "Pod kapotou je benzinový šestiválec 3.6 litru s výkonem 287 koní (211 kW) a točivým momentem 262 lb-ft. Přenos výkonu zajišťuje 9stupňová automatická převodovka.",
      bullets: [
        "9stupňová automatická převodovka",
        "AWD — podle systému může být moment přenášen mezi nápravami podle trakce",
        "Automatické řízení pohonu pro efektivní provoz",
      ],
      specs: [
        {
          label: "Objem",
          value: "3,6 l V6",
        },
        {
          label: "Výkon",
          value: "287 hp / 211 kW",
        },
        {
          label: "Moment",
          value: "262 lb-ft",
        },
        {
          label: "Převodovka",
          value: "9st. automat",
        },
      ],
      note: EQUIP_NOTE,
    },
  },

  {
    id: "sliding-doors",
    label: "Prohlédnout posuvné dveře",
    position: [1.04, 1.02, -0.36],
    focus: {
      position: [3.9, 1.5, -0.2],
      lookAt: [0.5, 1.0, -0.4],
    },
    detail: {
      eyebrow: "Nástup",
      title: "Elektrické posuvné dveře",
      text:
        "Praktické řešení pro pohodlný nástup cestujících a snadný přístup do druhé řady. Konkrétní způsob ovládání a dostupné funkce závisí na výbavě vozu.",
      bullets: [
        "Posuvné boční dveře s širokým otvorem pro nástup",
        "Snadný přístup do druhé i třetí řady",
        "Způsob ovládání podle výbavy vozu",
      ],
      note: EQUIP_NOTE,
      media: {
        type: "video",
        src: doorVideo,
        caption: VIDEO_CAPTION,
      },
    },
  },
];

export const BODY_COLORS: {
  key: string;
  label: string;
  hex: string | null;
}[] = [
  {
    key: "original",
    label: "Originál",
    hex: null,
  },
  {
    key: "white",
    label: "Bílá",
    hex: "#e9ebee",
  },
  {
    key: "black",
    label: "Černá",
    hex: "#0d0f12",
  },
  {
    key: "silver",
    label: "Šedá",
    hex: "#9aa2ab",
  },
  {
    key: "navy",
    label: "Tmavě modrá",
    hex: "#12203c",
  },
  {
    key: "red",
    label: "Vínová",
    hex: "#5d1220",
  },
];

export const MODEL_ATTRIBUTION =
  "3D model: SanjithKid45 (Sketchfab), CC-BY-4.0";

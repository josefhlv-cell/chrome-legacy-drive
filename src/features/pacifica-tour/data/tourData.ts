/**
 * Jediné místo s daty prohlídky Chrysler Pacifica Limited AWD.
 *
 * Exteriér je VŽDY reprezentován skutečným 3D modelem. Reálné fotografie
 * a videa se používají pouze jako detail uvnitř informační karty
 * (a u interiéru jako hlavní vizuál karty) — nikdy jako náhrada 3D exteriéru.
 */

export type CameraShot = {
  position: [number, number, number];
  target: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
};

/** Výchozí orbit pohled na vůz (metry, vůz je 5,18 m dlouhý, přední část na +Z). */
export const DEFAULT_SHOT: CameraShot = {
  position: [5.4, 2.1, 5.6],
  target: [0, 0.85, 0],
  minDistance: 3.6,
  maxDistance: 13,
};

export type HotspotMedia = {
  type: "image" | "video";
  src: string;
  /** Poster u videa. */
  poster?: string;
  /** Popisek zdroje pod médiem. */
  caption?: string;
};

export type HotspotDetail = {
  eyebrow: string;
  title: string;
  text: string;
  bullets: string[];
  specs?: { label: string; value: string }[];
  media?: HotspotMedia;
};

export type TourHotspot = {
  id: string;
  label: string;
  /** Skutečná pozice na modelu (metry) — snadno ručně upravitelné. */
  position: [number, number, number];
  /** Cinematic přiblížení kamery po kliknutí. */
  focus: { position: [number, number, number]; lookAt: [number, number, number] };
  detail: HotspotDetail;
};

const photo = (n: string) => `/pacifica/${n}`;
const clip = (n: string) => `/pacifica/clips/${n}.mp4`;
const poster = (n: string) => `/pacifica/clips/${n}.jpg`;
const PHOTO_CAPTION = "Detail konkrétního vozu — Chrysler Pardubice";
const VIDEO_CAPTION = "Reálné video vozu — Chrysler Pardubice";

export const HOTSPOTS: TourHotspot[] = [
  {
    id: "headlights",
    label: "Světla",
    position: [0.74, 0.98, 2.16],
    focus: { position: [3.1, 1.5, 4.6], lookAt: [0.4, 0.9, 1.9] },
    detail: {
      eyebrow: "Přední i zadní část",
      title: "Plná LED světla",
      text: "Přední i zadní světla jsou celoLEDová — včetně LED mlhovek. Oproti klasickým žárovkám svítí jasněji, spotřebují méně energie a vydrží prakticky celou životnost auta.",
      bullets: [
        "LED světlomety i LED zadní světla",
        "LED mlhovky",
        "Nižší spotřeba energie, delší životnost",
      ],
      media: { type: "image", src: photo("detail-headlight.webp"), caption: PHOTO_CAPTION },
    },
  },
  {
    id: "wheels",
    label: "Kola",
    position: [1.02, 0.42, 1.62],
    focus: { position: [3.4, 0.95, 2.9], lookAt: [0.6, 0.42, 1.6] },
    detail: {
      eyebrow: "Podvozek",
      title: "Kola a design ráfků",
      text: "Vůz stojí na lehkých slitinových ráfcích s vícepaprskovým designem. Kombinace většího průměru kola a vysokoprofilové pneumatiky drží komfort odpružení, na který je minivan stavěný.",
      bullets: [
        "Slitinové ráfky s vícepaprskovým designem",
        "Krytky kol se znakem Chrysler",
        "Kotoučové brzdy na všech kolech",
      ],
      media: { type: "image", src: photo("detail-wheel.webp"), caption: PHOTO_CAPTION },
    },
  },
  {
    id: "engine",
    label: "Motor",
    position: [0.34, 1.18, 1.48],
    focus: { position: [2.6, 2.3, 4.4], lookAt: [0, 1.1, 1.5] },
    detail: {
      eyebrow: "Pohon",
      title: "3.6L Pentastar V6",
      text: "Pod kapotou je benzinový šestiválec 3.6 litru s výkonem 287 koní (211 kW) a točivým momentem 262 lb-ft. Zážeh přes 9stupňovou automatickou převodovku. U AWD verze umí systém pohonu poslat až 100 % výkonu na zadní nápravu, když přední kola ztrácí trakci.",
      bullets: [
        "9stupňová automatická převodovka",
        "AWD — až 100 % momentu na zadní nápravu",
        "Automatické odpojení pohonu zadní nápravy pro nižší spotřebu",
      ],
      specs: [
        { label: "Objem", value: "3,6 l V6" },
        { label: "Výkon", value: "287 hp / 211 kW" },
        { label: "Moment", value: "262 lb-ft" },
        { label: "Převodovka", value: "9st. automat" },
      ],
    },
  },
  {
    id: "uconnect",
    label: "Uconnect 5",
    position: [0.6, 1.34, 0.98],
    focus: { position: [2.5, 1.75, 2.3], lookAt: [0.2, 1.25, 1.0] },
    detail: {
      eyebrow: "Palubní deska",
      title: "Uconnect 5",
      text: "10,1palcová dotyková obrazovka s Apple CarPlay, Android Auto a WiFi hotspotem. Ovládá navigaci, klimatizaci, audio i nastavení auta.",
      bullets: [
        "10,1\" dotykový displej",
        "Apple CarPlay a Android Auto",
        "WiFi hotspot",
        "Ovládání klimatizace, audia i nastavení vozu",
      ],
      media: { type: "image", src: photo("uconnect.webp"), caption: PHOTO_CAPTION },
    },
  },
  {
    id: "sliding-doors",
    label: "Posuvné dveře",
    position: [1.04, 1.02, -0.36],
    focus: { position: [3.9, 1.5, -0.2], lookAt: [0.5, 1.0, -0.4] },
    detail: {
      eyebrow: "Nástup",
      title: "Elektrické posuvné dveře",
      text: "Obě boční dveře se otevírají a zavírají elektricky — stačí tlačítko na klíčence, na palubní desce, nebo pohyb nohou pod nárazníkem (hands-free). Ideální s náručí plnou tašek nebo s dětmi.",
      bullets: [
        "Elektrické otevírání i zavírání",
        "Ovládání z klíčenky i z palubní desky",
        "Hands-free otevření pohybem nohy",
      ],
      media: {
        type: "video",
        src: clip("sliding-doors"),
        poster: poster("sliding-doors"),
        caption: VIDEO_CAPTION,
      },
    },
  },
  {
    id: "liftgate",
    label: "Páté dveře",
    position: [0.5, 1.34, -2.42],
    focus: { position: [2.4, 1.9, -4.6], lookAt: [0, 1.2, -2.3] },
    detail: {
      eyebrow: "Zadní část",
      title: "Elektrické víko kufru",
      text: "Zadní víko kufru se otevírá a zavírá elektricky, včetně motion-activated režimu (pohyb nohou pod nárazníkem). Nastavitelná výška otevření, ať se vejde i do nižší garáže.",
      bullets: [
        "Elektrické otevírání a zavírání",
        "Otevření pohybem nohy pod nárazníkem",
        "Nastavitelná výška otevření",
      ],
      media: {
        type: "video",
        src: clip("liftgate"),
        poster: poster("liftgate"),
        caption: VIDEO_CAPTION,
      },
    },
  },
  {
    id: "stow-n-go",
    label: "Stow'n'Go",
    position: [1.02, 1.46, -0.95],
    focus: { position: [3.4, 1.9, -1.6], lookAt: [0.4, 1.2, -1.0] },
    detail: {
      eyebrow: "2. a 3. řada",
      title: "Stow'n'Go sedadla",
      text: "Sedadla 2. i 3. řady se dají sklopit přímo do podlahy — bez snímání, jen je sklopíš a zmizí. U verzí s pohonem všech kol (AWD) tohle donedávna nešlo kvůli technice pod podlahou, 2021 Pacifica to jako první AWD minivan zvládá taky.",
      bullets: [
        "Sklopení 2. i 3. řady do podlahy",
        "Bez demontáže sedadel",
        "Funguje i u AWD verze",
      ],
      media: {
        type: "video",
        src: clip("row3-fold"),
        poster: poster("row3-fold"),
        caption: VIDEO_CAPTION,
      },
    },
  },
  {
    id: "cargo",
    label: "Kufr",
    position: [0.86, 0.9, -2.3],
    focus: { position: [2.9, 1.5, -4.2], lookAt: [0.3, 0.95, -2.1] },
    detail: {
      eyebrow: "Nákladový prostor",
      title: "Až 140,5 kubické stopy",
      text: "Se sklopenou 2. a 3. řadou (Stow'n'Go) nabídne kufr přes 140 kubických stop nákladového prostoru — dost na nábytek nebo týdenní nákup na měsíc.",
      bullets: [
        "140,5 cu ft se sklopenou 2. i 3. řadou",
        "Rovná podlaha bez prahu",
        "Hluboké úložné vany pod podlahou",
      ],
      media: { type: "image", src: photo("cargo.webp"), caption: PHOTO_CAPTION },
    },
  },
  {
    id: "audio",
    label: "Harman/Kardon",
    position: [1.04, 1.2, -1.55],
    focus: { position: [3.3, 1.6, -2.2], lookAt: [0.5, 1.1, -1.6] },
    detail: {
      eyebrow: "Audio",
      title: "Harman/Kardon audio",
      text: "Prémiový zvukový systém Harman/Kardon s 19 reproduktory a samostatným subwooferem — výrazně bohatší zvuk než základní audio.",
      bullets: ["19 reproduktorů", "Samostatný subwoofer", "Ovládání přes Uconnect 5"],
      media: { type: "image", src: photo("console.webp"), caption: PHOTO_CAPTION },
    },
  },
  {
    id: "interior",
    label: "Interiér",
    position: [1.0, 1.5, 0.3],
    focus: { position: [3.2, 1.9, 1.5], lookAt: [0.3, 1.25, 0.3] },
    detail: {
      eyebrow: "Prostor",
      title: "Prostor pro 7 osob",
      text: "165 kubických stop vnitřního prostoru, tři samostatné klimatizační zóny, vyhřívaná sedadla 2. řady a panoramatické střešní okno. Přední řada nabízí 41 palců místa na nohy — víc než u většiny SUV.",
      bullets: [
        "7 míst k sezení",
        "Tři samostatné klimatizační zóny",
        "Vyhřívaná sedadla 2. řady",
        "Panoramatické střešní okno",
      ],
      media: { type: "image", src: photo("cockpit.webp"), caption: PHOTO_CAPTION },
    },
  },
];

/** Barvy laku — mění se pouze základní barva karoserie, ostatní materiály zůstávají. */
export const BODY_COLORS: { key: string; label: string; hex: string | null }[] = [
  { key: "original", label: "Originál", hex: null },
  { key: "white", label: "Bílá", hex: "#e9ebee" },
  { key: "black", label: "Černá", hex: "#0d0f12" },
  { key: "silver", label: "Šedá", hex: "#9aa2ab" },
  { key: "navy", label: "Tmavě modrá", hex: "#12203c" },
  { key: "red", label: "Vínová", hex: "#5d1220" },
];

/** Atribuce modelu (CC-BY-4.0). */
export const MODEL_ATTRIBUTION = "3D model: SanjithKid45 (Sketchfab), CC-BY-4.0";

import type { PartKey } from "../model/parts";

/** Kamera pro danou scénu / pohled. */
export type CameraShot = {
  position: [number, number, number];
  target: [number, number, number];
  /** Povolit orbit (exteriér) nebo jen omezené rozhlížení (interiér). */
  orbit: boolean;
  minDistance?: number;
  maxDistance?: number;
};

export type ViewKey = "exterior" | "driver" | "row2" | "row3" | "cargo";

export const VIEWS: { key: ViewKey; label: string; shot: CameraShot }[] = [
  {
    key: "exterior",
    label: "Exteriér",
    shot: {
      position: [6.6, 2.3, 6.4],
      target: [0, 1.0, 0],
      orbit: true,
      minDistance: 4.2,
      maxDistance: 16,
    },
  },
  {
    key: "driver",
    label: "Řidič",
    shot: { position: [-0.45, 1.3, 0.25], target: [-0.1, 1.15, 1.6], orbit: true, minDistance: 0.4, maxDistance: 2.4 },
  },
  {
    key: "row2",
    label: "2. řada",
    shot: { position: [0, 1.4, -0.45], target: [0, 1.05, 0.8], orbit: true, minDistance: 0.4, maxDistance: 2.4 },
  },
  {
    key: "row3",
    label: "3. řada",
    shot: { position: [0, 1.4, -1.5], target: [0, 1.05, -0.4], orbit: true, minDistance: 0.4, maxDistance: 2.4 },
  },
  {
    key: "cargo",
    label: "Kufr",
    shot: { position: [0, 1.7, -4.6], target: [0, 0.95, -1.7], orbit: true, minDistance: 1.6, maxDistance: 8 },
  },
];

export type DetailVariant = {
  label: string;
  text: string;
  bullets: string[];
};

export type HotspotDetail = {
  title: string;
  eyebrow: string;
  text: string;
  bullets: string[];
  /** Referenční fotografie z existující prohlídky (ilustrační materiál). */
  image?: string;
  specs?: { label: string; value: string }[];
  variants?: DetailVariant[];
};

export type HotspotAction =
  | { type: "toggle"; parts: PartKey[]; labelOn: string; labelOff: string }
  | { type: "lights"; labelOn: string; labelOff: string }
  | { type: "goToView"; view: ViewKey };

export type TourHotspot = {
  id: string;
  label: string;
  view: ViewKey;
  /** Skutečná pozice ve 3D scéně — hotspot je ukotvený k modelu. */
  position: [number, number, number];
  /** Cinematic přejezd kamery po kliknutí. */
  focus?: { position: [number, number, number]; target: [number, number, number] };
  detail?: HotspotDetail;
  action?: HotspotAction;
};

const img = (n: string) => `/${n}`;

export const HOTSPOTS: TourHotspot[] = [
  /* ---------------- EXTERIÉR ---------------- */
  {
    id: "headlights",
    label: "Světlomety",
    view: "exterior",
    position: [-0.78, 1.02, 2.6],
    focus: { position: [-3.4, 1.5, 5.6], target: [-0.5, 1.0, 2.2] },
    action: { type: "lights", labelOn: "Rozsvítit světla", labelOff: "Zhasnout světla" },
    detail: {
      eyebrow: "Přední část",
      title: "Světlomety a design přední části",
      text: "Výrazná přední část s LED technikou osvětlení. Konkrétní provedení světlometů a masky se liší podle modelového roku a výbavy.",
      bullets: [
        "LED světlomety — dle výbavy a modelového roku",
        "LED denní svícení — dle výbavy",
        "Automatické přepínání dálkových světel — dle výbavy",
      ],
      image: img("09_design_a_detaily.jpg"),
    },
  },
  {
    id: "grille",
    label: "Maska",
    view: "exterior",
    position: [0, 0.9, 2.66],
    focus: { position: [0.4, 1.4, 6.2], target: [0, 0.95, 2.3] },
    detail: {
      eyebrow: "Design",
      title: "Maska chladiče",
      text: "Design masky a povrchová úprava lemů se u Pacifiky liší podle stupně výbavy a modelového roku — od černých prvků až po chromované provedení.",
      bullets: [
        "Provedení masky dle výbavy (černé / chromované prvky)",
        "Aktivní klapky chlazení — dle motorizace",
        "Logo Chrysler v ose masky",
      ],
      image: img("01_predni_cast.jpg"),
    },
  },
  {
    id: "wheels",
    label: "Kola",
    view: "exterior",
    position: [-1.15, 0.42, 1.63],
    focus: { position: [-3.6, 0.9, 3.6], target: [-0.9, 0.45, 1.6] },
    detail: {
      eyebrow: "Podvozek",
      title: "Kola a pneumatiky",
      text: "Rozměr a design kol závisí na výbavě. Vyšší výbavy nabízejí větší lehká litá kola.",
      bullets: [
        "Litá kola v různých rozměrech — dle výbavy",
        "Celoroční pneumatiky u vozů z USA — dle konkrétního vozu",
        "Rezerva / opravná sada — dle konfigurace",
      ],
      image: img("03_bocni_pohled.jpg"),
    },
  },
  {
    id: "mirrors",
    label: "Zrcátka",
    view: "exterior",
    position: [-1.16, 1.4, 1.15],
    focus: { position: [-3.2, 1.8, 3.2], target: [-1.0, 1.35, 1.1] },
    detail: {
      eyebrow: "Komfort",
      title: "Vnější zrcátka",
      text: "Elektricky ovládaná zrcátka s integrovanými směrovými světly. Vyhřívání, sklápění a paměť jsou dostupné dle výbavy.",
      bullets: [
        "Elektrické ovládání a vyhřívání — dle výbavy",
        "Blind Spot Monitoring s indikací v zrcátku — dle výbavy",
        "Sklopná zrcátka — dle výbavy",
      ],
      image: img("09_design_a_detaily.jpg"),
    },
  },
  {
    id: "sliding-doors",
    label: "Posuvné dveře",
    view: "exterior",
    position: [-1.12, 1.22, -0.2],
    focus: { position: [-5.4, 1.8, 0.6], target: [-0.6, 1.15, -0.2] },
    action: {
      type: "toggle",
      parts: ["doorLeft", "doorRight"],
      labelOn: "Otevřít posuvné dveře",
      labelOff: "Zavřít posuvné dveře",
    },
    detail: {
      eyebrow: "Přístup",
      title: "Elektricky ovládané posuvné dveře",
      text: "Posuvné dveře na obou stranách nepotřebují prostor vedle vozu. Kliknutím dveře skutečně otevřete i na 3D modelu.",
      bullets: [
        "Elektricky ovládané posuvné dveře — dle výbavy",
        "Hands-free otevření pohybem nohy — dle výbavy",
        "Široký vstup do druhé i třetí řady",
        "Dětská pojistka a ovládání z místa řidiče — dle výbavy",
      ],
      image: img("08_posuvne_dvere.jpg"),
    },
  },
  {
    id: "engine",
    label: "Motor",
    view: "exterior",
    position: [0, 1.32, 1.95],
    focus: { position: [0, 3.0, 5.4], target: [0, 1.1, 2.0] },
    action: { type: "toggle", parts: ["hood"], labelOn: "Otevřít kapotu", labelOff: "Zavřít kapotu" },
    detail: {
      eyebrow: "Pohon",
      title: "Motorový prostor",
      text: "Pacifica se nabízí ve dvou odlišných pohonech. Konkrétní hodnoty se liší podle modelového roku a trhu.",
      bullets: [],
      image: img("10_motor_a_prevodovka.jpg"),
      variants: [
        {
          label: "Standard",
          text: "Atmosférický šestiválec 3.6 Pentastar V6 s devítistupňovou automatickou převodovkou. Plynulý výkon i s plně obsazeným vozem.",
          bullets: [
            "3.6 Pentastar V6",
            "Výkon přibližně 214 kW — dle modelového roku a trhu",
            "Točivý moment přibližně 356 Nm",
            "9stupňová automatická převodovka",
            "Pohon předních kol, u některých modelových roků i AWD — dle verze",
          ],
        },
        {
          label: "Hybrid",
          text: "Plug-in Hybrid kombinuje 3.6litrový V6 s elektrickým pohonem a vysokonapěťovou baterií. Krátké denní trasy zvládne elektricky, delší na benzin.",
          bullets: [
            "Plug-in hybrid: 3.6 V6 + elektrický pohon",
            "Vysokonapěťová trakční baterie",
            "Nabíjení z externího zdroje",
            "Rekuperační brzdění",
            "Elektrický dojezd dle údajů výrobce a modelového roku",
          ],
        },
      ],
    },
  },
  {
    id: "liftgate",
    label: "Páté dveře",
    view: "exterior",
    position: [0, 1.9, -2.7],
    focus: { position: [0.6, 2.4, -6.2], target: [0, 1.4, -2.4] },
    action: { type: "toggle", parts: ["liftgate"], labelOn: "Otevřít páté dveře", labelOff: "Zavřít páté dveře" },
    detail: {
      eyebrow: "Zadní část",
      title: "Páté dveře",
      text: "Velká páté dveře s nízkou nakládací hranou. Elektrické i hands-free ovládání jsou dostupné dle výbavy.",
      bullets: [
        "Elektricky ovládané páté dveře — dle výbavy",
        "Hands-free otevření — dle výbavy",
        "Nízká nakládací hrana",
      ],
      image: img("02_zadni_cast.jpg"),
    },
  },

  /* ---------------- ŘIDIČ ---------------- */
  {
    id: "steering",
    label: "Volant",
    view: "driver",
    position: [-0.42, 1.3, 0.68],
    detail: {
      eyebrow: "Místo řidiče",
      title: "Volant a ovládání",
      text: "Multifunkční volant s ovládáním audia, telefonu a jízdních asistentů. Vyhřívání volantu je dostupné dle výbavy.",
      bullets: [
        "Multifunkční volant",
        "Vyhřívání volantu — dle výbavy",
        "Řazení pomocí otočného voliče",
        "Adaptivní tempomat — dle výbavy",
      ],
      image: img("04_kokpit_a_technologie.jpg"),
    },
  },
  {
    id: "cluster",
    label: "Přístrojový panel",
    view: "driver",
    position: [-0.42, 1.34, 0.92],
    detail: {
      eyebrow: "Informace",
      title: "Přístrojový panel",
      text: "Přehledný přístrojový štít s barevným informačním displejem mezi ukazateli. U hybridní verze zobrazuje také tok energie a stav baterie.",
      bullets: [
        "Barevný informační displej — dle výbavy",
        "Zobrazení jízdních asistentů",
        "U hybridu tok energie a stav baterie",
      ],
      image: img("04_kokpit_a_technologie.jpg"),
    },
  },
  {
    id: "uconnect",
    label: "Uconnect",
    view: "driver",
    position: [0.02, 1.28, 0.78],
    focus: { position: [-0.1, 1.3, 0.1], target: [0.05, 1.2, 0.9] },
    detail: {
      eyebrow: "Technologie",
      title: "Uconnect 5 a infotainment",
      text: "Novější modelové roky Pacifiky používají systém Uconnect 5 s dotykovým displejem o úhlopříčce 10,1\". Konkrétní funkce závisí na výbavě a modelovém roku.",
      bullets: [
        "Uconnect 5 s 10,1\" dotykovým displejem — dle modelového roku",
        "Bezdrátové Apple CarPlay a Android Auto — dle výbavy",
        "Uživatelské profily",
        "Navigace a hlasové ovládání — dle výbavy",
      ],
      specs: [
        { label: "Displej", value: "10,1\" (dle modelového roku)" },
        { label: "Systém", value: "Uconnect 5" },
      ],
      image: img("04_kokpit_a_technologie.jpg"),
    },
  },
  {
    id: "start",
    label: "Startování",
    view: "driver",
    position: [0.3, 1.18, 0.72],
    detail: {
      eyebrow: "Ovládání",
      title: "Startování a klimatizace",
      text: "Bezklíčový vstup a startování tlačítkem jsou dostupné dle výbavy. Klimatizace bývá třízónová s ovládáním pro zadní část vozu.",
      bullets: [
        "Keyless Enter ’n Go — dle výbavy",
        "Třízónová automatická klimatizace — dle výbavy",
        "Samostatné ovládání pro zadní řady — dle výbavy",
        "Vyhřívaná přední sedadla — dle výbavy",
      ],
      image: img("04_kokpit_a_technologie.jpg"),
    },
  },
  {
    id: "safety",
    label: "Bezpečnost",
    view: "driver",
    position: [-0.1, 1.6, 1.1],
    detail: {
      eyebrow: "Asistenty",
      title: "Bezpečnost a asistenční systémy",
      text: "Nabídka asistentů se liší podle modelového roku a výbavy. Níže jsou systémy, které Chrysler pro Pacificu uvádí.",
      bullets: [
        "360° kamerový systém — dle výbavy",
        "ParkSense parkovací senzory — dle výbavy",
        "Blind Spot Monitoring — dle výbavy",
        "Rear Cross Path Detection — dle výbavy",
        "FamCAM kamera na zadní sedadla — dle výbavy a modelového roku",
      ],
      image: img("09_design_a_detaily.jpg"),
    },
  },

  /* ---------------- 2. ŘADA ---------------- */
  {
    id: "row2-seats",
    label: "Sedadla 2. řady",
    view: "row2",
    position: [-0.45, 1.35, -0.72],
    action: { type: "toggle", parts: ["row2"], labelOn: "Sklopit 2. řadu", labelOff: "Rozložit 2. řadu" },
    detail: {
      eyebrow: "Interiér",
      title: "Druhá řada",
      text: "Druhá řada je řešená s ohledem na pohodlí i snadný přístup dozadu. Konfigurace se liší podle verze vozu — samostatná sedadla nebo lavice.",
      bullets: [
        "Samostatná sedadla nebo lavice — dle verze",
        "Easy Tilt pro přístup do třetí řady — dle výbavy",
        "Stow ’n Go ve druhé řadě — pouze u kompatibilních verzí (ne u plug-in hybridu)",
        "Vyhřívaná sedadla druhé řady — dle výbavy",
      ],
      image: img("05_2_rada_sedadel.jpg"),
    },
  },
  {
    id: "row2-doors",
    label: "Posuvné dveře zevnitř",
    view: "row2",
    position: [-0.95, 1.25, -0.3],
    action: {
      type: "toggle",
      parts: ["doorLeft"],
      labelOn: "Otevřít levé dveře",
      labelOff: "Zavřít levé dveře",
    },
    detail: {
      eyebrow: "Přístup",
      title: "Nastupování do druhé řady",
      text: "Široký otvor posuvných dveří usnadňuje usazení dětí i montáž autosedačky. Dveře lze ovládat i zevnitř — dle výbavy.",
      bullets: [
        "Ovládání dveří zevnitř — dle výbavy",
        "Úchyty ISOFIX ve druhé řadě",
        "Stínítka v zadních oknech — dle výbavy",
      ],
      image: img("08_posuvne_dvere.jpg"),
    },
  },
  {
    id: "connectivity",
    label: "USB a konektivita",
    view: "row2",
    position: [0.5, 1.05, -0.1],
    detail: {
      eyebrow: "Family",
      title: "Konektivita a zábava",
      text: "Pacifica bývá vybavena USB porty pro zadní cestující a u vyšších výbav i zábavním systémem pro zadní sedadla.",
      bullets: [
        "USB porty pro druhou i třetí řadu — dle výbavy",
        "Zábavní systém pro zadní sedadla — dle výbavy",
        "Prémiový audio systém — dle výbavy",
        "220V zásuvka — dle výbavy",
      ],
      image: img("04_kokpit_a_technologie.jpg"),
    },
  },

  /* ---------------- 3. ŘADA ---------------- */
  {
    id: "row3-seats",
    label: "Třetí řada",
    view: "row3",
    position: [0, 1.35, -1.78],
    action: { type: "toggle", parts: ["row3"], labelOn: "Sklopit 3. řadu", labelOff: "Rozložit 3. řadu" },
    detail: {
      eyebrow: "Interiér",
      title: "Plnohodnotná třetí řada",
      text: "Třetí řada má vlastní bezpečnostní pásy i opěrky hlavy. Sedadla se sklápějí do podlahy systémem Stow ’n Go.",
      bullets: [
        "Vlastní pásy a opěrky hlavy",
        "Sklápění do podlahy — Stow ’n Go",
        "Dělené sklápění 60/40",
        "Přístup přes posuvné boční dveře",
      ],
      image: img("06_3_rada_sedadel.jpg"),
    },
  },
  {
    id: "storage",
    label: "Úložné prostory",
    view: "row3",
    position: [-0.7, 0.95, -1.4],
    detail: {
      eyebrow: "Praktičnost",
      title: "Úložné prostory",
      text: "Podlahové schránky, které u verzí se Stow ’n Go slouží pro uložení sklopených sedadel, lze při rozložených sedadlech využít jako úložný prostor.",
      bullets: [
        "Podlahové schránky — dle konfigurace",
        "Odkládací prostory v bočních panelech",
        "Držáky nápojů pro všechny řady",
      ],
      image: img("07_zavazadlovy_prostor.jpg"),
    },
  },

  /* ---------------- KUFR ---------------- */
  {
    id: "stow-n-go",
    label: "Stow ’n Go",
    view: "cargo",
    position: [0, 1.0, -1.9],
    action: {
      type: "toggle",
      parts: ["row2", "row3", "liftgate"],
      labelOn: "Aktivovat Stow ’n Go",
      labelOff: "Vrátit sedadla",
    },
    detail: {
      eyebrow: "Variabilita",
      title: "Stow ’n Go",
      text: "U kompatibilních konfigurací se sedadla sklápějí přímo do podlahy, bez vyjímání z vozu. Přechod z rodinného vozu na dodávku je otázkou chvilky. U plug-in hybridu je Stow ’n Go ve druhé řadě omezené kvůli umístění baterie.",
      bullets: [
        "Sklápění sedadel do podlahy — dle verze",
        "Třetí řada Stow ’n Go u standardní i hybridní verze",
        "Druhá řada Stow ’n Go pouze u spalovacích verzí",
        "Rovná ložná plocha po sklopení",
      ],
      image: img("07_zavazadlovy_prostor.jpg"),
    },
  },
  {
    id: "cargo",
    label: "Zavazadlový prostor",
    view: "cargo",
    position: [0.7, 1.15, -2.2],
    action: { type: "toggle", parts: ["liftgate"], labelOn: "Otevřít kufr", labelOff: "Zavřít kufr" },
    detail: {
      eyebrow: "Prostor",
      title: "Zavazadlový prostor",
      text: "Za třetí řadou zůstává použitelný prostor i s plným obsazením. Po sklopení sedadel vznikne velká rovná ložná plocha.",
      bullets: [
        "Prostor za třetí řadou i s obsazenými sedadly",
        "Rovná ložná plocha po sklopení",
        "Nízká nakládací hrana",
        "Maximální nákladový objem dle údajů výrobce a konfigurace",
      ],
      image: img("07_zavazadlovy_prostor.jpg"),
    },
  },
];

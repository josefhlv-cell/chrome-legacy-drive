/**
 * Krokový scénář interiérové části virtuální prohlídky Chrysler Pacifica.
 *
 * Interiér NENÍ 3D — používají se výhradně dodané reálné fotografie a videa
 * konkrétního vozu z balíčku virtuální prohlídky.
 *
 * Všechna média jsou v:
 * public/pacifica/virtual-tour/
 *
 * Nepoužívat staré assety z /public/pacifica/ ani .asset.json URL.
 */

const TOUR_ASSETS = "/pacifica/virtual-tour";

const cockpit = `${TOUR_ASSETS}/01_cockpit_overview.png`;
const uconnect = `${TOUR_ASSETS}/02_uconnect_detail.png`;
const passengerSeat = `${TOUR_ASSETS}/03_front_passenger_seat.png`;
const frontConsole = `${TOUR_ASSETS}/04_front_console_and_dashboard.png`;
const secondRow = `${TOUR_ASSETS}/05_second_row_front_view.png`;
const secondRowSide = `${TOUR_ASSETS}/06_second_row_side_stow_n_go.png`;
const flatFloor = `${TOUR_ASSETS}/07_stow_n_go_flat_floor.png`;
const thirdRow = `${TOUR_ASSETS}/08_third_row_cargo_view.png`;

const clusterVideo = `${TOUR_ASSETS}/001-ridic-pristrojova-deska.mp4`;
const camera360Video = `${TOUR_ASSETS}/002-360-kamery.mp4`;
const radioUconnectVideo = `${TOUR_ASSETS}/003-radio-uconnect.mp4`;

const stowVideo = `${TOUR_ASSETS}/02_stow_n_go_seat_operation_under25mb.mp4`;
const tailgateVideo = `${TOUR_ASSETS}/03_tailgate_closing.mp4`;

export type TourVideo = {
  src: string;
  caption?: string;
  poster?: string;
};

export type TourCard = {
  eyebrow: string;
  title: string;
  text: string;
  bullets?: string[];
  sections?: { title: string; items: string[] }[];
  note?: string;

  /**
   * Pokud true, karta se po otevření hotspotu zobrazí nejdříve sbalená.
   * Fotografie zůstane viditelná.
   * Video se vyrenderuje až po ručním rozbalení.
   */
  collapsible?: boolean;

  /**
   * Videa patří přímo do informační karty.
   * Komponenta je vykreslí pouze v rozbaleném stavu.
   */
  videos?: TourVideo[];
};

export type PhotoHotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  card?: TourCard;
  advance?: boolean;
};

export type InteriorStep =
  | {
      kind: "photo";
      id: string;
      src: string;
      alt: string;
      intro?: TourCard;
      hotspots: PhotoHotspot[];
      configurator?: boolean;
      nextLabel?: string;
    }
  | {
      kind: "video";
      id: string;
      src: string;
      card: TourCard;
      nextLabel?: string;
    }
  | {
      kind: "done";
      id: string;
    };

export const EQUIP_NOTE =
  "Uvedené funkce se mohou lišit podle výbavy vozu.";

export const VIDEO_CAPTION =
  "Reálné video konkrétního vozu — Chrysler Pardubice";

export const INTERIOR_STEPS: InteriorStep[] = [
  {
    kind: "photo",
    id: "cockpit",
    src: cockpit,
    alt: "Přístrojová deska a řidičovo místo Chrysler Pacifica",
    intro: {
      eyebrow: "Krok 1 — Kokpit",
      title: "Místo řidiče",
      text:
        "Pohled na přístrojovou desku a řidičovo místo konkrétního vozu. Klepnutím na bod zájmu si prohlédnete přístrojový štít. Na Uconnect 360 přejdete tlačítkem níže.",
    },
    hotspots: [
      {
        id: "cluster",
        label: "Přístrojový štít",
        x: 44,
        y: 41,
        card: {
          eyebrow: "Za volantem",
          title: "Přístrojový štít",
          text:
            "Podívejte se na reálné video přístrojového štítu konkrétního vozu.",
          collapsible: false,
          videos: [
            {
              src: clusterVideo,
              caption: "Přístrojový štít — reálné video konkrétního vozu",
            },
          ],
        },
      },
    ],
    nextLabel: "Detail Uconnect 360 →",
  },

  {
    kind: "photo",
    id: "uconnect",
    src: uconnect,
    alt: "Detail dotykového systému Uconnect a středové konzoly",
    intro: {
      eyebrow: "Krok 2 — Ovládání",
      title: "Uconnect 360",
      text:
        "Centrální dotykový systém sdružuje funkce rádia, médií, telefonu a nastavení vozidla. Karta obsahuje také reálné video systému 360° kamer konkrétního vozu.",
      bullets: [
        "Dotykový displej ve středu palubní desky",
        "Systém 360° kamer podle výbavy vozu",
        "Pod displejem fyzická tlačítka a ovladače klimatizace",
        "Rozsah funkcí podle konkrétní výbavy",
      ],
      note: EQUIP_NOTE,
      collapsible: true,
      videos: [
        {
          src: camera360Video,
          caption: "360° kamery — reálné video konkrétního vozu",
        },
      ],
    },
    hotspots: [
      {
        id: "uconnect-360",
        label: "Uconnect 360",
        x: 79,
        y: 43,
        card: {
          eyebrow: "Krok 2 — Ovládání",
          title: "Uconnect 360",
          text:
            "Centrální dotykový systém sdružuje funkce rádia, médií, telefonu a nastavení vozidla. Po rozbalení karty se zobrazí reálné video systému 360° kamer konkrétního vozu.",
          bullets: [
            "Dotykový displej ve středu palubní desky",
            "Systém 360° kamer podle výbavy vozu",
            "Pod displejem fyzická tlačítka a ovladače klimatizace",
            "Rozsah funkcí podle konkrétní výbavy",
          ],
          note: EQUIP_NOTE,
          collapsible: true,
          videos: [
            {
              src: camera360Video,
              caption: "360° kamery — reálné video konkrétního vozu",
            },
          ],
        },
      },
    ],
    nextLabel: "Přejít na sedadlo spolujezdce →",
  },

  {
    kind: "photo",
    id: "front-comfort",
    src: passengerSeat,
    alt: "Sedadlo spolujezdce a přední část interiéru",
    hotspots: [
      {
        id: "seat",
        label: "Sedadlo spolujezdce",
        x: 60,
        y: 76,
        card: {
          eyebrow: "Vpředu",
          title: "Komfort vpředu",
          text:
            "Interiér kombinuje černé kožené čalounění s kontrastními světlými plochami kabiny. Podle výbavy může být k dispozici elektrické nastavení předních sedadel a další komfortní funkce.",
          bullets: [
            "Černé kožené čalounění s prošíváním",
            "Loketní opěrka sedadla spolujezdce",
            "Elektrické nastavení sedadel — pokud je vůz touto funkcí vybaven",
            "Stow ’n Go Assist s automatickým posunutím předního sedadla — pokud je vůz touto funkcí vybaven",
          ],
          note: EQUIP_NOTE,
        },
      },
    ],
    nextLabel: "Přední konzole →",
  },

  {
    kind: "photo",
    id: "front-console",
    src: frontConsole,
    alt: "Detail přední části, středové konzoly a ovládacích prvků",
    intro: {
      eyebrow: "Vpředu",
      title: "Přední konzole a ovládání",
      text:
        "Detail přední části s dotykovým displejem, ovládáním klimatizace a dalšími ovládacími prvky v dosahu řidiče. Karta obsahuje také reálné video rádia a systému Uconnect konkrétního vozu.",
      note: EQUIP_NOTE,
      collapsible: true,
      videos: [
        {
          src: radioUconnectVideo,
          caption: "Rádio a Uconnect — reálné video konkrétního vozu",
        },
      ],
    },
    hotspots: [],
    nextLabel: "Prohlédnout zadní část →",
  },

  {
    kind: "photo",
    id: "second-row",
    src: secondRow,
    alt: "Pohled na druhou řadu sedadel a přední část kabiny",
    intro: {
      eyebrow: "Krok 3 — Zadní část",
      title: "Druhá řada",
      text:
        "Tady začíná hlavní část prohlídky praktického využití interiéru. Pacifica využívá systém Stow ’n Go, který umožňuje podle konfigurace měnit prostor pro cestující a náklad.",
    },
    hotspots: [
      {
        id: "stow-spot",
        label: "Stow ’n Go",
        x: 50,
        y: 64,
        advance: true,
      },
    ],
    nextLabel: "Stow ’n Go →",
  },

  {
    kind: "photo",
    id: "stow-side",
    src: secondRowSide,
    alt: "Boční pohled na druhou řadu a mechanismus Stow ’n Go",
    intro: {
      eyebrow: "Variabilita",
      title: "Stow ’n Go",
      text:
        "Systém Stow ’n Go umožňuje u vybraných konfigurací druhou a třetí řadu skládat a ukládat do podlahových prostorů. Výsledkem je rychlá změna uspořádání kabiny bez nutnosti vyjímat běžná sedadla z vozidla.",
      note: EQUIP_NOTE,
    },
    hotspots: [
      {
        id: "stow-lever",
        label: "Ukázat Stow ’n Go →",
        x: 33,
        y: 73,
        advance: true,
      },
    ],
    nextLabel: "Ukázat Stow ’n Go →",
  },

  {
    kind: "photo",
    id: "flat-floor",
    src: flatFloor,
    alt: "Rovná podlaha po uložení sedadel Stow ’n Go",
    intro: {
      eyebrow: "Prostor",
      title: "Maximální využití prostoru",
      text:
        "Po uložení příslušných sedadel vzniká rozsáhlá rovná plocha pro přepravu nákladu. Přesná kapacita závisí na konfiguraci a konkrétní verzi vozidla.",
      bullets: [
        "Rovná ložná plocha bez vystupujících sedadel",
        "Nakládání přímo od zadních dveří",
        "Rozsah plochy podle konfigurace a výbavy vozu",
      ],
    },
    hotspots: [],
    nextLabel: "Třetí řada →",
  },

  {
    kind: "photo",
    id: "third-row",
    src: thirdRow,
    alt: "Třetí řada sedadel a zadní nákladový prostor",
    intro: {
      eyebrow: "Krok 4 — Konfigurace",
      title: "Třetí řada",
      text:
        "Třetí řada rozšiřuje přepravní kapacitu cestujících a současně je součástí systému variabilního uspořádání interiéru. Podle konfigurace ji lze využít pro cestující, nebo složit pro získání dalšího nákladového prostoru.",
    },
    configurator: true,
    hotspots: [
      {
        id: "finish",
        label: "Pokračovat na video Stow ’n Go →",
        x: 76,
        y: 62,
        advance: true,
      },
    ],
    nextLabel: "Video Stow ’n Go →",
  },

  {
    kind: "video",
    id: "stow-video",
    src: stowVideo,
    card: {
      eyebrow: "Reálné video vozu",
      title: "Práce se sedačkou Stow ’n Go",
      text:
        "Video zachycuje skládání sedadla druhé řady na konkrétním vozu. Postup a dostupnost se u jednotlivých sedadel liší podle konfigurace a výbavy vozu.",
      note: EQUIP_NOTE,
    },
    nextLabel: "Zavření víka kufru →",
  },

  {
    kind: "video",
    id: "tailgate-video",
    src: tailgateVideo,
    card: {
      eyebrow: "Reálné video vozu",
      title: "Zavření víka kufru",
      text:
        "Zavírání zadního víka kufru na konkrétním vozu. Způsob ovládání a dostupné funkce závisí na výbavě vozu.",
      note: EQUIP_NOTE,
    },
    nextLabel: "Dokončit →",
  },

  { kind: "done", id: "done" },
];

export const CONFIG_MODES: {
  key: string;
  label: string;
  text: string;
}[] = [
  {
    key: "passengers",
    label: "Více cestujících",
    text:
      "Druhá i třetí řada je vyklopená a připravená k jízdě — maximum míst pro cestující.",
  },
  {
    key: "mixed",
    label: "Kombinace",
    text:
      "Část sedadel zůstává nahoře pro cestující, zbytek prostoru slouží pro náklad.",
  },
  {
    key: "cargo",
    label: "Maximální prostor",
    text:
      "Sedadla jsou uložená podle možností systému Stow ’n Go a vzniká rovná ložná plocha.",
  },
];

/**
 * Krokový scénář interiérové části virtuální prohlídky Chrysler Pacifica.
 *
 * Interiér NENÍ 3D — používají se výhradně dodané reálné fotografie a videa
 * konkrétního vozu. Texty popisují pouze to, co je na fotografii skutečně
 * vidět; cokoli závislé na výbavě je označeno „podle výbavy vozu“.
 */

import cockpit from "../assets/01_cockpit_overview.png.asset.json";
import uconnect from "../assets/02_uconnect_detail.png.asset.json";
import passengerSeat from "../assets/03_front_passenger_seat.png.asset.json";
import frontConsole from "../assets/04_front_console_and_dashboard.png.asset.json";
import secondRow from "../assets/05_second_row_front_view.png.asset.json";
import secondRowSide from "../assets/06_second_row_side_stow_n_go.png.asset.json";
import flatFloor from "../assets/07_stow_n_go_flat_floor.png.asset.json";
import thirdRow from "../assets/08_third_row_cargo_view.png.asset.json";
import stowVideo from "../assets/02_stow_n_go_seat_operation.mp4.asset.json";
import tailgateVideo from "../assets/03_tailgate_closing.mp4.asset.json";

export type TourCard = {
  eyebrow: string;
  title: string;
  text: string;
  bullets?: string[];
  /** Podsekce karty (např. „Základní kontrolky“). */
  sections?: { title: string; items: string[] }[];
  note?: string;
};

export type PhotoHotspot = {
  id: string;
  label: string;
  /** Pozice v % šířky/výšky fotografie. */
  x: number;
  y: number;
  /** Karta otevřená po kliknutí. Bez karty hotspot pouze posune prohlídku dál. */
  card?: TourCard;
  /** Hotspot slouží jako přechod na další krok. */
  advance?: boolean;
};

export type InteriorStep =
  | {
      kind: "photo";
      id: string;
      src: string;
      alt: string;
      /** Karta zobrazená hned po otevření kroku. */
      intro?: TourCard;
      hotspots: PhotoHotspot[];
      /** Přepínač konfigurace cestující × náklad. */
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
  | { kind: "done"; id: string };

export const EQUIP_NOTE = "Uvedené funkce se mohou lišit podle výbavy vozu.";

export const INTERIOR_STEPS: InteriorStep[] = [
  {
    kind: "photo",
    id: "cockpit",
    src: cockpit.url,
    alt: "Přístrojová deska a řidičovo místo Chrysler Pacifica",
    intro: {
      eyebrow: "Krok 1 — Kokpit",
      title: "Místo řidiče",
      text: "Pohled na přístrojovou desku a řidičovo místo konkrétního vozu. Klepnutím na body zájmu si prohlédnete přístrojový štít a centrální dotykový systém.",
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
          text: "Přístrojový štít poskytuje řidiči základní informace o jízdě a stavu vozidla. Podle výbavy a nastavení může zobrazovat informace o jízdě, spotřebě, médiích, telefonu, navigaci a dalších funkcích vozidla.",
          sections: [
            {
              title: "Základní kontrolky",
              items: [
                "Bezpečnostní pás — upozornění na nezapnutý pás řidiče či posádky.",
                "Airbag — signalizuje závadu v systému airbagů; nechte zkontrolovat v servisu.",
                "Brzdový systém — může znamenat zataženou parkovací brzdu nebo nízkou hladinu brzdové kapaliny.",
                "Dobíjení — porucha dobíjení baterie; hrozí ztráta elektrické energie.",
                "Tlak oleje — nízký tlak motorového oleje; ihned bezpečně zastavte a vypněte motor.",
                "Teplota chladicí kapaliny — motor je přehřátý; nepokračujte v jízdě.",
                "Otevřené dveře — některé dveře nebo víko kufru nejsou zavřené.",
              ],
            },
          ],
          note: "Význam a barva kontrolky určuje, jak rychle je nutné reagovat — červená kontrolka může vyžadovat okamžité zastavení. Vždy postupujte podle návodu k obsluze vozu.",
        },
      },
      {
        id: "uconnect-spot",
        label: "Uconnect",
        x: 79,
        y: 43,
        advance: true,
      },
    ],
    nextLabel: "Detail Uconnect →",
  },
  {
    kind: "photo",
    id: "uconnect",
    src: uconnect.url,
    alt: "Detail dotykového systému Uconnect a středové konzoly",
    intro: {
      eyebrow: "Krok 2 — Ovládání",
      title: "Uconnect",
      text: "Centrální dotykový systém sdružuje funkce rádia, médií, telefonu a nastavení vozidla. Podle konkrétní verze systému a výbavy může zahrnovat také navigaci, Bluetooth, USB/AUX, hlasové funkce a další služby.",
      bullets: [
        "Dotykový displej ve středu palubní desky",
        "Pod displejem fyzická tlačítka a ovladače klimatizace",
        "Rozsah funkcí podle výbavy vozu",
      ],
      note: EQUIP_NOTE,
    },
    hotspots: [],
    nextLabel: "Pokračovat →",
  },
  {
    kind: "photo",
    id: "front-comfort",
    src: passengerSeat.url,
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
          text: "Interiér kombinuje černé kožené čalounění s kontrastními světlými plochami kabiny. Podle výbavy může být k dispozici elektrické nastavení předních sedadel a další komfortní funkce.",
          bullets: [
            "Černé kožené čalounění s prošíváním",
            "Loketní opěrka sedadla spolujezdce",
            "Elektrické nastavení sedadel — pokud je vůz touto funkcí vybaven",
            "Stow ’n Go Assist s automatickým posunutím předního sedadla — pokud je vůz touto funkcí vybaven",
          ],
          note: EQUIP_NOTE,
        },
      },
      {
        id: "to-rear",
        label: "Prohlédnout zadní část →",
        x: 88,
        y: 30,
        advance: true,
      },
    ],
    nextLabel: "Přední konzole →",
  },
  {
    kind: "photo",
    id: "front-console",
    src: frontConsole.url,
    alt: "Detail přední části, středové konzoly a ovládacích prvků",
    intro: {
      eyebrow: "Vpředu",
      title: "Přední konzole a ovládání",
      text: "Detail přední části s dotykovým displejem, ovládáním klimatizace a dalšími ovládacími prvky v dosahu řidiče. Konkrétní rozsah funkcí odpovídá výbavě vozu.",
      note: EQUIP_NOTE,
    },
    hotspots: [],
    nextLabel: "Prohlédnout zadní část →",
  },
  {
    kind: "photo",
    id: "second-row",
    src: secondRow.url,
    alt: "Pohled na druhou řadu sedadel a přední část kabiny",
    intro: {
      eyebrow: "Krok 3 — Zadní část",
      title: "Druhá řada",
      text: "Tady začíná hlavní část prohlídky praktického využití interiéru. Pacifica využívá systém Stow ’n Go, který umožňuje podle konfigurace měnit prostor pro cestující a náklad.",
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
    src: secondRowSide.url,
    alt: "Boční pohled na druhou řadu a mechanismus Stow ’n Go",
    intro: {
      eyebrow: "Variabilita",
      title: "Stow ’n Go",
      text: "Systém Stow ’n Go umožňuje u vybraných konfigurací druhou a třetí řadu skládat a ukládat do podlahových prostorů. Výsledkem je rychlá změna uspořádání kabiny bez nutnosti vyjímat běžná sedadla z vozidla.",
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
    kind: "video",
    id: "stow-video",
    src: stowVideo.url,
    card: {
      eyebrow: "Reálné video vozu",
      title: "Práce se sedačkou Stow ’n Go",
      text: "Video zachycuje skládání sedadla druhé řady na konkrétním vozu. Postup a dostupnost se u jednotlivých sedadel liší podle konfigurace a výbavy vozu.",
      note: EQUIP_NOTE,
    },
    nextLabel: "Rovná podlaha →",
  },
  {
    kind: "photo",
    id: "flat-floor",
    src: flatFloor.url,
    alt: "Rovná podlaha po uložení sedadel Stow ’n Go",
    intro: {
      eyebrow: "Prostor",
      title: "Maximální využití prostoru",
      text: "Po uložení příslušných sedadel vzniká rozsáhlá rovná plocha pro přepravu nákladu. Přesná kapacita závisí na konfiguraci a konkrétní verzi vozidla.",
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
    src: thirdRow.url,
    alt: "Třetí řada sedadel a zadní nákladový prostor",
    intro: {
      eyebrow: "Krok 4 — Konfigurace",
      title: "Třetí řada",
      text: "Třetí řada rozšiřuje přepravní kapacitu cestujících a současně je součástí systému variabilního uspořádání interiéru. Podle konfigurace ji lze využít pro cestující, nebo složit pro získání dalšího nákladového prostoru.",
    },
    configurator: true,
    hotspots: [
      {
        id: "finish",
        label: "Dokončit prohlídku",
        x: 76,
        y: 62,
        advance: true,
      },
    ],
    nextLabel: "Dokončit prohlídku →",
  },
  {
    kind: "video",
    id: "tailgate-video",
    src: tailgateVideo.url,
    card: {
      eyebrow: "Reálné video vozu",
      title: "Zavření víka kufru",
      text: "Zavírání zadního víka kufru na konkrétním vozu. Způsob ovládání a dostupné funkce závisí na výbavě vozu.",
      note: EQUIP_NOTE,
    },
    nextLabel: "Dokončit →",
  },
  { kind: "done", id: "done" },
];

/** Tři jednoduché režimy uspořádání kabiny — bez uvádění objemů. */
export const CONFIG_MODES: { key: string; label: string; text: string }[] = [
  {
    key: "passengers",
    label: "Více cestujících",
    text: "Druhá i třetí řada je vyklopená a připravená k jízdě — maximum míst pro cestující.",
  },
  {
    key: "mixed",
    label: "Kombinace",
    text: "Část sedadel zůstává nahoře pro cestující, zbytek prostoru slouží pro náklad.",
  },
  {
    key: "cargo",
    label: "Maximální prostor",
    text: "Sedadla jsou uložená podle možností systému Stow ’n Go a vzniká rovná ložná plocha.",
  },
];

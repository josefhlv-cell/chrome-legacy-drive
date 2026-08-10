import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSiteContacts } from "@/hooks/useAdminContent";
import keyFob from "@/assets/pacifica-key.png";

/**
 * Interaktivní prohlídka Chrysler Pacifica.
 *
 * UX: každá scéna = jedna celoobrazovková fotografie vozu.
 * Text se NIKDY nezobrazuje před kliknutím — pouze malé pulzující hotspoty.
 * Po kliknutí se otevře detail (fotografie + krátká informace).
 *
 * Fotografie leží v /public a jsou stále stejný konkrétní vůz.
 * Údaje závislé na výbavě jsou vždy označené "dle výbavy".
 */

type Detail = {
  id: string;
  title: string;
  image: string;
  alt: string;
  text: string;
  bullets: string[];
  /** Přepínač Standard / Hybrid — pouze u motoru. */
  variants?: {
    label: string;
    image: string;
    alt: string;
    text: string;
    bullets: string[];
  }[];
};

type Hotspot = {
  id: string;
  label: string;
  /** pozice v % scény */
  x: number;
  y: number;
  /** otevře detail, nebo posune prohlídku na další scénu */
  detail?: Detail;
  goToScene?: number;
  /** vizuál klíče místo tečky */
  variant?: "dot" | "key";
};

type Scene = {
  id: string;
  name: string;
  image: string;
  alt: string;
  hotspots: Hotspot[];
};

const SCENES: Scene[] = [
  {
    id: "predni-cast",
    name: "Přední část",
    image: "/01_predni_cast.jpg",
    alt: "Chrysler Pacifica – pohled zepředu",
    hotspots: [
      {
        id: "motor",
        label: "Motor",
        x: 22,
        y: 74,
        detail: {
          id: "motor",
          title: "Motorový prostor",
          image: "/10_motor_a_prevodovka.jpg",
          alt: "Chrysler Pacifica – motor 3.6 Pentastar V6",
          text: "Pacifica je nabízena ve dvou odlišných pohonech. Vyberte verzi.",
          bullets: [],
          variants: [
            {
              label: "Standard",
              image: "/10_motor_a_prevodovka.jpg",
              alt: "Chrysler Pacifica – motor 3.6 Pentastar V6",
              text:
                "Atmosférický šestiválec 3.6 Pentastar V6 s devítistupňovou automatickou převodovkou TorqueFlite. Plynulý výkon i s plně obsazeným vozem.",
              bullets: [
                "3.6 Pentastar V6",
                "Výkon přibližně 214 kW",
                "Točivý moment přibližně 356 Nm",
                "9stupňová automatická převodovka TorqueFlite",
              ],
            },
            {
              label: "Hybrid",
              image: "/11_pacifica_hybrid.jpg",
              alt: "Chrysler Pacifica Plug-in Hybrid – motorový prostor",
              text:
                "Plug-in Hybrid spojuje 3.6litrový V6 s elektrickým pohonem a vysokonapěťovou baterií. Krátké denní trasy lze jezdit elektricky, delší na benzin.",
              bullets: [
                "Systémový výkon až 194 kW",
                "Až 51 km elektrického dojezdu dle údajů Chrysleru",
                "Nabíjení z externího zdroje",
                "Rekuperační brzdění",
              ],
            },
          ],
        },
      },
      {
        id: "svetla",
        label: "Světlomety",
        x: 26,
        y: 55,
        detail: {
          id: "svetla",
          title: "Přední část a design",
          image: "/09_design_a_detaily.jpg",
          alt: "Chrysler Pacifica – designové detaily",
          text:
            "Výrazná přední část s LED osvětlením. Konkrétní provedení světlometů, masky a kol se liší podle verze.",
          bullets: [
            "LED světlomety — dle výbavy",
            "LED denní svícení — dle výbavy",
            "Různé designy kol — dle výbavy",
          ],
        },
      },
      {
        id: "na-bok",
        label: "Posuvné dveře",
        x: 80,
        y: 40,
        goToScene: 1,
      },
    ],
  },

  {
    id: "bocni-cast",
    name: "Boční část",
    image: "/03_bocni_pohled.jpg",
    alt: "Chrysler Pacifica – boční pohled",
    hotspots: [
      {
        id: "posuvne-dvere",
        label: "Posuvné dveře",
        x: 55,
        y: 52,
        detail: {
          id: "posuvne-dvere",
          title: "Elektricky ovládané posuvné dveře",
          image: "/08_posuvne_dvere.jpg",
          alt: "Chrysler Pacifica – posuvné boční dveře",
          text:
            "Posuvné dveře na obou stranách vozu nepotřebují prostor vedle auta. Praktické na úzkých parkovacích místech i při nastupování dětí.",
          bullets: [
            "Elektricky ovládané posuvné dveře",
            "Hands-free otevření pohybem nohy — dle výbavy",
            "Široký vstup do druhé i třetí řady",
          ],
        },
      },
      {
        id: "klic",
        label: "Vstoupit do interiéru",
        x: 30,
        y: 56,
        variant: "key",
        goToScene: 2,
      },
    ],
  },

  {
    id: "misto-ridice",
    name: "Místo řidiče",
    image: "/04_kokpit_a_technologie.jpg",
    alt: "Chrysler Pacifica – místo řidiče",
    hotspots: [
      {
        id: "startovani",
        label: "Startování",
        x: 34,
        y: 58,
        detail: {
          id: "startovani",
          title: "Startování a místo řidiče",
          image: "/04_kokpit_a_technologie.jpg",
          alt: "Chrysler Pacifica – kokpit",
          text:
            "Digitální přístrojový panel, multifunkční volant a centrální dotykový displej Uconnect 5. Bezklíčové startování je k dispozici dle výbavy.",
          bullets: [
            "Digitální přístrojový panel",
            "Uconnect 5 s 25,7 cm dotykovým displejem",
            "Až 5 uživatelských profilů",
            "Bezdrátové Apple CarPlay a Android Auto — dle výbavy",
          ],
        },
      },
      {
        id: "do-druhe-rady",
        label: "Druhá řada",
        x: 76,
        y: 40,
        goToScene: 3,
      },
    ],
  },

  {
    id: "druha-rada",
    name: "Druhá řada",
    image: "/05_2_rada_sedadel.jpg",
    alt: "Chrysler Pacifica – druhá řada sedadel",
    hotspots: [
      {
        id: "druha-rada-detail",
        label: "Sedadla druhé řady",
        x: 42,
        y: 55,
        detail: {
          id: "druha-rada-detail",
          title: "Druhá řada",
          image: "/05_2_rada_sedadel.jpg",
          alt: "Chrysler Pacifica – druhá řada",
          text:
            "Druhá řada je řešená s ohledem na pohodlí i snadný přístup dozadu. Konfigurace se liší podle verze vozu.",
          bullets: [
            "Samostatná sedadla nebo lavice — dle verze",
            "Easy Tilt pro přístup do třetí řady",
            "Stow ’n Go ve druhé řadě — dle konkrétní verze",
          ],
        },
      },
      {
        id: "do-treti-rady",
        label: "Třetí řada",
        x: 78,
        y: 38,
        goToScene: 4,
      },
    ],
  },

  {
    id: "treti-rada",
    name: "Třetí řada",
    image: "/06_3_rada_sedadel.jpg",
    alt: "Chrysler Pacifica – třetí řada sedadel",
    hotspots: [
      {
        id: "treti-rada-detail",
        label: "Třetí řada",
        x: 45,
        y: 56,
        detail: {
          id: "treti-rada-detail",
          title: "Plnohodnotná třetí řada",
          image: "/06_3_rada_sedadel.jpg",
          alt: "Chrysler Pacifica – třetí řada",
          text:
            "Třetí řada má vlastní bezpečnostní pásy i opěrky hlavy. Sedadla lze sklopit do podlahy systémem Stow ’n Go.",
          bullets: [
            "Vlastní pásy a opěrky hlavy",
            "Sklápění do podlahy — Stow ’n Go",
            "Přístup přes posuvné boční dveře",
          ],
        },
      },
      {
        id: "dozadu",
        label: "Zadní část",
        x: 80,
        y: 40,
        goToScene: 5,
      },
    ],
  },

  {
    id: "zadni-cast",
    name: "Zadní část",
    image: "/07_zavazadlovy_prostor.jpg",
    alt: "Chrysler Pacifica – zavazadlový prostor",
    hotspots: [
      {
        id: "stow-n-go",
        label: "Stow ’n Go",
        x: 44,
        y: 58,
        detail: {
          id: "stow-n-go",
          title: "Zavazadlový prostor a Stow ’n Go",
          image: "/07_zavazadlovy_prostor.jpg",
          alt: "Chrysler Pacifica – zavazadlový prostor",
          text:
            "Sedadla se u kompatibilních konfigurací sklápějí přímo do podlahy, bez vyjímání z vozu. Přechod z rodinného vozu na dodávku je otázkou chvilky.",
          bullets: [
            "Maximální nákladový objem až 3 980 l",
            "Sklápění sedadel do podlahy — dle verze",
            "Úložné prostory v podlaze — dle konfigurace",
          ],
        },
      },
      {
        id: "pate-dvere",
        label: "Páté dveře",
        x: 72,
        y: 24,
        detail: {
          id: "pate-dvere",
          title: "Páté dveře",
          image: "/02_zadni_cast.jpg",
          alt: "Chrysler Pacifica – zadní část vozu",
          text:
            "Velká páté dveře s nízkou nakládací hranou. Elektrické ovládání i bezdotykové otevření jsou k dispozici dle výbavy.",
          bullets: [
            "Elektricky ovládané páté dveře — dle výbavy",
            "Bezdotykové otevření — dle výbavy",
            "Nízká nakládací hrana",
          ],
        },
      },
    ],
  },
];

const PacificaTour = () => {
  const navigate = useNavigate();
  const { isLoading } = useSiteContacts();
  const enabled = useFeatureFlag("feature_pacifica_tour_enabled");

  const [sceneIndex, setSceneIndex] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [variant, setVariant] = useState(0);
  const [finished, setFinished] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!isLoading && !enabled) navigate("/", { replace: true });
  }, [isLoading, enabled, navigate]);

  useEffect(() => {
    document.title = "Virtuální prohlídka Chrysler Pacifica | Chrysler Pardubice";
  }, []);

  const scene = useMemo(() => SCENES[sceneIndex], [sceneIndex]);
  const isLast = sceneIndex === SCENES.length - 1;

  if (isLoading || !enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const openHotspot = (h: Hotspot) => {
    if (h.detail) {
      setVariant(0);
      setDetail(h.detail);
      return;
    }
    if (typeof h.goToScene === "number") setSceneIndex(h.goToScene);
  };

  const active = detail?.variants?.[variant];
  const detailImage = active?.image ?? detail?.image;
  const detailAlt = active?.alt ?? detail?.alt;
  const detailText = active?.text ?? detail?.text;
  const detailBullets = active?.bullets ?? detail?.bullets ?? [];

  const lock = () => {
    setLocking(true);
    window.setTimeout(() => navigate("/"), 1800);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Scéna */}
      <img
        key={scene.id}
        src={scene.image}
        alt={scene.alt}
        className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-700"
        loading={sceneIndex === 0 ? "eager" : "lazy"}
        decoding="async"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-black/80 pointer-events-none" />

      {/* Minimální horní lišta */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 z-20">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary">
            Prohlídka
          </p>
          <h1 className="text-sm md:text-base font-serif italic text-white/95">
            Chrysler Pacifica
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Zavřít prohlídku"
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Hotspoty */}
      {!detail && !finished &&
        scene.hotspots.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => openHotspot(h)}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 animate-in fade-in duration-700"
          >
            {h.variant === "key" ? (
              <span className="relative block">
                <span className="absolute inset-0 -m-3 rounded-full bg-primary/30 blur-xl animate-pulse" />
                <img
                  src={keyFob}
                  alt="Klíč Chrysler"
                  width={768}
                  height={1024}
                  loading="lazy"
                  className="relative w-10 md:w-12 h-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)] animate-pulse"
                />
              </span>
            ) : (
              <span className="relative flex items-center justify-center w-6 h-6">
                <span className="absolute inset-0 rounded-full bg-primary/50 animate-ping" />
                <span className="relative w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/25 shadow-[0_0_18px_hsl(var(--primary))]" />
              </span>
            )}

            <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-[11px] tracking-wide text-white whitespace-nowrap">
              {h.label}
            </span>
          </button>
        ))}

      {/* Spodní ovládání */}
      {!detail && !finished && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSceneIndex((i) => Math.max(0, i - 1))}
            disabled={sceneIndex === 0}
            aria-label="Předchozí scéna"
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white disabled:opacity-30 active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center gap-1.5 justify-center">
            {SCENES.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 rounded-full transition-all ${
                  i === sceneIndex ? "w-7 bg-primary" : "w-3 bg-white/30"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              type="button"
              onClick={() => setFinished(true)}
              className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition"
            >
              Dokončit
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSceneIndex((i) => i + 1)}
              aria-label="Další scéna"
              className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Detail po kliknutí */}
      {detail && (
        <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-end md:items-center md:justify-center animate-in fade-in duration-300">
          <div className="w-full md:max-w-2xl bg-card/95 border-t md:border border-white/10 md:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-500 max-h-[92vh] overflow-y-auto">
            <div className="relative aspect-[16/10]">
              <img
                src={detailImage}
                alt={detailAlt ?? ""}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />

              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Zavřít detail"
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 md:p-7">
              <h2 className="text-lg md:text-2xl font-serif font-bold text-foreground mb-2">
                {detail.title}
              </h2>

              {detail.variants && (
                <div className="flex gap-2 mb-4">
                  {detail.variants.map((v, i) => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => setVariant(i)}
                      className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider border transition-colors ${
                        i === variant
                          ? "border-primary bg-primary/15 text-foreground font-semibold"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-sm text-muted-foreground leading-relaxed font-montserrat">
                {detailText}
              </p>

              <ul className="mt-4 space-y-2">
                {detailBullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-3 text-sm text-foreground/90 font-montserrat"
                  >
                    <span
                      className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                      aria-hidden="true"
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="outline-button flex-1"
                >
                  Zpět ke scéně
                </button>

                {!isLast && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetail(null);
                      setSceneIndex((i) => Math.min(SCENES.length - 1, i + 1));
                    }}
                    className="chrome-button flex-1"
                  >
                    Pokračovat
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Konec prohlídky – zamknutí vozu */}
      {finished && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center px-6 text-center animate-in fade-in duration-500">
          {locking && (
            <div className="absolute inset-0 bg-primary/25 animate-pulse pointer-events-none" />
          )}

          <button
            type="button"
            onClick={lock}
            disabled={locking}
            className="relative"
            aria-label="Zamknout vůz a dokončit prohlídku"
          >
            <span className="absolute inset-0 -m-6 rounded-full bg-primary/25 blur-2xl animate-pulse" />
            <img
              src={keyFob}
              alt="Klíč Chrysler"
              width={768}
              height={1024}
              loading="lazy"
              className={`relative w-24 h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-transform ${
                locking ? "scale-90" : "animate-pulse"
              }`}
            />
          </button>

          <p className="mt-8 text-white text-lg font-serif italic">
            {locking ? "Prohlídka dokončena" : "Zamknout vůz"}
          </p>

          {!locking && (
            <button
              type="button"
              onClick={() => setFinished(false)}
              className="mt-6 text-xs uppercase tracking-[0.2em] text-white/60"
            >
              Zpět do prohlídky
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PacificaTour;

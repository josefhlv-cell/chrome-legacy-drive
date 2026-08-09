import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Home, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSiteContacts } from "@/hooks/useAdminContent";

/**
 * Interaktivní virtuální prohlídka Chrysler Pacifica.
 *
 * Fotografie jsou uloženy přímo ve složce /public:
 *
 * /01_predni_cast.jpg
 * /02_zadni_cast.jpg
 * /03_bocni_pohled.jpg
 * /04_kokpit_a_technologie.jpg
 * /05_2_rada_sedadel.jpg
 * /06_3_rada_sedadel.jpg
 * /07_zavazadlovy_prostor.jpg
 * /08_posuvne_dvere.jpg
 * /09_design_a_detaily.jpg
 * /10_motor_a_prevodovka.jpg
 * /11_pacifica_hybrid.jpg
 *
 * Informace jsou formulovány jako obecný popis Chrysler Pacifica.
 * Funkce závislé na konkrétní verzi nebo výbavě jsou vždy označeny.
 *
 * Jednotky jsou uváděny v evropském formátu:
 * - výkon: kW
 * - točivý moment: Nm
 * - objem: l
 * - vzdálenost: km
 * - spotřeba: l/100 km
 * - objem zavazadlového prostoru: l
 * - rozměry displeje: cm
 */

type Stop = {
  id: string;
  label: string;
  title: string;
  image: string;
  alt: string;
  text: string;
  bullets: string[];
};

const STOPS: Stop[] = [
  {
    id: "exterier",
    label: "Přední část",
    title: "Přední část a design",
    image: "/01_predni_cast.jpg",
    alt: "Chrysler Pacifica – přední část vozu",
    text:
      "Chrysler Pacifica je prostorný rodinný minivan se třemi řadami sedadel. Přední část kombinuje výrazný design s LED osvětlením a charakteristickými proporcemi moderní Pacificy. Konkrétní provedení přední části, světlometů, masky a dalších designových prvků se může lišit podle verze a výbavy.",
    bullets: [
      "LED přední světlomety — dle výbavy",
      "LED denní svícení — dle výbavy",
      "LED zadní světla",
      "Design přední části a masky se liší podle verze",
      "K dispozici jsou různé designy kol a další prvky vzhledu — dle výbavy",
    ],
  },

  {
    id: "zadni-cast",
    label: "Zadní část",
    title: "Zadní část a praktické řešení",
    image: "/02_zadni_cast.jpg",
    alt: "Chrysler Pacifica – zadní část vozu",
    text:
      "Zadní část Pacificy je navržená především s ohledem na praktičnost. Kombinuje velké páté dveře, nízkou nakládací hranu a snadný přístup k zavazadlovému prostoru. Elektricky ovládané páté dveře a bezdotykové ovládání jsou dostupné podle konkrétní výbavy.",
    bullets: [
      "Elektricky ovládané páté dveře — dle výbavy",
      "Bezdotykové otevření pátých dveří — dle výbavy",
      "Velký a dobře přístupný zavazadlový prostor",
      "LED zadní světla",
      "Praktické řešení pro každodenní přepravu rodiny i nákladu",
    ],
  },

  {
    id: "bocni-cast",
    label: "Boční část",
    title: "Boční část a posuvné dveře",
    image: "/03_bocni_pohled.jpg",
    alt: "Chrysler Pacifica – boční pohled",
    text:
      "Jednou z hlavních předností Pacificy jsou elektricky ovládané posuvné boční dveře. Díky jejich konstrukci není při nastupování potřeba prostor vedle vozu jako u klasických dveří. To je praktické především na úzkých parkovacích místech nebo při nastupování dětí.",
    bullets: [
      "Elektricky ovládané posuvné boční dveře",
      "Posuvné dveře na obou stranách vozu",
      "Hands-free otevření pohybem nohy — dle výbavy",
      "Snadný přístup ke druhé i třetí řadě",
      "Praktické řešení pro úzká parkovací místa",
    ],
  },

  {
    id: "misto-ridice",
    label: "Místo řidiče",
    title: "Kokpit a místo řidiče",
    image: "/04_kokpit_a_technologie.jpg",
    alt: "Chrysler Pacifica – kokpit a místo řidiče",
    text:
      "Kokpit Pacificy kombinuje digitální přístrojový panel, multifunkční volant a centrální dotykový displej systému Uconnect 5. Rozložení ovládacích prvků je navrženo tak, aby měl řidič důležité funkce snadno dostupné během jízdy.",
    bullets: [
      "Digitální přístrojový panel",
      "Multifunkční volant",
      "Uconnect 5 s 25,7 cm dotykovým displejem",
      "Uživatelské profily — až 5 profilů",
      "Bezdrátové Apple CarPlay — dle výbavy",
      "Android Auto — dle výbavy",
    ],
  },

  {
    id: "druha-rada",
    label: "Druhá řada",
    title: "Druhá řada sedadel",
    image: "/05_2_rada_sedadel.jpg",
    alt: "Chrysler Pacifica – druhá řada sedadel",
    text:
      "Druhá řada je navržena s důrazem na pohodlí i snadný přístup do třetí řady. Pacifica nabízí různé konfigurace druhé řady podle konkrétní verze. U vybraných provedení je k dispozici systém Stow ’n Go, který umožňuje složit sedadla přímo do podlahy.",
    bullets: [
      "Samostatná sedadla ve druhé řadě — dle verze",
      "Lavice ve druhé řadě — dle verze",
      "Easy Tilt pro snadnější přístup do třetí řady",
      "Stow ’n Go ve druhé řadě — dle konkrétní verze",
      "Možnost konfigurace až pro 8 cestujících — dle verze",
    ],
  },

  {
    id: "treti-rada",
    label: "Třetí řada",
    title: "Třetí řada sedadel",
    image: "/06_3_rada_sedadel.jpg",
    alt: "Chrysler Pacifica – třetí řada sedadel",
    text:
      "Třetí řada je plnohodnotnou součástí interiéru Pacificy. Sedadla lze podle konkrétní konfigurace sklopit do podlahy pomocí systému Stow ’n Go, což výrazně zjednodušuje přechod mezi přepravou cestujících a nákladu.",
    bullets: [
      "Plnohodnotná třetí řada",
      "Vlastní bezpečnostní pásy a opěrky hlavy",
      "Sklápění třetí řady do podlahy pomocí Stow ’n Go",
      "Snadný přístup přes posuvné boční dveře",
      "Praktické řešení pro rodinné cestování",
    ],
  },

  {
    id: "zavazadlovy-prostor",
    label: "Zavazadlový prostor",
    title: "Zavazadlový prostor a Stow ’n Go",
    image: "/07_zavazadlovy_prostor.jpg",
    alt: "Chrysler Pacifica – zavazadlový prostor",
    text:
      "Pacifica je navržena tak, aby zvládla přepravu cestujících i velkého množství nákladu. Systém Stow ’n Go umožňuje u kompatibilních konfigurací sklopit zadní sedadla přímo do podlahy bez jejich vyjímání. Přechod z plně obsazeného rodinného vozu na velký nákladový prostor je tak rychlý a praktický.",
    bullets: [
      "Maximální nákladový objem až 3 980 l",
      "Sedadla se sklápějí přímo do podlahy — dle verze",
      "Bez nutnosti vyjímat sedadla z vozu",
      "Velký prostor pro zavazadla i objemnější předměty",
      "Praktické úložné prostory v podlaze — dle konfigurace",
    ],
  },

  {
    id: "posuvne-dvere",
    label: "Posuvné dveře",
    title: "Snadný přístup do interiéru",
    image: "/08_posuvne_dvere.jpg",
    alt: "Chrysler Pacifica – posuvné boční dveře",
    text:
      "Posuvné boční dveře patří mezi nejpraktičtější prvky Pacificy. Elektrické ovládání usnadňuje nastupování cestujících i nakládání věcí. U vybraných verzí lze dveře otevřít také bez použití rukou jednoduchým pohybem nohy pod vozem.",
    bullets: [
      "Elektricky ovládané posuvné dveře",
      "Hands-free ovládání — dle výbavy",
      "Široký vstup do druhé i třetí řady",
      "Snadné nastupování dětí i dospělých",
      "Výhodné řešení při parkování v těsném prostoru",
    ],
  },

  {
    id: "technologie",
    label: "Technologie",
    title: "Technologie, komfort a bezpečnost",
    image: "/09_design_a_detaily.jpg",
    alt: "Chrysler Pacifica – designové a technologické detaily",
    text:
      "Pacifica nabízí rozsáhlou výbavu zaměřenou na komfort, konektivitu a bezpečnost. Uconnect 5 využívá 25,7 cm displej a podporuje až pět uživatelských profilů. Pro cestující vzadu může být k dispozici FamCAM, zadní obrazovky s Amazon Fire TV nebo prémiový audiosystém Harman Kardon.",
    bullets: [
      "Uconnect 5 s 25,7 cm dotykovým displejem",
      "Až 5 uživatelských profilů",
      "Bezdrátové Apple CarPlay — dle výbavy",
      "Android Auto — dle výbavy",
      "FamCAM s denním a nočním režimem — dle výbavy",
      "Dvě 25,4 cm zadní obrazovky s Amazon Fire TV — dle výbavy",
      "Harman Kardon Premium Audio s 19 reproduktory — dle výbavy",
      "Adaptivní tempomat se Stop & Go — dle výbavy",
      "Forward Collision Warning s aktivním brzděním",
      "LaneSense s funkcí udržování v jízdním pruhu — dle výbavy",
      "Blind Spot Monitoring — dle výbavy",
      "ParkSense a zadní kamera — dle výbavy",
    ],
  },

  {
    id: "motor-a-prevodovka",
    label: "Motor",
    title: "3.6 Pentastar V6 a devítistupňová převodovka",
    image: "/10_motor_a_prevodovka.jpg",
    alt: "Chrysler Pacifica – motor 3.6 Pentastar V6",
    text:
      "Srdcem klasické Pacificy je atmosférický šestiválec 3.6 Pentastar V6. Chrysler u této kombinace uvádí výkon přibližně 214 kW a točivý moment přibližně 356 Nm. Motor je spojen s devítistupňovou automatickou převodovkou TorqueFlite. Výsledkem je kombinace dostatečného výkonu pro plně obsazený vůz, plynulé jízdy a rozumné spotřeby vzhledem k velikosti a hmotnosti vozu.",
    bullets: [
      "3.6 Pentastar V6",
      "Výkon přibližně 214 kW",
      "Točivý moment přibližně 356 Nm",
      "9stupňová automatická převodovka TorqueFlite",
      "Plynulý průběh výkonu vhodný pro dálniční i rodinný provoz",
      "Spotřeba FWD: až cca 10,7 l/100 km kombinovaně — dle konkrétní verze",
      "Spotřeba AWD: až cca 11,8 l/100 km kombinovaně — dle konkrétní verze",
      "Osvědčená konstrukce Pentastar V6 používaná napříč modely Chrysler, Dodge, Jeep a RAM",
    ],
  },

  {
    id: "hybrid",
    label: "Hybrid",
    title: "Pacifica Plug-in Hybrid",
    image: "/11_pacifica_hybrid.jpg",
    alt: "Chrysler Pacifica Plug-in Hybrid – motorový prostor",
    text:
      "Plug-in Hybrid spojuje 3.6litrový V6 s elektrickým pohonem a vysokonapěťovou lithium-iontovou baterií. Smyslem tohoto řešení není pouze maximální výkon, ale především možnost využívat elektřinu pro každodenní kratší trasy a spalovací motor pro delší cesty. Při zpomalování systém zároveň využívá rekuperační brzdění k získávání části energie zpět do baterie.",
    bullets: [
      "3.6litrový V6 v kombinaci s elektrickým pohonem",
      "Systémový výkon až 194 kW",
      "Plug-in nabíjení z externího zdroje",
      "Až 51 km čistě elektrického dojezdu dle údajů Chrysleru",
      "Energetická spotřeba odpovídá přibližně 2,9 l/100 km při přepočtu americké metodiky MPGe — nejde o běžnou spotřebu benzínu",
      "Rekuperační brzdění pomáhá vracet energii zpět do baterie",
      "Po vyčerpání elektrického dojezdu vůz pokračuje na benzinový pohon",
      "Výhoda především pro řidiče, kteří pravidelně nabíjejí a jezdí kratší každodenní trasy",
    ],
  },
];

const PacificaTour = () => {
  const navigate = useNavigate();
  const { isLoading } = useSiteContacts();
  const enabled = useFeatureFlag("feature_pacifica_tour_enabled");
  const [index, setIndex] = useState(0);

  // Vypnutá funkce = i přímý odkaz na stránku je nedostupný.
  useEffect(() => {
    if (!isLoading && !enabled) {
      navigate("/", { replace: true });
    }
  }, [isLoading, enabled, navigate]);

  const stop = useMemo(() => STOPS[index], [index]);

  useEffect(() => {
    document.title =
      "Virtuální prohlídka Chrysler Pacifica | Chrysler Pardubice";
  }, []);

  if (isLoading || !enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const prev = () =>
    setIndex((i) => (i === 0 ? STOPS.length - 1 : i - 1));

  const next = () =>
    setIndex((i) => (i === STOPS.length - 1 ? 0 : i + 1));

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-5xl">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">
            Virtuální prohlídka
          </p>

          <h1 className="text-3xl md:text-5xl font-serif italic font-black text-foreground">
            Chrysler Pacifica
          </h1>

          <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl font-montserrat">
            Projděte si Chrysler Pacifica po jednotlivých zastaveních.
            Výbava a konkrétní technické řešení se mohou lišit podle verze
            vozu — u položek závislých na výbavě to vždy uvádíme.
          </p>
        </header>

        {/* Navigace zastavení */}
        <nav
          aria-label="Zastavení prohlídky"
          className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1"
        >
          {STOPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              className={`shrink-0 px-4 py-2 rounded-full text-xs md:text-sm border transition-colors ${
                i === index
                  ? "border-primary bg-primary/15 text-foreground font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Zastavení */}
        <article className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
          <div className="relative aspect-[16/9] bg-secondary/40">
            <img
              key={stop.id}
              src={stop.image}
              alt={stop.alt}
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover animate-in fade-in duration-500"
            />

            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/80 via-transparent to-transparent" />

            <span className="absolute bottom-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground bg-background/70 px-2 py-1 rounded">
              Fotografie vozu
            </span>
          </div>

          <div className="p-5 md:p-8">
            <p className="text-xs text-muted-foreground mb-2">
              Zastavení {index + 1} z {STOPS.length}
            </p>

            <h2 className="text-xl md:text-3xl font-serif font-bold text-foreground mb-3">
              {stop.title}
            </h2>

            <p className="text-sm md:text-base text-muted-foreground leading-relaxed font-montserrat">
              {stop.text}
            </p>

            <ul className="mt-5 space-y-2">
              {stop.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 text-sm text-foreground/90 font-montserrat"
                >
                  <span
                    className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                    aria-hidden="true"
                  />

                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        {/* Ovládání */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={prev}
            className="outline-button inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět
          </button>

          <button
            type="button"
            onClick={next}
            className="chrome-button inline-flex items-center justify-center gap-2"
          >
            Další
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link
            to="/"
            className="outline-button inline-flex items-center justify-center gap-2 sm:ml-auto"
          >
            <Home className="w-4 h-4" />
            Zavřít prohlídku
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground font-montserrat">
          Uvedené informace jsou obecným popisem Chrysler Pacifica.
          Konkrétní výbava, konfigurace sedadel, pohon, technologie a
          asistenční systémy se mohou lišit podle verze a výbavy konkrétního
          vozu. Technické údaje a spotřeba se mohou lišit podle trhu,
          konfigurace, pohonu a metodiky měření. Konkrétní parametry vždy
          ověříme podle VIN.
        </p>
      </main>
    </div>
  );
};

export default PacificaTour;

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Home, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSiteContacts } from "@/hooks/useAdminContent";

import imgFront from "@/assets/tour/pacifica-front.jpg";
import imgCargo from "@/assets/tour/pacifica-cargo.jpg";
import imgSide from "@/assets/tour/pacifica-side.jpg";
import imgDriver from "@/assets/tour/pacifica-driver.jpg";
import imgRow2 from "@/assets/tour/pacifica-row2.jpg";
import imgRow3 from "@/assets/tour/pacifica-row3.jpg";
import imgFlex from "@/assets/tour/pacifica-flex.jpg";
import imgTech from "@/assets/tour/pacifica-tech.jpg";
import imgSafety from "@/assets/tour/pacifica-safety.jpg";

/**
 * Interaktivní prohlídka Chrysler Pacifica.
 *
 * Texty vycházejí výhradně z oficiálních materiálů Chrysler / Stellantis.
 * Vše, co závisí na verzi či výbavě, je označeno „dle výbavy“. Model rok se
 * v UI záměrně neuvádí.
 *
 * Ilustrační vizualizace slouží pouze k navigaci prohlídkou — proto jsou
 * neutrální (bez log a označení) a text u nich uvádí, že jde o ilustraci.
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
    image: imgFront,
    alt: "Ilustrační vizualizace přední části prostorného MPV v showroomu",
    text: "Pacifica je plnohodnotné rodinné MPV s pěti dveřmi a třemi řadami sedadel. Přední masce dominuje prosvětlený znak Chrysler s okřídleným logem, který je součástí LED světelné signatury napříč celou přídí. Světelná animace při odemčení a zamčení i konkrétní provedení masky se liší podle verze.",
    bullets: [
      "Prosvětlený okřídlený znak Chrysler v přední masce — dle výbavy",
      "LED světlomety, denní svícení i LED zadní světla",
      "Světelná animace při příchodu a odchodu — dle výbavy",
      "Sedmimístné uspořádání ve třech řadách; osm míst dle verze",
    ],
  },
  {
    id: "zavazadlovy-prostor",
    label: "Zavazadlový prostor",
    title: "Zavazadlový prostor a páté dveře",
    image: imgCargo,
    alt: "Ilustrační vizualizace otevřeného zavazadlového prostoru MPV",
    text: "Za třetí řadou zůstává hluboká vana pro nákup i kufry. Po složení sedadel do podlahy vznikne rovná ložná plocha — Chrysler uvádí celkový objem až 140,5 cu ft (přibližně 3 980 litrů). Elektricky ovládané páté dveře mají nastavitelnou výšku otevření, takže se dají přizpůsobit nízké garáži nebo přístřešku.",
    bullets: [
      "Rovná ložná plocha po složení sedadel do podlahy",
      "Celkový objem až 140,5 cu ft (cca 3 980 l) dle oficiálních údajů",
      "Elektrické páté dveře s nastavitelnou výškou otevření",
      "Hluboká vana za třetí řadou i při plném obsazení",
    ],
  },
  {
    id: "posuvne-dvere",
    label: "Posuvné dveře",
    title: "Posuvné boční dveře",
    image: imgSide,
    alt: "Ilustrační vizualizace MPV s otevřenými posuvnými bočními dveřmi",
    text: "Posuvné dveře na obou stranách otevřou široký vstup do druhé i třetí řady. Elektrické ovládání je součástí vozu už od základní verze, bezdotykové otevírání pohybem nohy pod vozem je pak otázkou výbavy. V úzkém parkovacím místě se nemusí nic vyklápět do strany.",
    bullets: [
      "Elektricky ovládané posuvné dveře na obou stranách",
      "Bezdotykové otevírání pohybem nohy pod vozem — dle výbavy",
      "Široký a bezpečný vstup do druhé i třetí řady",
      "Vhodné pro úzké garáže a parkovací místa",
    ],
  },
  {
    id: "misto-ridice",
    label: "Místo řidiče",
    title: "Místo řidiče",
    image: imgDriver,
    alt: "Ilustrační vizualizace interiéru u místa řidiče",
    text: "Pracoviště řidiče kombinuje digitální přístrojový štít, dotykový displej Uconnect na středu palubní desky a ovládací prvky na volantu. Provedení palubní desky, materiály a dekory se liší podle verze — u nejvyšších stupňů výbavy jde o kombinaci kůže a tmavých platinových dekorů.",
    bullets: [
      "Digitální přístrojový štít",
      "Dotykový displej Uconnect na středu palubní desky",
      "Ovládání hlavních funkcí na volantu",
      "Materiály a dekory interiéru — dle výbavy",
    ],
  },
  {
    id: "druha-rada",
    label: "Druhá řada",
    title: "Druhá řada",
    image: imgRow2,
    alt: "Ilustrační vizualizace druhé řady sedadel v MPV",
    text: "Druhou řadu tvoří samostatná sedadla s průchodem doprostřed. Funkce Easy Tilt umožní naklonit sedadlo dopředu a pustit cestující do třetí řady. Pacifica je podle Chrysleru jediné MPV, které nabízí pohon všech kol v kombinaci se systémem Stow ’n Go ve druhé řadě — dostupnost pohonu 4x4 je vázaná na konkrétní verzi.",
    bullets: [
      "Samostatná sedadla s průchodem do třetí řady",
      "Easy Tilt — naklonění sedadla pro snadný přístup vzadu",
      "Osmimístné uspořádání s lavicí ve druhé řadě — dle verze",
      "Pohon všech kol i se Stow ’n Go ve druhé řadě — dle verze",
    ],
  },
  {
    id: "treti-rada",
    label: "Třetí řada",
    title: "Třetí řada",
    image: imgRow3,
    alt: "Ilustrační vizualizace třetí řady sedadel v MPV",
    text: "Třetí řada je plnohodnotná — se samostatnými pásy a opěrkami hlavy. Sedadla se sklápějí přímo do podlahy vozu, takže se nemusí vyjímat ani nikam odkládat.",
    bullets: [
      "Plnohodnotná místa s vlastními pásy a opěrkami hlavy",
      "Sklopná do podlahy bez demontáže sedadel",
      "Vlastní okna a odkládací prostory",
    ],
  },
  {
    id: "variabilita",
    label: "Variabilita",
    title: "Variabilita interiéru a Stow ’n Go",
    image: imgFlex,
    alt: "Ilustrační vizualizace interiéru MPV se sedadly složenými do podlahy",
    text: "Systém Stow ’n Go sklápí sedadla druhé i třetí řady přímo do podlahy vozu — z auta pro sedm lidí se tak během chvíle stane dodávka s rovnou ložnou plochou. Chrysler tento systém uvádí jako výsadu své třídy; jeho konkrétní rozsah je vázaný na verzi a výbavu vozu, proto ho u každého vozu potvrzujeme individuálně.",
    bullets: [
      "Sedadla se sklápějí do podlahy, nikoli na podlahu",
      "Druhá i třetí řada — dle verze a výbavy vozu",
      "Rovná ložná plocha bez prahů a překážek",
      "Prostor pod podlahou lze využít i pro odkládání věcí",
    ],
  },
  {
    id: "technologie",
    label: "Technologie",
    title: "Infotainment a technologie",
    image: imgTech,
    alt: "Ilustrační vizualizace středového panelu s dotykovým displejem",
    text: "Multimédia Uconnect 5 běží na 10,1″ dotykovém displeji, zvládnou až pět uživatelských profilů a bezdrátové připojení Apple CarPlay i propojení s Android Auto. K dispozici je také kamera FamCAM mířící na cestující ve druhé a třetí řadě, obrazovky pro zadní pasažéry nebo prémiový zvuk — vždy podle výbavy.",
    bullets: [
      "Uconnect 5 s 10,1″ dotykovým displejem a profily uživatelů",
      "Bezdrátový Apple CarPlay a Android Auto",
      "FamCAM — kamera na cestující vzadu s nočním režimem, dle výbavy",
      "10″ obrazovky vzadu s Amazon Fire TV — dle výbavy",
      "Prémiový zvuk Harman Kardon (19 reproduktorů) — dle výbavy",
    ],
  },
  {
    id: "bezpecnost",
    label: "Bezpečnost",
    title: "Bezpečnost a komfort",
    image: imgSafety,
    alt: "Ilustrační vizualizace MPV za soumraku na mokré vozovce",
    text: "Pacifica je koncipovaná jako rodinné auto na dlouhé přejezdy a nabízí širokou sadu asistenčních systémů. Jejich konkrétní složení se odvíjí od verze a výbavy vozu — u každého konkrétního vozu vám je potvrdíme podle VIN.",
    bullets: [
      "Varování před kolizí s aktivním brzděním, i do úplného zastavení — dle výbavy",
      "Adaptivní cruise control se zastavením a rozjezdem — dle výbavy",
      "Automatické brzdění při detekci chodce — dle výbavy",
      "LaneSense — hlídání jízdních pruhů s asistentem udržení — dle výbavy",
      "Sledování mrtvého úhlu a varování při vyjíždění z parkování — dle výbavy",
      "ParkSense — parkovací asistent a zpětná kamera s ostřikovačem — dle výbavy",
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
    if (!isLoading && !enabled) navigate("/", { replace: true });
  }, [isLoading, enabled, navigate]);

  const stop = useMemo(() => STOPS[index], [index]);

  useEffect(() => {
    document.title = "Virtuální prohlídka Chrysler Pacifica | Chrysler Pardubice";
  }, []);

  if (isLoading || !enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const prev = () => setIndex((i) => (i === 0 ? STOPS.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === STOPS.length - 1 ? 0 : i + 1));

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-5xl">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Virtuální prohlídka</p>
          <h1 className="text-3xl md:text-5xl font-serif italic font-black text-foreground">
            Chrysler Pacifica
          </h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl font-montserrat">
            Projděte si vůz po jednotlivých zastaveních. Výbava se liší podle verze — u položek
            závislých na výbavě to vždy uvádíme.
          </p>
        </header>

        {/* Navigace zastavení */}
        <nav aria-label="Zastavení prohlídky" className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
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
              Ilustrační vizualizace
            </span>
          </div>

          <div className="p-5 md:p-8">
            <p className="text-xs text-muted-foreground mb-2">
              Zastavení {index + 1} z {STOPS.length}
            </p>
            <h2 className="text-xl md:text-3xl font-serif font-bold text-foreground mb-3">{stop.title}</h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed font-montserrat">
              {stop.text}
            </p>
            <ul className="mt-5 space-y-2">
              {stop.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-sm text-foreground/90 font-montserrat">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        {/* Ovládání */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={prev} className="outline-button inline-flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Zpět
          </button>
          <button type="button" onClick={next} className="chrome-button inline-flex items-center justify-center gap-2">
            Další <ArrowRight className="w-4 h-4" />
          </button>
          <Link to="/" className="outline-button inline-flex items-center justify-center gap-2 sm:ml-auto">
            <Home className="w-4 h-4" /> Zavřít prohlídku
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground font-montserrat">
          Uvedené informace jsou obecným popisem modelu Chrysler Pacifica. Výbava, motorizace i
          řešení sedadel se liší podle verze vozu — konkrétní parametry vždy ověříme podle VIN.
          Obrázky jsou ilustrační.
        </p>
      </main>
    </div>
  );
};

export default PacificaTour;

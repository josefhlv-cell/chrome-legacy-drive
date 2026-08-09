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
    text: "Pacifica je plnohodnotné rodinné MPV s pěti dveřmi, třemi řadami sedadel a nízkou nástupní výškou. Karoserie je navržená tak, aby při maximálním vnitřním prostoru zůstala co nejvíc aerodynamická.",
    bullets: [
      "Sedmimístné uspořádání ve třech řadách",
      "LED světlomety a chromové detaily dle výbavy",
      "Nízká nástupní výška pro děti i starší pasažéry",
    ],
  },
  {
    id: "zavazadlovy-prostor",
    label: "Zavazadlový prostor",
    title: "Zavazadlový prostor a páté dveře",
    image: imgCargo,
    alt: "Ilustrační vizualizace otevřeného zavazadlového prostoru MPV",
    text: "Za třetí řadou zůstává hluboká vana pro běžný nákup i kufry. Po složení třetí řady do podlahy vznikne rovná ložná plocha bez prahů a hran.",
    bullets: [
      "Hluboká vana za třetí řadou i při plném obsazení",
      "Rovná ložná plocha po složení sedadel do podlahy",
      "Elektricky ovládané páté dveře dle výbavy",
    ],
  },
  {
    id: "posuvne-dvere",
    label: "Posuvné dveře",
    title: "Posuvné boční dveře",
    image: imgSide,
    alt: "Ilustrační vizualizace MPV s otevřenými posuvnými bočními dveřmi",
    text: "Posuvné dveře na obou stranách otevřou široký vstup do druhé i třetí řady. V úzkém parkovacím místě se nemusí nic vyklápět do strany, což usnadní usazení dětské sedačky.",
    bullets: [
      "Široký vstup do druhé i třetí řady",
      "Elektrické ovládání posuvných dveří dle výbavy",
      "Vhodné pro parkování v úzkých garážích",
    ],
  },
  {
    id: "misto-ridice",
    label: "Místo řidiče",
    title: "Místo řidiče",
    image: imgDriver,
    alt: "Ilustrační vizualizace interiéru u místa řidiče",
    text: "Pracoviště řidiče je postavené na vysokém posedu a dobrém rozhledu. Ovládání klimatizace i hlavních funkcí zůstává na fyzických prvcích, volič převodovky je řešený otočným ovladačem na středovém panelu.",
    bullets: [
      "Vysoký posed a přehled o provozu",
      "Otočný volič automatické převodovky",
      "Vyhřívání volantu a sedadel dle výbavy",
    ],
  },
  {
    id: "druha-rada",
    label: "Druhá řada",
    title: "Druhá řada",
    image: imgRow2,
    alt: "Ilustrační vizualizace druhé řady sedadel v MPV",
    text: "Druhou řadu tvoří dvě samostatná sedadla s průchodem mezi nimi. Sedadla jdou posouvat a sklápět, takže se dá volit mezi větším prostorem pro nohy ve druhé a ve třetí řadě.",
    bullets: [
      "Dvě samostatná sedadla s průchodem doprostřed",
      "Podélné posouvání pro přístup do třetí řady",
      "Kotvicí body pro dětské sedačky",
    ],
  },
  {
    id: "treti-rada",
    label: "Třetí řada",
    title: "Třetí řada",
    image: imgRow3,
    alt: "Ilustrační vizualizace třetí řady sedadel v MPV",
    text: "Třetí řada je plnohodnotná dvoumístná lavice se samostatnými pásy a opěrkami hlavy. Není to nouzové řešení jen pro krátkou cestu ve městě.",
    bullets: [
      "Dvě plnohodnotná místa s vlastními pásy",
      "Vlastní okna a odkládací prostory",
      "Sklopná do podlahy — bez demontáže",
    ],
  },
  {
    id: "variabilita",
    label: "Variabilita",
    title: "Variabilita interiéru a Stow ’n Go",
    image: imgFlex,
    alt: "Ilustrační vizualizace interiéru MPV se sedadly složenými do podlahy",
    text: "Systém Stow ’n Go sklápí sedadla přímo do podlahy vozu, takže se nic nemusí vynášet a nikde nezůstane překážka. Pozor na rozdíl mezi verzemi: u spalovacích verzí lze do podlahy sklopit druhou i třetí řadu, u plug-in hybridní verze je Stow ’n Go pro druhou řadu k dispozici pouze u třetí řady — druhá řada se vyjímá nebo sklápí jinak, protože prostor pod podlahou zabírá trakční baterie.",
    bullets: [
      "Sedadla se sklápějí do podlahy, nikoli na podlahu",
      "Spalovací verze: druhá i třetí řada do podlahy",
      "Plug-in hybrid: do podlahy se sklápí třetí řada",
      "Konkrétní řešení vždy dle verze a výbavy",
    ],
  },
  {
    id: "technologie",
    label: "Technologie",
    title: "Infotainment a technologie",
    image: imgTech,
    alt: "Ilustrační vizualizace středového panelu s dotykovým displejem",
    text: "Multimédia Uconnect běží na dotykovém displeji uprostřed palubní desky a podporují propojení s telefonem přes Apple CarPlay a Android Auto. Rozsah funkcí — velikost displeje, bezdrátové propojení, navigace, zvukový systém nebo obrazovky pro zadní pasažéry — se liší podle verze a výbavy.",
    bullets: [
      "Uconnect s dotykovým displejem",
      "Apple CarPlay a Android Auto",
      "Navigace, prémiový zvuk a obrazovky vzadu dle výbavy",
      "USB porty pro druhou i třetí řadu dle výbavy",
    ],
  },
  {
    id: "bezpecnost",
    label: "Bezpečnost",
    title: "Bezpečnost a komfort",
    image: imgSafety,
    alt: "Ilustrační vizualizace MPV za soumraku na mokré vozovce",
    text: "Pacifica je koncipovaná jako rodinné auto na dlouhé přejezdy — s asistenčními systémy a komfortní výbavou, jejíž konkrétní složení se odvíjí od verze. Přesnou výbavu konkrétního vozu vám vždy potvrdíme podle VIN.",
    bullets: [
      "Zpětná kamera a parkovací asistence dle výbavy",
      "Asistenty jízdy (např. sledování mrtvého úhlu) dle výbavy",
      "Tříbodové pásy a opěrky hlavy pro všechna místa",
      "Přesnou výbavu ověříme podle VIN daného vozu",
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

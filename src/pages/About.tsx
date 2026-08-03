import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Search, Shield, Wrench, Star, Quote, MapPin, Clock, Users, Phone, Mail, Camera, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFacilityPhotos } from "@/hooks/useAdminContent";
import workshop1 from "@/assets/workshop-1.webp";
import workshop2 from "@/assets/workshop-2.webp";
import workshop3 from "@/assets/workshop-3.webp";
import workshop4 from "@/assets/workshop-4.webp";
import CardBg from "@/components/CardBg";

const reasons = [
  { icon: Search, title: "Specializace", text: "Chrysler není jen jedna z mnoha značek v našem portfoliu. Je to naše vášeň. Známe každý šroubek modelů Pacifica, Voyager i Grand Caravan." },
  { icon: Shield, title: "Transparentnost", text: "Každý vůz v naší nabídce prochází přísnou kontrolou. U nás neexistují skryté vady – ke každému vozu dodáváme kompletní historii a prověření Carfax." },
  { icon: Wrench, title: "Komplexní péče", text: "Prodejem to u nás nekončí. Zajišťujeme odborný servis, dodávky originálních náhradních dílů a profesionální přestavby na LPG." },
  { icon: CheckCircle, title: "Dovoz bez rizika", text: "Pokud si nevyberete z našich skladových zásob, najdeme a dovezeme vám vůz snů přímo z USA nebo EU. Vyřešíme za vás clo, homologaci i přihlášení." },
];

const milestones = [
  { year: "2003", text: "Založení společnosti CHDP s.r.o. — začátek specializace na vozy Chrysler, Dodge a Lancia." },
  { year: "2008", text: "Naše společnost posouvá služby i autoservis pod autorizaci DaimlerChrysler Praha. Tato spolupráce otevřela možnosti odborné diagnostiky, programování jednotek i školení mechaniků." },
  { year: "2012", text: "Rozšíření servisu o diagnostiku a opravy automatických převodovek. V rámci přípravy vozidel pro zákazníky zajišťujeme u našich partnerů přestavby vozidel na LPG." },
  { year: "2014", text: "Přechod pod správu FCA. V tomto roce vznikl koncern FCA (Fiat Chrysler Automobiles) sloučením Fiatu a Chrysleru." },
  { year: "2016", text: "Seznamování s novým modelem Pacifica. Servisní postupy, speciální přípravky, školení, hybridní pohon a spoustu dalších osvojených dovedností pro tento konkrétní model." },
  { year: "2026", text: "Spuštění digitální platformy Chrysler - Dodge Pardubice — katalog dílů, servisní knížka a AI diagnostika v jedné aplikaci." },
];

const reviews = [
  { name: "Hans (Honza)", source: "Chrysler Club CZ", text: "Mám auto z Lukovny a jsem zatím maximálně spokojený. Auto slouží bezvadně! Nikde nic nebouchá, nerachtá, nehučí. Důležité je mít zázemí, když kupujete ameriku — to vám jiný bazar určitě nedá.", rating: 5 },
  { name: "Chylik (Jirka)", source: "Chrysler Club CZ", text: "Taky jsem měl zkušenosti se servisem v Lukovně a můžu zatím říci jen pozitivní. Jarda je nejlepší servismen! Vždy poradí, je suprověj.", rating: 5 },
  { name: "xpatx (Martin)", source: "Chrysler Club CZ", text: "S Lukovnou jsem žádný problém neměl. Co se týče rad — Jarda ochotně poradil, pomohl, nasměroval. Ohledně dílů také žádný problém. Je vidět, že ten podnik není otevřený rok ani dva, ale už pár let.", rating: 5 },
  { name: "dandyMaverick", source: "Chrysler Club CZ", text: "Jsem s Lukovnou maximálně spokojený, pánové jen tak dál!", rating: 5 },
  { name: "Soryu (Standa)", source: "Chrysler Club CZ", text: "Já si taky nemůžu stěžovat — ochotní a poradí.", rating: 5 },
  { name: "0610", source: "Chrysler Club CZ", text: "Dobré zkušenosti. I servis v Rakousku doporučují Mopar. Jinak jste vždy pomohli.", rating: 5 },
];

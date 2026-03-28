import carPacifica from "@/assets/car-pacifica.jpg";
import car300c from "@/assets/car-300c.jpg";
import carVoyager from "@/assets/car-voyager.jpg";

export type VehicleStatus = "skladem" | "na-ceste" | "rezervovano" | "prodano";

export interface Vehicle {
  id: string;
  name: string;
  year: number;
  priceWithVat: number;
  mileage: number;
  vin: string;
  fuel: string;
  image: string;
  status: VehicleStatus;
  showVat: boolean;
  carfaxEnabled: boolean;
  carfaxUrl: string;
  lpgEnabled: boolean;
  lpgDescription: string;
  videoEnabled: boolean;
  videoId: string;
  warrantyEnabled: boolean;
  engine: string;
  transmission: string;
  power: string;
  color: string;
  description: string;
}

export const mockVehicles: Vehicle[] = [
  {
    id: "1",
    name: "Chrysler Pacifica Limited",
    year: 2024,
    priceWithVat: 1890000,
    mileage: 12500,
    vin: "2C4RC1GG5PR123456",
    fuel: "Benzín",
    image: carPacifica,
    status: "skladem",
    showVat: true,
    carfaxEnabled: true,
    carfaxUrl: "https://www.carfax.com/vehicle/2C4RC1GG5PR123456",
    lpgEnabled: false,
    lpgDescription: "",
    videoEnabled: true,
    videoId: "dQw4w9WgXcQ",
    warrantyEnabled: true,
    engine: "3.6L Pentastar V6",
    transmission: "9st automatická",
    power: "287 HP",
    color: "Bílá perleťová",
    description: "Chrysler Pacifica Limited v top výbavě. Kožený interiér, panoramatická střecha, Uconnect 10.1\" s navigací, adaptivní tempomat, 360° kamera.",
  },
  {
    id: "2",
    name: "Chrysler 300C AWD",
    year: 2023,
    priceWithVat: 1450000,
    mileage: 28000,
    vin: "2C3CCARG5NH654321",
    fuel: "Benzín",
    image: car300c,
    status: "skladem",
    showVat: true,
    carfaxEnabled: true,
    carfaxUrl: "https://www.carfax.com/vehicle/2C3CCARG5NH654321",
    lpgEnabled: true,
    lpgDescription: "Italský systém BRC, nádrž 60L v kufru",
    videoEnabled: false,
    videoId: "",
    warrantyEnabled: false,
    engine: "6.4L HEMI V8",
    transmission: "8st automatická",
    power: "485 HP",
    color: "Gloss Black",
    description: "Ikonický sedan Chrysler 300C s výkonným motorem HEMI V8. Pohon všech kol, sportovní podvozek, prémiový audiosystém Harman Kardon.",
  },
  {
    id: "3",
    name: "Chrysler Grand Caravan",
    year: 2022,
    priceWithVat: 980000,
    mileage: 45000,
    vin: "2C4RDGCG3NR789012",
    fuel: "Benzín + LPG",
    image: carVoyager,
    status: "na-ceste",
    showVat: false,
    carfaxEnabled: true,
    carfaxUrl: "https://www.carfax.com/vehicle/2C4RDGCG3NR789012",
    lpgEnabled: true,
    lpgDescription: "Systém Prins VSI-2, nádrž 80L místo rezervy",
    videoEnabled: true,
    videoId: "dQw4w9WgXcQ",
    warrantyEnabled: true,
    engine: "3.6L Pentastar V6",
    transmission: "6st automatická",
    power: "283 HP",
    color: "Tmavě šedá metalíza",
    description: "Legendární rodinný van s přestavbou na LPG. Stow 'n Go sedadla, zadní klimatizace, DVD systém pro zadní cestující.",
  },
  {
    id: "4",
    name: "Chrysler Pacifica Hybrid",
    year: 2024,
    priceWithVat: 2150000,
    mileage: 5200,
    vin: "2C4RC1S78PR345678",
    fuel: "Plug-in Hybrid",
    image: carPacifica,
    status: "rezervovano",
    showVat: true,
    carfaxEnabled: false,
    carfaxUrl: "",
    lpgEnabled: false,
    lpgDescription: "",
    videoEnabled: false,
    videoId: "",
    warrantyEnabled: true,
    engine: "3.6L V6 + 2x el. motor",
    transmission: "eFlite CVT",
    power: "260 HP (kombinovaný)",
    color: "Ceramic Grey",
    description: "Plug-in hybridní Pacifica s dojezdem 50 km na elektřinu. Ideální kombínace výkonu a úspornosti pro každodenní provoz.",
  },
];

export const statusLabels: Record<VehicleStatus, string> = {
  skladem: "Skladem",
  "na-ceste": "Na cestě",
  rezervovano: "Rezervováno",
  prodano: "Prodáno",
};

export const statusStyles: Record<VehicleStatus, string> = {
  skladem: "status-skladem",
  "na-ceste": "status-na-ceste",
  rezervovano: "status-rezervovano",
  prodano: "status-prodano",
};

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("cs-CZ").format(price) + " Kč";
}

export function priceWithoutVat(price: number): number {
  return Math.round(price / 1.21);
}

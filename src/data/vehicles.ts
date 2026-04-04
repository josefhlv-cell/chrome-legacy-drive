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

// When show_vat is true, price_with_vat actually stores price WITHOUT VAT
export function priceWithVatFromNet(netPrice: number): number {
  return Math.round(netPrice * 1.21);
}

export function vatAmount(netPrice: number): number {
  return priceWithVatFromNet(netPrice) - netPrice;
}

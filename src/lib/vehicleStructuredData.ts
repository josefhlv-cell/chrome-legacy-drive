import { useEffect } from "react";

/**
 * Minimal shape needed to build the structured data — matches the fields
 * already used on VehicleDetail (see src/pages/VehicleDetail.tsx).
 */
interface VehicleForSchema {
  id: string;
  name: string;
  year?: number | null;
  price_with_vat?: number | null;
  mileage?: number | null;
  fuel?: string | null;
  transmission?: string | null;
  color?: string | null;
  vin?: string | null;
  description?: string | null;
  status?: string | null;
}

const SCRIPT_ID = "vehicle-jsonld";

const AVAILABILITY_MAP: Record<string, string> = {
  skladem: "https://schema.org/InStock",
  "na-ceste": "https://schema.org/PreOrder",
  rezervovano: "https://schema.org/Reserved",
  prodano: "https://schema.org/SoldOut",
};

// Dealer sells these makes — used only to split "Jeep Grand Cherokee" into
// brand "Jeep" + model "Grand Cherokee" for the structured data. Falls back
// to no split if the name doesn't start with a known make.
const KNOWN_MAKES = ["Chrysler", "Dodge", "Jeep", "RAM", "Fiat", "Chevrolet"];

function splitBrandModel(name: string): { brand?: string; model: string } {
  const trimmed = name.trim();
  const make = KNOWN_MAKES.find((m) => trimmed.toLowerCase().startsWith(m.toLowerCase()));
  if (!make) return { model: trimmed };
  return { brand: make, model: trimmed.slice(make.length).trim() || trimmed };
}

/**
 * Injects (and cleans up) a schema.org/Vehicle JSON-LD <script> tag in
 * <head> for the currently viewed vehicle. Improves how Google can display
 * the listing in search results (price, availability, image) — no visible
 * change on the page itself, purely for search engines.
 *
 * Usage: call once in VehicleDetail with the loaded vehicle + gallery images.
 */
export function useVehicleStructuredData(
  vehicle: VehicleForSchema | null | undefined,
  imageUrls: string[]
) {
  useEffect(() => {
    // Remove any previous tag first (e.g. when navigating between vehicles).
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) existing.remove();

    if (!vehicle) return;

    const { brand, model } = splitBrandModel(vehicle.name || "");
    const canonicalUrl = `${window.location.origin}/vozidla/${vehicle.id}`;
    const availability =
      (vehicle.status && AVAILABILITY_MAP[vehicle.status]) || "https://schema.org/InStock";

    const data: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Vehicle",
      name: vehicle.name,
      model,
      url: canonicalUrl,
    };

    if (brand) data.brand = { "@type": "Brand", name: brand };
    if (vehicle.year) data.vehicleModelDate = String(vehicle.year);
    if (vehicle.mileage != null) {
      data.mileageFromOdometer = {
        "@type": "QuantitativeValue",
        value: vehicle.mileage,
        unitCode: "KMT", // km, per UN/CEFACT code list used by schema.org examples
      };
    }
    if (vehicle.fuel) data.fuelType = vehicle.fuel;
    if (vehicle.transmission) data.vehicleTransmission = vehicle.transmission;
    if (vehicle.color) data.color = vehicle.color;
    if (vehicle.vin) data.vehicleIdentificationNumber = vehicle.vin;
    if (vehicle.description) data.description = vehicle.description;
    if (imageUrls.length > 0) data.image = imageUrls;

    if (vehicle.price_with_vat != null) {
      data.offers = {
        "@type": "Offer",
        priceCurrency: "CZK",
        price: vehicle.price_with_vat,
        availability,
        itemCondition: "https://schema.org/UsedCondition",
        url: canonicalUrl,
      };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [vehicle, imageUrls]);
}

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Fuel,
  Gauge,
  Cog,
  Palette,
  Shield,
  Leaf,
  ExternalLink,
  Play,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  Info,
  Scale,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VehicleGallery from "@/components/VehicleGallery";
import {
  formatPrice,
  priceWithVatFromNet,
  vatAmount,
  statusLabels,
  statusStyles,
} from "@/data/vehicles";
import { useVehicle } from "@/hooks/useVehicles";
import { useVehicleImages } from "@/hooks/useVehicleImages";
import { dedupeImageUrls } from "@/lib/vehicleImageSelection";
import { useVehicleStructuredData } from "@/lib/vehicleStructuredData";
import { useCompare } from "@/contexts/CompareContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

const VehicleDetail = () => {
  const { id } = useParams();

  const { data: vehicle, isLoading, error } = useVehicle(id);

  const {
    data: vehicleImages,
    isLoading: galleryLoading,
  } = useVehicleImages(vehicle?.id);

  const [showTimeout, setShowTimeout] = useState(false);
  const [preferredGalleryIndex, setPreferredGalleryIndex] =
    useState<number | null>(null);
  const [vinCopied, setVinCopied] = useState(false);
  const [showExtra, setShowExtra] = useState(false);

  const compareEnabled = useFeatureFlag(
    "feature_vehicle_compare_enabled"
  );

  const {
    isSelected,
    add: addToCompare,
    remove: removeFromCompare,
  } = useCompare();

  const compareSelected = id ? isSelected(id) : false;

  const handleCopyVin = async (vin: string) => {
    try {
      await navigator.clipboard.writeText(vin);

      setVinCopied(true);

      toast({
        title: "Zkopírováno!",
        description: `VIN ${vin} byl zkopírován do schránky.`,
      });

      setTimeout(() => setVinCopied(false), 2000);
    } catch {
      toast({
        title: "Chyba",
        description: "Nepodařilo se zkopírovat VIN.",
        variant: "destructive",
      });
    }
  };

  const fullTransmission = (t: string) => {
    if (!t) return "—";

    const lower = t.toLowerCase();

    if (lower.startsWith("auto")) return "Automatická";
    if (lower.startsWith("man")) return "Manuální";

    return t;
  };

  /*
   * GALLERY IMAGES
   *
   * Images from vehicle_images are already stored as public Supabase URLs.
   * We therefore use img.image_url directly.
   *
   * We intentionally do NOT use getPublicVehicleImageUrl() here.
   */
  const galleryUrls = useMemo(() => {
    // Legacy server URLs are no longer usable.
    const isUsable = (
      url: string | null | undefined
    ): url is string =>
      !!url && !url.includes("chrysler-pardubice.cz");

    // Prefer images from vehicle_images.
    // useVehicleImages already sorts main image first.
    if (vehicleImages && vehicleImages.length > 0) {
      const fromGallery = dedupeImageUrls(
        vehicleImages
          .map((img) => img.image_url)
          .filter(isUsable)
      );

      if (fromGallery.length > 0) {
        return fromGallery;
      }
    }

    // Fallback to vehicles.image_url.
    if (isUsable(vehicle?.image_url)) {
      return [vehicle.image_url];
    }

    return [];
  }, [vehicleImages, vehicle]);

  // Inject schema.org/Vehicle JSON-LD into <head>.
  useVehicleStructuredData(vehicle, galleryUrls);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowTimeout(true);
      }, 3000);

      return () => clearTimeout(timer);
    }

    setShowTimeout(false);
  }, [isLoading]);

  useEffect(() => {
    // Gallery is already sorted with main image first.
    setPreferredGalleryIndex(0);
  }, [galleryUrls]);

  if (error) {
    console.error("Supabase Error:", error);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="pt-24 container mx-auto px-4 text-center py-20">
          <p className="text-muted-foreground">
            Načítání vozidla...
          </p>

          {showTimeout && (
            <div className="mt-6 space-y-3">
              <div className="inline-flex items-center gap-2 text-sm text-primary">
                <AlertTriangle className="w-4 h-4" />
                Načítání trvá déle než obvykle
              </div>

              <p className="text-xs text-muted-foreground">
                Stav připojení:{" "}
                {navigator.onLine ? "Online" : "Offline"}
              </p>

              <div>
                <Link
                  to="/vozidla"
                  className="text-primary hover:underline text-sm"
                >
                  ← Zpět na nabídku
                </Link>
              </div>
            </div>
          )}
        </div>

        <Footer />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="pt-24 container mx-auto px-4 text-center py-20">
          <p className="text-muted-foreground">
            Vůz nebyl nalezen.
          </p>

          <Link
            to="/vozidla"
            className="text-primary hover:underline mt-4 inline-block"
          >
            ← Zpět na nabídku
          </Link>
        </div>

        <Footer />
      </div>
    );
  }

  const status = (
    vehicle.status in statusLabels
      ? vehicle.status
      : "skladem"
  ) as keyof typeof statusLabels;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 pb-16">
        <div className="w-full max-w-[1920px] mx-auto px-4 md:px-12">

          <Link
            to="/vozidla"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět na nabídku
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* LEFT SIDE - GALLERY */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative"
            >
              {galleryLoading ||
              preferredGalleryIndex === null ? (
                <div className="w-full rounded-lg bg-secondary animate-pulse aspect-[3/2] max-h-[70vh]" />
              ) : (
                <div className="relative">

                  <VehicleGallery
                    images={galleryUrls}
                    vehicleName={vehicle.name}
                    initialIndex={preferredGalleryIndex}
                    inventoryNumber={
                      (vehicle as any).inventory_number
                    }
                  />

                  <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <span
                      className={`${statusStyles[status]} text-xs font-semibold px-3 py-1.5 rounded-full`}
                    >
                      {statusLabels[status]}
                    </span>
                  </div>

                  {vehicle.warranty_enabled && (
                    <div className="absolute top-4 right-4 z-10 pointer-events-none bg-gold text-gold-foreground text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      Záruka
                    </div>
                  )}

                </div>
              )}
            </motion.div>

            {/* RIGHT SIDE - VEHICLE INFO */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-wide normal-case">
                {vehicle.name}
              </h1>

              {/* PRICE */}
              <div className="mt-6">
                <p className="text-4xl font-black text-primary">
                  {formatPrice(vehicle.price_with_vat)}

                  {vehicle.show_vat && (
                    <span className="text-base font-semibold text-muted-foreground ml-2">
                      Bez DPH
                    </span>
                  )}
                </p>

                {vehicle.show_vat && (
                  <div className="mt-1">
                    <p className="text-sm text-muted-foreground">
                      Cena s DPH:{" "}
                      {formatPrice(
                        priceWithVatFromNet(
                          vehicle.price_with_vat
                        )
                      )}
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      DPH 21% –{" "}
                      {formatPrice(
                        vatAmount(vehicle.price_with_vat)
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* BASIC INFO */}
              <div className="mt-6 glass-card p-0 overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-border">

                  <div className="p-4 bg-primary/5 flex flex-col justify-between gap-3">

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-primary" />
                        Tachometr
                      </p>

                      <p className="text-sm font-semibold text-foreground mt-1">
                        {vehicle.mileage.toLocaleString(
                          "cs-CZ"
                        )}{" "}
                        km
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Cog className="w-3.5 h-3.5 text-primary" />
                        Převodovka
                      </p>

                      <p className="text-sm font-semibold text-foreground mt-1">
                        {fullTransmission(
                          vehicle.transmission
                        )}
                      </p>
                    </div>

                  </div>

                  <div className="p-4 flex flex-col justify-between gap-3">

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-primary" />
                        Palivo
                      </p>

                      <p className="text-sm font-semibold text-foreground mt-1">
                        {vehicle.fuel}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-primary" />
                        Barva
                      </p>

                      <p className="text-sm font-semibold text-foreground mt-1">
                        {vehicle.color}
                      </p>
                    </div>

                  </div>

                </div>
              </div>

              {/* VIN / ENGINE */}
              <div className="mt-4 glass-card p-0 overflow-hidden border-primary/30">
                <div className="grid grid-cols-2 divide-x divide-border">

                  <div className="p-4 bg-primary/5 flex flex-col justify-between gap-3">

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        VIN
                      </p>

                      {vehicle.vin ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyVin(vehicle.vin)
                          }
                          className="mt-1 group inline-flex items-center gap-1.5 text-sm font-bold text-foreground hover:text-primary transition-colors break-all text-left"
                          title="Kliknutím zkopírovat VIN"
                        >
                          <span className="tracking-wider">
                            {vehicle.vin}
                          </span>

                          {vinCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 shrink-0" />
                          )}
                        </button>
                      ) : (
                        <p className="text-sm font-semibold text-muted-foreground mt-1">
                          —
                        </p>
                      )}
                    </div>

                    {(vehicle as any).inventory_number && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Evidenční číslo
                        </p>

                        <p className="text-lg font-black text-primary mt-1 tracking-wider">
                          {(vehicle as any).inventory_number}
                        </p>
                      </div>
                    )}

                  </div>

                  <div className="p-4 flex flex-col justify-between gap-3">

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Motor
                      </p>

                      <p className="text-sm font-semibold text-foreground mt-1">
                        {vehicle.engine || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Výkon
                      </p>

                      <p className="text-sm font-semibold text-foreground mt-1">
                        {vehicle.power || "—"}
                      </p>
                    </div>

                  </div>

                </div>
              </div>

              {/* DESCRIPTION */}
              {vehicle.description && (
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {vehicle.description}
                </p>
              )}

              {/* LPG */}
              {vehicle.lpg_enabled && (
                <div className="mt-4 glass-card p-4 border-emerald-500/30 flex items-start gap-3">
                  <Leaf className="w-5 h-5 text-emerald-400 mt-0.5" />

                  <div>
                    <p className="text-sm font-semibold text-emerald-400">
                      LPG Systém
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {vehicle.lpg_description}
                    </p>
                  </div>
                </div>
              )}

              {/* CARFAX */}
              {vehicle.carfax_enabled &&
                vehicle.carfax_url && (
                  <a
                    href={vehicle.carfax_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 glass-card p-4 flex items-center gap-3 hover:border-primary/50 transition-colors block"
                  >
                    <ExternalLink className="w-5 h-5 text-primary" />

                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Prověřit historii (Carfax)
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Kompletní zpráva o historii vozu
                      </p>
                    </div>
                  </a>
                )}

              {/* EXTRA INFORMATION */}
              {(() => {
                const v: any = vehicle;

                const pohonMap: Record<string, string> = {
                  FWD: "Přední (FWD)",
                  RWD: "Zadní (RWD)",
                  AWD: "4×4 (AWD)",
                };

                const klimaMap: Record<string, string> = {
                  manual: "Manuální",
                  auto: "Automatická",
                  dual: "Dvouzónová",
                  tri: "Tříznová",
                  none: "Žádná",
                };

                const rows: {
                  label: string;
                  value: string;
                }[] = [
                  {
                    label: "Karoserie",
                    value: v.tipcars_karoserie_popis || "",
                  },
                  {
                    label: "Počet míst",
                    value: v.tipcars_pocet_mist
                      ? String(v.tipcars_pocet_mist)
                      : "",
                  },
                  {
                    label: "Počet dveří",
                    value: v.tipcars_pocet_dveri
                      ? String(v.tipcars_pocet_dveri)
                      : "",
                  },
                  {
                    label: "Pohon",
                    value:
                      pohonMap[v.tipcars_pohon] || "",
                  },
                  {
                    label: "Převodovka (st.)",
                    value: v.tipcars_prevodovka_pocet
                      ? String(v.tipcars_prevodovka_pocet)
                      : "",
                  },
                  {
                    label: "Klimatizace",
                    value:
                      klimaMap[v.tipcars_klimatizace] ||
                      "",
                  },
                  {
                    label: "Emisní norma",
                    value: v.tipcars_emisni_norma || "",
                  },
                  {
                    label: "Počet airbagů",
                    value: v.tipcars_airbagy
                      ? String(v.tipcars_airbagy)
                      : "",
                  },
                  {
                    label: "STK do",
                    value: v.tipcars_stk_do || "",
                  },
                  {
                    label: "1. majitel",
                    value: v.tipcars_prvni_majitel
                      ? "Ano"
                      : "Ne",
                  },
                  {
                    label: "Servisní knížka",
                    value: v.tipcars_servisni_knizka
                      ? "Ano"
                      : "Ne",
                  },
                  {
                    label: "Garantovaný nájezd",
                    value: v.tipcars_garantovany_najezd
                      ? "Ano"
                      : "Ne",
                  },
                ].filter(
                  (r) => r.value && r.value !== ""
                );

                if (rows.length === 0) return null;

                return (
                  <div className="mt-6">

                    <button
                      type="button"
                      onClick={() =>
                        setShowExtra((s) => !s)
                      }
                      className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-md border border-border/60 bg-secondary/40 hover:bg-secondary/60 text-sm font-medium text-foreground/90 transition-colors"
                      aria-expanded={showExtra}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Info className="w-4 h-4 text-muted-foreground" />
                        Doplňující informace
                      </span>

                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          showExtra ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {showExtra && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">

                        {rows.map((r) => (
                          <div
                            key={r.label}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-secondary/30 border border-border/40 text-sm"
                          >
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                              {r.label}
                            </span>

                            <span className="font-medium text-foreground text-right truncate">
                              {r.value}
                            </span>
                          </div>
                        ))}

                      </div>
                    )}

                  </div>
                );
              })()}

              {/* ACTION BUTTONS */}
              <div className="mt-6 flex flex-wrap gap-4">

                <Link
                  to="/kontakt"
                  className="chrome-button inline-block text-center flex-1"
                >
                  Mám zájem o tento vůz
                </Link>

                {compareEnabled && (
                  <button
                    onClick={() =>
                      compareSelected
                        ? removeFromCompare(vehicle.id)
                        : addToCompare(vehicle.id)
                    }
                    className="outline-button inline-flex items-center justify-center gap-2 flex-1"
                  >
                    <Scale className="w-4 h-4" />

                    {compareSelected
                      ? "Odebrat z porovnání"
                      : "Porovnat vozy"}
                  </button>
                )}

              </div>
            </motion.div>
          </div>

          {/* VIDEO */}
          {vehicle.video_enabled &&
            vehicle.video_id && (
              <div className="mt-12">

                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-primary" />
                  Video prohlídka
                </h2>

                <div className="aspect-video rounded-lg overflow-hidden glass-card">

                  <iframe
                    src={`https://www.youtube.com/embed/${vehicle.video_id}`}
                    title="Video prohlídka"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />

                </div>
              </div>
            )}

        </div>
      </div>

      <Footer />
    </div>
  );
};

export default VehicleDetail;

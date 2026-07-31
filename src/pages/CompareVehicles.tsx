import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, X, ExternalLink } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useVehicles } from "@/hooks/useVehicles";
import { useCompare } from "@/contexts/CompareContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSiteContacts } from "@/hooks/useAdminContent";
import { getVehicleCardImage, VEHICLE_IMAGE_PLACEHOLDER } from "@/lib/vehicleImageSelection";
import { formatPrice, priceWithVatFromNet, statusLabels, statusStyles } from "@/data/vehicles";
import type { DbVehicle } from "@/hooks/useVehicles";

const CompareVehicles = () => {
  const { isLoading: flagsLoading } = useSiteContacts();
  const enabled = useFeatureFlag("feature_vehicle_compare_enabled");
  const { ids, remove, clear } = useCompare();
  const { data, isLoading } = useVehicles(false);

  const vehicles = useMemo(() => {
    const byId = new Map((data ?? []).map((v) => [v.id, v]));
    return ids.map((id) => byId.get(id)).filter((v): v is DbVehicle => Boolean(v));
  }, [data, ids]);

  // Direct-link protection: the whole page is unavailable when the feature is off.
  if (!flagsLoading && !enabled) return <Navigate to="/vozidla" replace />;

  const yesNo = (v: boolean) => (v ? "Ano" : "Ne");

  const rows: Array<{ label: string; render: (v: DbVehicle) => React.ReactNode }> = [
    {
      label: "Cena",
      render: (v) => (
        <div>
          <span className="font-bold text-primary">{formatPrice(v.price_with_vat)}</span>
          {v.show_vat && <span className="text-[11px] text-muted-foreground ml-1">Bez DPH</span>}
          {v.show_vat && (
            <div className="text-[11px] text-muted-foreground">S DPH: {formatPrice(priceWithVatFromNet(v.price_with_vat))}</div>
          )}
        </div>
      ),
    },
    { label: "Rok výroby", render: (v) => v.year || "—" },
    { label: "Nájezd", render: (v) => `${(v.mileage ?? 0).toLocaleString("cs-CZ")} km` },
    { label: "Palivo", render: (v) => v.fuel || "—" },
    { label: "Převodovka", render: (v) => (v as DbVehicle).transmission || "—" },
    { label: "Výkon", render: (v) => (v as DbVehicle).power || "—" },
    { label: "Motor", render: (v) => (v as DbVehicle).engine || "—" },
    { label: "Barva", render: (v) => (v as DbVehicle).color || "—" },
    {
      label: "Stav",
      render: (v) => (
        <span className={`${statusStyles[v.status as keyof typeof statusStyles]} text-[11px] font-semibold px-2 py-1 rounded-full`}>
          {statusLabels[v.status as keyof typeof statusLabels]}
        </span>
      ),
    },
    { label: "Záruka", render: (v) => yesNo(Boolean(v.warranty_enabled)) },
    { label: "LPG", render: (v) => yesNo(Boolean(v.lpg_enabled)) },
    {
      label: "Carfax",
      render: (v) =>
        v.carfax_enabled && v.carfax_url ? (
          <a href={v.carfax_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs">
            Zobrazit <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="mx-auto w-full max-w-[1920px] px-4 md:px-12">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Link to="/vozidla" className="outline-button !px-3 !py-2 text-xs inline-flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Zpět na vozy
            </Link>
            <h1 className="section-heading">Porovnání vozů</h1>
            {vehicles.length > 0 && (
              <button onClick={clear} className="ml-auto outline-button !px-3 !py-2 text-xs">
                Vymazat výběr
              </button>
            )}
          </div>

          {isLoading ? (
            <p className="text-muted-foreground py-20 text-center">Načítání…</p>
          ) : vehicles.length === 0 ? (
            <div className="glass-card p-10 text-center space-y-4">
              <p className="text-muted-foreground">Zatím nemáte vybrané žádné vozy k porovnání.</p>
              <Link to="/vozidla" className="chrome-button inline-block !px-5 !py-2 text-xs">
                Vybrat vozy
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <table className="w-full min-w-[640px] border-collapse text-sm font-montserrat">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background text-left align-bottom p-3 w-[120px] md:w-[180px]" />
                    {vehicles.map((v) => (
                      <th key={v.id} className="p-3 align-bottom text-left min-w-[200px]">
                        <div className="glass-card overflow-hidden">
                          <div className="relative aspect-[4/3] bg-secondary">
                            <img
                              src={getVehicleCardImage(v) || VEHICLE_IMAGE_PLACEHOLDER}
                              alt={v.name}
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = VEHICLE_IMAGE_PLACEHOLDER;
                              }}
                            />
                            <button
                              onClick={() => remove(v.id)}
                              aria-label={`Odebrat ${v.name}`}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/85 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <Link to={`/vozidla/${v.id}`} className="block p-3 font-serif font-bold text-foreground hover:text-primary line-clamp-2">
                            {v.name}
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "bg-secondary/20" : ""}>
                      <th
                        scope="row"
                        className={`sticky left-0 z-10 text-left p-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold ${
                          i % 2 === 0 ? "bg-secondary/60" : "bg-background"
                        }`}
                      >
                        {row.label}
                      </th>
                      {vehicles.map((v) => (
                        <td key={v.id} className="p-3 align-top text-foreground">
                          {row.render(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CompareVehicles;

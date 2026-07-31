import { Link, useLocation } from "react-router-dom";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

/**
 * Sticky bar shown from 2 selected vehicles upwards, on every public page.
 * Hidden entirely when the admin disables the compare feature.
 */
const CompareBar = () => {
  const enabled = useFeatureFlag("feature_vehicle_compare_enabled");
  const { ids, clear } = useCompare();
  const { pathname } = useLocation();

  if (!enabled || ids.length < 2 || pathname === "/porovnani-vozidel") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1920px] px-4 md:px-12 py-3 flex items-center gap-3 flex-wrap">
        <Scale className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-montserrat text-foreground">
          {ids.length} {ids.length < 5 ? "vozy" : "vozů"} k porovnání
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/porovnani-vozidel" className="chrome-button !px-4 !py-2 text-xs">
            Porovnat
          </Link>
          <button onClick={clear} className="outline-button !px-3 !py-2 text-xs inline-flex items-center gap-1">
            <X className="w-3 h-3" /> Vymazat
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompareBar;

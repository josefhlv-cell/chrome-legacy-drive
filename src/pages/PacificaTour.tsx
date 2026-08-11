import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useSiteContacts } from "@/hooks/useAdminContent";
import LoadingOverlay from "@/features/pacifica-tour/ui/LoadingOverlay";

/**
 * Route /pacifica-prohlidka — digitální 3D showroom Chrysler Pacifica.
 *
 * Celá 3D scéna je lazy-loaded, takže WebGL knihovny nezatěžují ostatní
 * stránky ani úvodní stránku. Feature flag `feature_pacifica_tour_enabled`
 * platí i pro přímý přístup na route.
 */
const PacificaShowroom = lazy(() => import("@/features/pacifica-tour/PacificaShowroom"));

const PacificaTour = () => {
  const navigate = useNavigate();
  const { isLoading } = useSiteContacts();
  const enabled = useFeatureFlag("feature_pacifica_tour_enabled");

  useEffect(() => {
    if (!isLoading && !enabled) navigate("/", { replace: true });
  }, [isLoading, enabled, navigate]);

  useEffect(() => {
    document.title = "Virtuální 3D prohlídka Chrysler Pacifica | Chrysler Pardubice";
    const desc = document.querySelector('meta[name="description"]');
    desc?.setAttribute(
      "content",
      "Interaktivní 3D showroom Chrysler Pacifica — otevřete posuvné dveře, kufr, sklopte sedadla Stow ’n Go a projděte si interiér.",
    );
  }, []);

  if (isLoading || !enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#05070b]">
          <LoadingOverlay progress={12} />
        </div>
      }
    >
      <PacificaShowroom />
    </Suspense>
  );
};

export default PacificaTour;

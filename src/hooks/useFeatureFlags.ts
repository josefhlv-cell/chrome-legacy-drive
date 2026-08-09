import { useSiteContacts } from "@/hooks/useAdminContent";

export type FeatureKey =
  | "feature_watchdog_enabled"
  | "feature_live_chat_enabled"
  | "feature_vehicle_compare_enabled"
  | "feature_pacifica_tour_enabled";

/**
 * Feature switches live as rows in `site_contacts` (key/value) so the admin can
 * toggle them without a schema change. Anything other than the literal string
 * 'false' is treated as enabled — a missing row must not silently kill a feature.
 * While loading we return `false` so entry points never flash before we know.
 */
export const useFeatureFlag = (key: FeatureKey) => {
  const { data, isLoading } = useSiteContacts();
  if (isLoading || !data) return false;
  return data[key] !== "false";
};

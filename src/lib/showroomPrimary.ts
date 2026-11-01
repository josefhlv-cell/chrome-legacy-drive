/**
 * The ONLY photo of a vehicle that may receive a showroom composite:
 * is_main first, then the lowest sort_order, then id (stable tie-break).
 * Mirrored server-side in supabase/functions/_shared/showroomPipeline.ts.
 */
export type PrimaryCandidate = { id?: string; is_main?: boolean | null; sort_order?: number | null };

export function pickPrimaryImage<T extends PrimaryCandidate>(rows: T[] | null | undefined): T | null {
  const list = [...(rows ?? [])];
  if (list.length === 0) return null;
  list.sort((a, b) => {
    if (Boolean(a.is_main) !== Boolean(b.is_main)) return Number(Boolean(b.is_main)) - Number(Boolean(a.is_main));
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
  return list[0];
}

export type VisitRow = {
  session_id: string;
  visitor_id?: string | null;
  created_at: string;
  path?: string | null;
};

export function startOfDay(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Pondělí 00:00 místního času. Neděle patří ještě k předchozímu týdnu. */
export function startOfWeek(now = new Date()): Date {
  const d = startOfDay(now);
  const mondayOffset = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

export function startOfMonth(now = new Date()): Date {
  const d = startOfDay(now);
  d.setDate(1);
  return d;
}

/** Nejstarší okamžik, od kterého je potřeba načíst řádky pro dnes, týden i měsíc. */
export function visitWindowStart(now = new Date()): Date {
  return new Date(Math.min(startOfWeek(now).getTime(), startOfMonth(now).getTime()));
}

function isStaffPath(path?: string | null): boolean {
  return path === "/admin" || !!path?.startsWith("/admin/");
}

/** Jedna návštěva = jedno otevření webu. Stejná záložka se nepočítá víckrát. */
export function countRealVisits(rows: VisitRow[], since: Date): { visits: number; people: number } {
  const sessions = new Set<string>();
  const people = new Set<string>();
  const from = since.getTime();
  for (const row of rows) {
    if (isStaffPath(row.path)) continue;
    if (new Date(row.created_at).getTime() < from) continue;
    if (row.session_id) sessions.add(row.session_id);
    if (row.visitor_id) people.add(row.visitor_id);
  }
  return { visits: sessions.size, people: people.size };
}

import { describe, expect, it } from "vitest";
import { countRealVisits, startOfDay, startOfMonth, startOfWeek } from "./visitPeriods";

describe("real visit periods", () => {
  const now = new Date(2026, 10, 5, 15, 30, 0);

  it("uses local calendar day, Monday week and current month", () => {
    expect(startOfDay(now)).toEqual(new Date(2026, 10, 5, 0, 0, 0));
    expect(startOfWeek(now)).toEqual(new Date(2026, 10, 2, 0, 0, 0));
    expect(startOfWeek(new Date(2026, 10, 8, 12))).toEqual(new Date(2026, 10, 2, 0, 0, 0));
    expect(startOfMonth(now)).toEqual(new Date(2026, 10, 1, 0, 0, 0));
  });

  it("counts one visit per opening and skips the admin", () => {
    const rows = [
      { session_id: "a", visitor_id: "p1", created_at: new Date(2026, 10, 5, 10).toISOString(), path: "/" },
      { session_id: "a", visitor_id: "p1", created_at: new Date(2026, 10, 5, 10, 5).toISOString(), path: "/vozy" },
      { session_id: "b", visitor_id: "p2", created_at: new Date(2026, 10, 3, 10).toISOString(), path: "/" },
      { session_id: "c", visitor_id: "p3", created_at: new Date(2026, 9, 31, 10).toISOString(), path: "/" },
      { session_id: "staff", visitor_id: "me", created_at: new Date(2026, 10, 5, 11).toISOString(), path: "/admin" },
    ];
    expect(countRealVisits(rows, startOfDay(now))).toEqual({ visits: 1, people: 1 });
    expect(countRealVisits(rows, startOfWeek(now))).toEqual({ visits: 2, people: 2 });
    expect(countRealVisits(rows, startOfMonth(now))).toEqual({ visits: 2, people: 2 });
  });
});

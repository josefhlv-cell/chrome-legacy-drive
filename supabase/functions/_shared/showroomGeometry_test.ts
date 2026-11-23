import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CANVAS_H, CANVAS_W, CAMERA_VERSION, CLASS_PROFILES, checkPlacementGeometry, classWidthRangePx, computeCarPosition,
  computeTargetSize, contactShadowRows, detectVehicleClass, GROUND, GROUND_VERSION, LOGO_SAFE_ZONE, PLACEMENT_LIMITS,
  PLACEMENT_VERSION, placementFromProfile, silhouetteClearsLogo, type VehicleClass,
} from "./showroomTemplate.ts";

const pub = (f: string) => JSON.parse(Deno.readTextFileSync(new URL(`../../../public/assets/showroom/${f}`, import.meta.url)));
const SPEC: Record<string, [number, number]> = {
  SEDAN: [1248, 1382], WAGON: [1306, 1459], SUV: [1344, 1498], MPV: [1382, 1498], PICKUP: [1421, 1574], VAN: [1421, 1574],
};
const ok = (c: ReturnType<typeof checkPlacementGeometry>, n: string) => c.find((x) => x.check === n)!.ok;
const place = (cls: VehicleClass, srcW: number, srcH: number, scale?: number) => {
  const p = placementFromProfile(cls, scale == null ? null : { scale });
  const { w, h } = computeTargetSize(srcW, srcH, p.scale);
  const { carX, carY } = computeCarPosition(w, h, p);
  return { w, h, carX, carY, checks: checkPlacementGeometry({ canvasW: 1920, canvasH: 1082, sourceW: srcW, sourceH: srcH, targetW: w, targetH: h, carX, carY, vehicleClass: cls }) };
};

Deno.test("public JSON rules mirror the TS template", () => {
  const cam = pub("camera.json"), g = pub("ground_plane.json"), pr = pub("placement_rules.json");
  assertEquals([cam.canvas.width, cam.canvas.height, cam.version], [CANVAS_W, CANVAS_H, CAMERA_VERSION]);
  assertEquals([g.version, g.tyre_contact_line_y, g.vehicle_anchor.x, g.wall_floor_seam_y], [GROUND_VERSION, GROUND.wheelLineY, GROUND.anchorX, GROUND.wallFloorSeamY]);
  assertEquals(pr.version, PLACEMENT_VERSION);
  assertEquals(pr.global.logo_safe_zone.min_x, LOGO_SAFE_ZONE.minX);
  for (const [cls, p] of Object.entries(CLASS_PROFILES)) {
    assertEquals([pr.classes[cls].min_scale, pr.classes[cls].max_scale, pr.classes[cls].scale], [p.minScale, p.maxScale, p.scale], cls);
  }
  assert(pr.validation.mandatory.includes("class_scale") && pr.validation.mandatory.includes("canvas_exact"));
});

for (const [cls, [lo, hi]] of Object.entries(SPEC)) {
  Deno.test(`${cls} pixel range is exactly ${lo}-${hi}`, () => {
    assertEquals(classWidthRangePx(cls as VehicleClass), { min: lo, max: hi });
  });
  Deno.test(`${cls} boundary scales: min/max pass, outside is clamped, aspect kept, wheels on floor`, () => {
    for (const s of [CLASS_PROFILES[cls as VehicleClass].minScale, CLASS_PROFILES[cls as VehicleClass].maxScale, 0.3, 0.99]) {
      const r = place(cls as VehicleClass, 2600, 1000, s);
      assert(r.w >= lo && r.w <= hi, `${cls} s=${s} w=${r.w}`);
      for (const c of r.checks) assert(c.ok, `${cls} s=${s} ${c.check} ${c.detail}`);
      assertEquals(r.carY + r.h, GROUND.wheelLineY);
      assert(Math.abs(r.w / r.h - 2.6) < 0.01);
    }
  });
}

Deno.test("class_scale fails 1 px outside the range (no tolerance)", () => {
  const base = { canvasW: 1920, canvasH: 1082, sourceW: 1381, sourceH: 500, targetH: 500, carX: 200, carY: 485, vehicleClass: "MPV" as const };
  assert(!ok(checkPlacementGeometry({ ...base, targetW: 1381 }), "class_scale"));
  assert(ok(checkPlacementGeometry({ ...base, targetW: 1382, sourceW: 1382 }), "class_scale"));
  assert(!ok(checkPlacementGeometry({ ...base, targetW: 1499, sourceW: 1499 }), "class_scale"));
});

Deno.test("too-tall cutout is shrunk proportionally and then REJECTED, not passed below minScale", () => {
  const r = place("MPV", 1200, 1000); // aspect 1.2 cannot reach 1382 px without exceeding height
  assert(r.w < 1382);
  assert(Math.abs(r.w / r.h - 1.2) < 0.01, "deformed");
  assert(!ok(r.checks, "class_scale"));
});

Deno.test("canvas must be exactly 1920x1082", () => {
  const b = { sourceW: 2600, sourceH: 1000, targetW: 1498, targetH: 576, carX: 199, carY: 409, vehicleClass: "MPV" as const };
  assert(ok(checkPlacementGeometry({ ...b, canvasW: 1920, canvasH: 1082 }), "canvas_exact"));
  assert(!ok(checkPlacementGeometry({ ...b, canvasW: 1920, canvasH: 1080 }), "canvas_exact"));
  assert(!ok(checkPlacementGeometry({ ...b, canvasW: 1500, canvasH: 846 }), "canvas_exact"));
});

Deno.test("deformation is detected", () => {
  const c = checkPlacementGeometry({ canvasW: 1920, canvasH: 1082, sourceW: 2600, sourceH: 1000, targetW: 1498, targetH: 700, carX: 199, carY: 285, vehicleClass: "MPV" });
  assert(!ok(c, "aspect_preserved"));
});

Deno.test("logo: 3/4 silhouette passing under the shield is OK, a flat-top overlap is rejected", () => {
  const r = place("MPV", 2600, 1000);
  const required = LOGO_SAFE_ZONE.maxY + LOGO_SAFE_ZONE.clearancePx;
  const flat = Array.from({ length: r.w }, () => 0 as number | null);
  assert(!silhouetteClearsLogo(flat, r.carX, r.carY).ok, "flat roof under the shield must be rejected");
  const threeQuarter = flat.map((_, x) => (r.carX + x >= LOGO_SAFE_ZONE.minX ? required - r.carY : 0));
  assert(silhouetteClearsLogo(threeQuarter, r.carX, r.carY).ok);
  const oneTooHigh = threeQuarter.map((t, x) => (r.carX + x === LOGO_SAFE_ZONE.minX + 5 ? (t as number) - 1 : t));
  assert(!silhouetteClearsLogo(oneTooHigh, r.carX, r.carY).ok, "a single column 1 px into the zone fails");
});

Deno.test("contact shadow starts below the tyre, never on it", () => {
  const rows = contactShadowRows(400, 12);
  assertEquals(rows.length, 12);
  assert(rows.every((y) => y > 400));
  assertEquals(rows[0], 401);
});

Deno.test("car stays inside frame margins for every class", () => {
  for (const cls of Object.keys(CLASS_PROFILES) as VehicleClass[]) {
    const r = place(cls, 3000, 1000);
    assert(r.carX >= PLACEMENT_LIMITS.minFrameMarginPx && r.carX + r.w <= CANVAS_W - PLACEMENT_LIMITS.minFrameMarginPx, cls);
  }
});

Deno.test("class precedence: explicit > known model > marketplace code > description > name", () => {
  assertEquals(detectVehicleClass({ name: "Chrysler Town & Country", tipcars_karoserie_kod: "b", tipcars_karoserie_popis: "sedan" }), "MPV");
  assertEquals(detectVehicleClass({ name: "Chrysler Town & Country", vehicle_class: "VAN" }), "VAN");
  assertEquals(detectVehicleClass({ name: "Chrysler Town & Country", vehicle_class: "nonsense" }), "MPV");
  for (const n of ["RAM 1500", "Dodge RAM 2500", "RAM 3500 Laramie"]) assertEquals(detectVehicleClass({ name: n, tipcars_karoserie_kod: "b" }), "PICKUP");
  assertEquals(detectVehicleClass({ name: "RAM ProMaster 2500", tipcars_karoserie_kod: "d" }), "VAN");
  assertEquals(detectVehicleClass({ name: "Dodge Durango", tipcars_karoserie_kod: "b" }), "SUV");
  assertEquals(detectVehicleClass({ name: "Dodge Journey" }), "SUV");
  assertEquals(detectVehicleClass({ name: "Neznámé auto", tipcars_karoserie_kod: "B" }), "WAGON");
  assertEquals(detectVehicleClass({ name: "Neznámé auto", tipcars_karoserie_popis: "SUV" }), "SUV");
});

Deno.test("Town & Country MPV composite: 1382-1498 px, aspect kept, all geometry checks pass", () => {
  const cls = detectVehicleClass({ name: "Chrysler Town Country 3,6 DVD StownGo kůže 2013", tipcars_karoserie_kod: "b" });
  assertEquals(cls, "MPV");
  const r = place(cls, 2400, 1000, 0.64);
  assert(r.w >= 1382 && r.w <= 1498, `w=${r.w}`);
  for (const c of r.checks) assert(c.ok, `${c.check} ${c.detail}`);
});

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CANVAS_H, CANVAS_W, CLASS_PROFILES, computeTargetSize, detectVehicleClass, GROUND, placementFromProfile,
} from "./showroomTemplate.ts";

Deno.test("canvas matches the 1920×1082 master plate exactly", () => {
  assertEquals([CANVAS_W, CANVAS_H], [1920, 1082]);
});

const RANGES: Record<string, [number, number]> = {
  SEDAN: [1248, 1382], WAGON: [1306, 1459], SUV: [1344, 1498],
  MPV: [1382, 1498], PICKUP: [1421, 1574], VAN: [1421, 1574],
};

for (const [cls, [lo, hi]] of Object.entries(RANGES)) {
  Deno.test(`${cls} default width lies in ${lo}–${hi} px and keeps aspect`, () => {
    const p = placementFromProfile(cls as any);
    // typical 3/4 cutout aspects: 2.6 sedan … 1.9 tall pickup
    for (const aspect of [1.9, 2.2, 2.6]) {
      const { w, h } = computeTargetSize(Math.round(1000 * aspect), 1000, p.scale);
      assert(w >= lo - 1 && w <= hi + 1, `${cls} aspect ${aspect}: w=${w}`);
      assert(Math.abs(w / h - aspect) < 0.01, `deformed ${w}x${h}`);
      assert(GROUND.wheelLineY - h >= GROUND.ceilingBottomY, "car rises into ceiling");
    }
    assert(CLASS_PROFILES[cls as keyof typeof CLASS_PROFILES].minScale * 1920 >= lo - 1);
    assert(CLASS_PROFILES[cls as keyof typeof CLASS_PROFILES].maxScale * 1920 <= hi + 1);
  });
}

Deno.test("very tall cutout shrinks proportionally instead of stretching", () => {
  const { w, h } = computeTargetSize(1200, 1000, 0.78);
  assert(Math.abs(w / h - 1.2) < 0.01);
  assert(h <= GROUND.wheelLineY - GROUND.ceilingBottomY);
});

Deno.test("Town Country is MPV, not sedan", () => {
  assertEquals(detectVehicleClass({ name: "Chrysler Town Country 3,6 DVD StownGo kůže 2013" }), "MPV");
  assertEquals(detectVehicleClass({ name: "Chrysler Town & Country" }), "MPV");
});

Deno.test("known model family overrides conflicting generic marketplace body code", () => {
  assertEquals(detectVehicleClass({ name: "Dodge RAM 1500", tipcars_karoserie_kod: "d" }), "PICKUP");
  assertEquals(detectVehicleClass({ name: "Chrysler Town Country 3,6 DVD StownGo kůže 2013", tipcars_karoserie_kod: "b" }), "MPV");
  assertEquals(detectVehicleClass({ name: "Chrysler Pacifica", tipcars_karoserie_kod: "b" }), "MPV");
  assertEquals(detectVehicleClass({ name: "Something", tipcars_karoserie_popis: "MPV" }), "MPV");
});

Deno.test("name fallbacks per category", () => {
  assertEquals(detectVehicleClass({ name: "Dodge RAM 1500 Bighorn" }), "PICKUP");
  assertEquals(detectVehicleClass({ name: "Dodge Durango GT" }), "SUV");
  assertEquals(detectVehicleClass({ name: "Chrysler 300C Touring kombi" }), "WAGON");
  assertEquals(detectVehicleClass({ name: "Chrysler 300C" }), "SEDAN");
  assertEquals(detectVehicleClass({ name: "RAM ProMaster dodávka" }), "VAN");
});

Deno.test("MPV defaults to full showroom scale and stale placements cannot shrink it", () => {
  assertEquals(placementFromProfile("MPV").scale, 0.78);
  assertEquals(computeTargetSize(2200, 1000, placementFromProfile("MPV").scale).w, 1498);
  assertEquals(placementFromProfile("MPV", { scale: 0.64 }).scale, 0.72);
  assertEquals(placementFromProfile("PICKUP", { scale: 0.95 }).scale, 0.82);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { integerPlacement, placeVehicle, SHOWROOM_GEOMETRY } from "./geometry.mjs";

test("ceilings match composeSmartCaptureShowroom", () => {
  const source = readFileSync(new URL("../../src/lib/smartCapture/showroomReplacement.ts", import.meta.url), "utf8");
  assert.match(source, /width \* 0\.72/);
  assert.match(source, /height \* 0\.53/);
  assert.match(source, /height \* 0\.895 - drawH/);
  assert.match(source, /blur\(18px\)/);
  assert.match(source, /height \* 0\.897/);
  assert.match(source, /drawW \* 0\.34/);
  assert.equal(SHOWROOM_GEOMETRY.maxWidthRatio, 0.72);
  assert.equal(SHOWROOM_GEOMETRY.maxHeightRatio, 0.53);
  assert.equal(SHOWROOM_GEOMETRY.wheelLineRatio, 0.895);
});

test("wide crop stops at 72% of canvas width and the wheel line", () => {
  const placed = placeVehicle(1500, 846, 2000, 400);
  assert.ok(Math.abs(placed.widthRatio - 0.72) < 1e-9);
  assert.ok(placed.heightRatio < 0.53);
  assert.ok(Math.abs(placed.bottomRatio - 0.895) < 1e-9);
  assert.ok(placed.y > 0);
});

test("tall crop stops at 53% of canvas height", () => {
  const placed = placeVehicle(1500, 846, 400, 2000);
  assert.ok(Math.abs(placed.heightRatio - 0.53) < 1e-9);
  assert.ok(placed.widthRatio < 0.72);
  assert.ok(Math.abs(placed.bottomRatio - 0.895) < 1e-9);
});

test("title-photo proportions stay inside the ceilings after rounding", () => {
  const placed = integerPlacement(1500, 846, 1482, 723);
  assert.ok(placed.widthRatio <= 0.72 + 1e-9);
  assert.ok(placed.heightRatio <= 0.53 + 1e-9);
  assert.ok(Math.abs((placed.y + placed.drawH) - placed.wheelLine) <= 1);
  assert.equal(placed.shadow.blurPx, 18);
  assert.ok(placed.shadow.rx > 0 && placed.shadow.ry >= 7);
});

test("empty cutout is rejected", () => {
  assert.throws(() => placeVehicle(1500, 846, 0, 10), /Prázdný výřez/);
});

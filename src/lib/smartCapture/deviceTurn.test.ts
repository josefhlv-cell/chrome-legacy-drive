import { describe, expect, it } from "vitest";
import { quarterTurnFromTilt } from "./deviceTurn";

describe("quarterTurnFromTilt", () => {
  it("keeps upright portrait photos", () => expect(quarterTurnFromTilt(90, 0, 0)).toBe(0));
  it("turns counter-clockwise when the phone top points left", () => expect(quarterTurnFromTilt(0, -85, 0)).toBe(-1));
  it("turns clockwise when the phone top points right", () => expect(quarterTurnFromTilt(0, 85, 0)).toBe(1));
  it("does nothing when the page already rotated to landscape", () => expect(quarterTurnFromTilt(0, -85, 90)).toBe(0));
  it("does nothing without sensor data", () => expect(quarterTurnFromTilt(null, null, 0)).toBe(0));
});

import { fittedSize } from "./deviceTurn";
describe("fittedSize", () => {
  it("fits a sideways 4032×3024 phone photo to the 3200×2400 listing size", () =>
    expect(fittedSize(3024, 4032, 1)).toMatchObject({ width: 3200, height: 2400 }));
  it("fits an upright 4032×3024 photo to 3200×2400", () =>
    expect(fittedSize(4032, 3024, 0)).toMatchObject({ width: 3200, height: 2400 }));
  it("never enlarges smaller photos", () =>
    expect(fittedSize(1920, 1440, 0)).toMatchObject({ width: 1920, height: 1440, scale: 1 }));
});

import { turnForStill } from "./deviceTurn";
describe("turnForStill", () => {
  it("rotates a portrait frame from a sideways phone even when UI rotated", () => expect(turnForStill(1, 2400, 3200)).toBe(1));
  it("keeps an already landscape frame", () => expect(turnForStill(-1, 3200, 2400)).toBe(0));
  it("keeps portrait frame from upright phone", () => expect(turnForStill(0, 2400, 3200)).toBe(0));
});

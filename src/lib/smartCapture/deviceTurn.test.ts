import { describe, expect, it } from "vitest";
import { quarterTurnFromTilt } from "./deviceTurn";

describe("quarterTurnFromTilt", () => {
  it("keeps upright portrait photos", () => expect(quarterTurnFromTilt(90, 0, 0)).toBe(0));
  it("turns counter-clockwise when the phone top points left", () => expect(quarterTurnFromTilt(0, -85, 0)).toBe(-1));
  it("turns clockwise when the phone top points right", () => expect(quarterTurnFromTilt(0, 85, 0)).toBe(1));
  it("does nothing when the page already rotated to landscape", () => expect(quarterTurnFromTilt(0, -85, 90)).toBe(0));
  it("does nothing without sensor data", () => expect(quarterTurnFromTilt(null, null, 0)).toBe(0));
});

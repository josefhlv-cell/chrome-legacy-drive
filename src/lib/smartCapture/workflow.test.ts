import { describe, expect, it } from "vitest";
import { advanceProgress, isMainShot, qualityTip, readProgress } from "./workflow";
import { SHOT_SEQUENCE } from "./types";

describe("guided capture rules", () => {
  it("keeps exactly 20 steps", () => expect(SHOT_SEQUENCE).toHaveLength(20));
  it("records skipping and immediately advances for every step", () => {
    for (let i = 0; i < 20; i++) {
      const next = advanceProgress({ skipped_steps: [], next_step: i }, i, true);
      expect(next.next_step).toBe(i + 1);
      expect(next.skipped_steps).toEqual([SHOT_SEQUENCE[i].type]);
    }
  });
  it("accepting a previously skipped photograph removes its missing marker", () => {
    expect(advanceProgress({ skipped_steps: ["prava-predni"], next_step: 1 }, 0, false).skipped_steps).toEqual([]);
  });
  it("uses only current right-front type for the main photograph", () => {
    expect(isMainShot("prava-predni")).toBe(true);
    expect(isMainShot("predni-pravy-roh")).toBe(false);
    expect(isMainShot("leva-predni")).toBe(false);
  });
  it("low AI or blur quality supplies advice but never changes accepted progress", () => {
    expect(qualityTip({ is_blurry: true }, 0)).toBeDefined();
    expect(advanceProgress({ skipped_steps: [], next_step: 0 }, 0, false)).toEqual({ skipped_steps: [], next_step: 1 });
  });
  it("restores skipped shots and last-step completion from metadata", () => {
    expect(readProgress({ skipped_steps: ["vin-za-oknem", "bad"], next_step: 20 })).toEqual({ skipped_steps: ["vin-za-oknem"], next_step: 20 });
  });
  it("supplementing an earlier skipped step preserves completed sequence progress", () => {
    expect(advanceProgress({ skipped_steps: ["leva-predni"], next_step: 20 }, 1, false)).toEqual({ skipped_steps: [], next_step: 20 });
  });
});
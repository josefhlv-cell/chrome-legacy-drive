import { describe, expect, it } from "vitest";
import { SHOWROOM_BACKGROUND_URL } from "./showroomBackground";
import { CAPTURE_BG_URL, THUMB_W, THUMB_H } from "./smartCapture/thumbnail";
import { SMART_CAPTURE_SHOWROOM_BACKGROUND } from "./smartCapture/showroomReplacement";
import { isCurrentShowroomTemplate, SHOWROOM_TEMPLATE } from "./showroomImage";

describe("single approved showroom background", () => {
  it("shares one source for both Smart Capture composers at the uploaded dimensions", () => {
    expect(CAPTURE_BG_URL).toBe(SHOWROOM_BACKGROUND_URL);
    expect(SMART_CAPTURE_SHOWROOM_BACKGROUND).toBe(SHOWROOM_BACKGROUND_URL);
    expect([THUMB_W, THUMB_H]).toEqual([1920, 1082]);
  });
  it("rejects old or unversioned generated backgrounds", () => {
    expect(isCurrentShowroomTemplate(null)).toBe(false);
    expect(isCurrentShowroomTemplate({})).toBe(false);
    expect(isCurrentShowroomTemplate({ background_version: "background-v6", camera_version: "camera-v3", placement_version: "placement-v7", lighting_version: "lighting-v3" })).toBe(false);
    expect(isCurrentShowroomTemplate({ background_version: SHOWROOM_TEMPLATE.background, camera_version: SHOWROOM_TEMPLATE.camera, placement_version: SHOWROOM_TEMPLATE.placement, lighting_version: SHOWROOM_TEMPLATE.lighting })).toBe(true);
  });
});
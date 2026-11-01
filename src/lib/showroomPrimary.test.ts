import { describe, expect, it } from "vitest";
import { pickPrimaryImage } from "./showroomPrimary";
import { getVehicleCardImage } from "./vehicleImageSelection";

describe("showroom primary photo", () => {
  it("prefers is_main over a lower sort_order", () => {
    expect(pickPrimaryImage([{ id: "a", sort_order: 0 }, { id: "b", is_main: true, sort_order: 5 }])?.id).toBe("b");
  });
  it("falls back to lowest sort_order when no photo is main", () => {
    expect(pickPrimaryImage([{ id: "a", sort_order: 3 }, { id: "b", sort_order: 1 }])?.id).toBe("b");
  });
  it("catalog card keeps the original primary photo even when a showroom composite exists", () => {
    const meta = { background_version: "background-v4", camera_version: "camera-v1", placement_version: "placement-v2", lighting_version: "lighting-v2" };
    const v = { vehicle_images: [
      { is_main: true, sort_order: 0, image_url: "orig-main.jpg", showroom_url: "show-main.jpg", showroom_applied_at: "x", showroom_metadata: meta },
      { is_main: false, sort_order: 1, image_url: "orig-2.jpg", showroom_url: "show-2.jpg", showroom_applied_at: "x", showroom_metadata: meta },
    ] };
    expect(getVehicleCardImage(v)).toBe("orig-main.jpg");
  });
  it("catalog card ignores showroom on non-primary photos", () => {
    const v = { vehicle_images: [
      { is_main: true, sort_order: 0, image_url: "orig-main.jpg" },
      { is_main: false, sort_order: 1, image_url: "orig-2.jpg", showroom_url: "show-2.jpg", showroom_applied_at: "x" },
    ] };
    expect(getVehicleCardImage(v)).toBe("orig-main.jpg");
  });
});

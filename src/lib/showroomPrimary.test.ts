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
  it("uses the showroom variant of the primary photo only when Tutorial is ON", () => {
    const meta = { background_version: "background-v7", camera_version: "camera-v3", placement_version: "placement-v7", lighting_version: "lighting-v3" };
    const v = { showroom_mode: "main", vehicle_images: [
      { is_main: true, sort_order: 0, image_url: "orig-main.jpg", showroom_url: "show-main.jpg", showroom_applied_at: "x", showroom_metadata: meta },
      { is_main: false, sort_order: 1, image_url: "orig-2.jpg", showroom_url: "show-2.jpg", showroom_applied_at: "x", showroom_metadata: meta },
    ] };
    expect(getVehicleCardImage(v)).toBe("show-main.jpg");
  });
  it("shows the original primary photo when Tutorial is OFF, even if showroom photos exist", () => {
    const v = { showroom_mode: "off", showroom_image_url: "published-showroom.jpg", vehicle_images: [
      { is_main: true, sort_order: 0, image_url: "orig-main.jpg", showroom_url: "show-main.jpg", showroom_applied_at: "x" },
      { is_main: false, sort_order: 1, image_url: "orig-2.jpg" },
    ] };
    expect(getVehicleCardImage(v)).toBe("orig-main.jpg");
  });
  it("shows the original photo when Tutorial mode is missing", () => {
    const v = { showroom_image_url: "published-showroom.jpg", vehicle_images: [
      { is_main: true, sort_order: 0, image_url: "orig-main.jpg", showroom_url: "show-main.jpg", showroom_applied_at: "x" },
    ] };
    expect(getVehicleCardImage(v)).toBe("orig-main.jpg");
  });
  it("ignores showroom on non-primary photos", () => {
    const v = { showroom_mode: "main", vehicle_images: [
      { is_main: true, sort_order: 0, image_url: "orig-main.jpg" },
      { is_main: false, sort_order: 1, image_url: "orig-2.jpg", showroom_url: "show-2.jpg", showroom_applied_at: "x" },
    ] };
    expect(getVehicleCardImage(v)).toBe("orig-main.jpg");
  });
});

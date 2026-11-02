import { describe, expect, it } from "vitest";
import { isShowRoomPath, moveShowRoomImage, readShowRoomImages, selectPublicDetailGallery } from "./showRoomGallery";

const vehicleId = "08f2db37-c79d-4150-9928-76facddb687c";
const path = `show-room/${vehicleId}/12345678-abcd-1234-abcd-123456789abc.jpg`;
const image = { id: "one", path, url: `https://example.test/storage/v1/object/public/vehicles/${path}` };

describe("separate Show Room gallery", () => {
  it("Show OFF preserves the original gallery exactly", () => {
    const original = ["original-one.jpg", "original-two.jpg"];
    expect(selectPublicDetailGallery(original, false, [image])).toBe(original);
  });
  it("Show ON selects only the ordered showroom set", () => {
    expect(selectPublicDetailGallery(["original.jpg"], true, [image])).toEqual([image.url]);
  });
  it("empty showroom falls back to originals even with stale activation", () => {
    expect(selectPublicDetailGallery(["original.jpg"], true, [])).toEqual(["original.jpg"]);
  });
  it("cannot delete an original path or another vehicle's image", () => {
    expect(isShowRoomPath(`${vehicleId}_original.jpg`, vehicleId)).toBe(false);
    expect(isShowRoomPath(path, "another-id")).toBe(false);
    expect(isShowRoomPath(`show-room/${vehicleId}/../original.jpg`, vehicleId)).toBe(false);
    expect(isShowRoomPath(path, vehicleId)).toBe(true);
  });
  it("rejects malformed or foreign gallery records", () => {
    expect(readShowRoomImages([image, image, { ...image, path: "original.jpg" }, { ...image, url: "javascript:alert(1)" }], vehicleId)).toEqual([image]);
  });
  it("primary selection persists as array order without mutating originals", () => {
    const second = { ...image, id: "two" };
    const source = [image, second];
    expect(moveShowRoomImage(source, "two", 0)).toEqual([second, image]);
    expect(source).toEqual([image, second]);
  });
});
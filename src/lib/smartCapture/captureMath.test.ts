import { describe, expect, it } from "vitest";
import { captureImportMeta, inscribedSize, isVinShot, listingName, normalizeVin, vinFromOcr } from "./captureMath";

describe("full-frame horizon crop", () => {
  it("keeps the whole frame when the phone is already level", () => {
    expect(inscribedSize(4032, 3024, 0)).toEqual({ width: 4032, height: 3024 });
  });
  it("crops only the corners after a small roll, never the whole photo", () => {
    const crop = inscribedSize(4032, 3024, 4);
    expect(crop.width).toBeGreaterThan(3700);
    expect(crop.height).toBeGreaterThan(2700);
    expect(crop.width).toBeLessThan(4032);
    expect(crop.height).toBeLessThan(3024);
  });
});

describe("VIN and listing transfer", () => {
  it("normalizes a photographed VIN", () => {
    expect(normalizeVin(" 2c4-rc1bg8hr 123456 ")).toBe("2C4RC1BG8HR123456");
    expect(normalizeVin("VIN 2C4RC1BG8HR123456")).toBe("2C4RC1BG8HR123456");
    expect(vinFromOcr({ vin: "vin 2C4RC1BG8HR123456", confidence: 90 })).toBe("2C4RC1BG8HR123456");
    expect(vinFromOcr({ vin: "ABC", confidence: 99 })).toBe("");
    expect(isVinShot("vin-za-oknem")).toBe(true);
  });
  it("prefers typed listing data and fills the rest from VIN decode", () => {
    const meta = captureImportMeta(
      { brand: "Chrysler", price: "459 000", mileage: "128 500", vin: "2c4rc1bg8hr123456" },
      { make: "Dodge", model: "Pacifica", year: 2021, fuel: "Benzín", transmission: "Automat" },
    );
    expect(listingName(meta)).toBe("Chrysler Pacifica");
    expect(meta).toMatchObject({
      year: 2021, price: 459000, mileage: 128500, vin: "2C4RC1BG8HR123456", fuel: "Benzín", transmission: "Automat",
    });
  });
});

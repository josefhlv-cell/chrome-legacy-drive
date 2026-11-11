import { Blob as NativeBlob } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { legacyUploadTurn, normalizeUploadImage } from "./uploadImage";

function jpeg(width: number, height: number, orientation: number) {
  const bytes = new Uint8Array(51);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 0xffd8); v.setUint16(2, 0xffe1); v.setUint16(4, 34);
  v.setUint32(6, 0x45786966); v.setUint16(12, 0x4949); v.setUint16(14, 42, true);
  v.setUint32(16, 8, true); v.setUint16(20, 1, true);
  v.setUint16(22, 0x0112, true); v.setUint16(24, 3, true);
  v.setUint32(26, 1, true); v.setUint16(30, orientation, true);
  v.setUint16(38, 0xffc0); v.setUint16(40, 9); v.setUint8(42, 8);
  v.setUint16(43, height); v.setUint16(45, width); v.setUint16(49, 0xffd9);
  return bytes.buffer;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("waiting JPEG normalization", () => {
  it("repairs old landscape camera pixels tagged EXIF 6 and EXIF 8 in opposite directions", () => {
    expect(legacyUploadTurn(jpeg(4032, 3024, 6))).toBe(-1);
    expect(legacyUploadTurn(jpeg(4032, 3024, 8))).toBe(1);
  });
  it("preserves real portrait photos and normal landscape photos", () => {
    expect(legacyUploadTurn(jpeg(3024, 4032, 6))).toBe(0);
    expect(legacyUploadTurn(jpeg(4032, 3024, 1))).toBe(0);
  });
  it("handles missing and truncated EXIF without guessing rotation", () => {
    expect(legacyUploadTurn(new ArrayBuffer(0))).toBe(0);
    expect(legacyUploadTurn(jpeg(4032, 3024, 6).slice(0, 23))).toBe(0);
  });
  function browser(width: number, height: number) {
    const bitmap = { width, height, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    const rotate = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({ translate: vi.fn(), rotate, scale: vi.fn(), drawImage: vi.fn() })) as unknown as typeof HTMLCanvasElement.prototype.getContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
      callback(new Blob([`${this.width}x${this.height}`], { type: "image/jpeg" }));
    });
    return { rotate, bitmap };
  }
  it("turns a restored sideways 4032px image to 3200 × 2400 in one encode", async () => {
    const { rotate, bitmap } = browser(3024, 4032);
    const input = new NativeBlob([jpeg(4032, 3024, 6)]) as unknown as Blob;
    const result = await normalizeUploadImage(input, { legacy: true });
    expect(result).toMatchObject({ width: 3200, height: 2400 });
    expect(rotate).toHaveBeenCalledWith(-Math.PI / 2);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("bounds the long side of a genuine portrait without turning it", async () => {
    const { rotate } = browser(3024, 4032);
    const result = await normalizeUploadImage(new NativeBlob([jpeg(3024, 4032, 1)]) as unknown as Blob, { legacy: true });
    expect(result).toMatchObject({ width: 2400, height: 3200 });
    expect(rotate).toHaveBeenCalledWith(0);
  });
  it("does not enlarge or re-encode a small normalized photograph", async () => {
    browser(1600, 1200);
    const input = new Blob(["small"]);
    const result = await normalizeUploadImage(input, { legacy: false });
    expect(result).toEqual({ blob: input, width: 1600, height: 1200 });
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
  });
  it("does not turn again after a versioned normalization", async () => {
    const { rotate } = browser(3200, 2400);
    const result = await normalizeUploadImage(new Blob(["normalized"]), { legacy: false });
    expect(result).toMatchObject({ width: 3200, height: 2400 });
    expect(rotate).not.toHaveBeenCalled();
  });
  it("applies persisted capture-time rotation even if the phone is now upright", async () => {
    const { rotate } = browser(3024, 4032);
    const result = await normalizeUploadImage(new Blob(["pending"]), { legacy: false, pendingTurn: 1 });
    expect(result).toMatchObject({ width: 3200, height: 2400 });
    expect(rotate).toHaveBeenCalledWith(Math.PI / 2);
  });
  it("blocks upload instead of silently sending unnormalized pixels on canvas failure", async () => {
    browser(4032, 3024);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(normalizeUploadImage(new Blob(["large"]), { legacy: false })).rejects.toThrow("otočit a zmenšit");
  });
});
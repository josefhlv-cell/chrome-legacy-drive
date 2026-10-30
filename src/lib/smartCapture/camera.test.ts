import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureZoomOne, openCamera } from "./camera";

afterEach(() => vi.unstubAllGlobals());
describe("iPhone-compatible camera requests", () => {
  it("requests the front camera when selected instead of forcing the rear lens", async () => {
    const stream = { getVideoTracks: () => [] };
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    expect(await openCamera("user")).toBe(stream);
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ audio: false, video: { facingMode: { ideal: "user" }, width: { ideal: 4032 }, height: { ideal: 3024 } } });
  });
  it("falls back from an unavailable device ID without losing the rear-camera preference", async () => {
    const stream = { getVideoTracks: () => [] };
    const getUserMedia = vi.fn().mockRejectedValueOnce({ name: "OverconstrainedError" }).mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    await openCamera("environment", "stale-iphone-lens");
    expect(getUserMedia.mock.calls[1][0].video.facingMode.ideal).toBe("environment");
  });
  it("does not repeatedly request permission after Safari denies camera access", async () => {
    const getUserMedia = vi.fn().mockRejectedValue({ name: "NotAllowedError" });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    await expect(openCamera()).rejects.toThrow("Přístup ke kameře byl zamítnut");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
  it("uses 1x even if the iPhone lens supports 0.5x", async () => {
    const applyConstraints = vi.fn();
    await ensureZoomOne({ getVideoTracks: () => [{ getCapabilities: () => ({ zoom: { min: 0.5, max: 5 } }), applyConstraints }] } as unknown as MediaStream);
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 1 }] });
  });
});
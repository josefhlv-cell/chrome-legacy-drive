import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), upsert: vi.fn(), invoke: vi.fn(), publicUrl: vi.fn(),
  showroom: vi.fn(),
  normalize: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.publicUrl }) },
  from: () => ({ upsert: mocks.upsert }),
  functions: { invoke: mocks.invoke },
} }));
vi.mock("./imageProcessing", () => ({
  processImage: vi.fn(async (blob: Blob) => ({ blob, width: 1920, height: 1080 })),
  computeBlurScore: vi.fn(async () => 0), fileToBase64: vi.fn(async () => "small-image"),
}));
import { uploadCapturePhoto, type QueuedPhoto } from "./photoQueue";
vi.mock("./showroomReplacement", () => ({ composeSmartCaptureShowroom: mocks.showroom }));
vi.mock("./uploadImage", () => ({ normalizeUploadImage: mocks.normalize }));

const photo = (): QueuedPhoto => ({
  id: "photo-stable-id", sessionId: "same-session", shotType: "prava-predni", shotIndex: 0,
  blob: new Blob(["photo"]), preview: "blob:local", status: "uploading", autoProcess: true, aiEnabled: false,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null }); mocks.upsert.mockResolvedValue({ error: null });
  mocks.publicUrl.mockImplementation(path => ({ data: { publicUrl: `https://configured-storage.test/${path}` } }));
  mocks.showroom.mockResolvedValue(new Blob(["showroom"]));
  mocks.normalize.mockImplementation(async (blob: Blob) => ({ blob, width: 3200, height: 2400 }));
});
describe("accepted photo background pipeline", () => {
  it("normalizes restored legacy originals before upload and saves real dimensions with processing off", async () => {
    const output = new Blob(["normalized"]);
    mocks.normalize.mockResolvedValue({ blob: output, width: 3200, height: 2400 });
    const input: QueuedPhoto = { ...photo(), autoProcess: false };
    await uploadCapturePhoto(input);
    expect(mocks.normalize).toHaveBeenCalledWith(expect.any(Blob), { legacy: true, pendingTurn: undefined });
    expect(mocks.upload.mock.calls.map(call => call[1])).toEqual([output, output]);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ width: 3200, height: 2400 });
    expect(input.normalizationVersion).toBe(1);
  });
  it("clears saved rotation and never treats retry bytes as legacy", async () => {
    const input: QueuedPhoto = { ...photo(), pendingTurn: -1, normalizationVersion: 1 };
    mocks.upload.mockResolvedValueOnce({ error: new Error("offline") });
    await expect(uploadCapturePhoto(input)).rejects.toThrow("offline");
    await uploadCapturePhoto(input);
    expect(mocks.normalize.mock.calls[0][1]).toEqual({ legacy: false, pendingTurn: -1 });
    expect(mocks.normalize.mock.calls[1][1]).toEqual({ legacy: false, pendingTurn: undefined });
  });
  it("does not upload or call AI if normalization fails", async () => {
    mocks.normalize.mockRejectedValueOnce(new Error("decode failed"));
    await expect(uploadCapturePhoto({ ...photo(), showroomEnabled: true })).rejects.toThrow("decode failed");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.showroom).not.toHaveBeenCalled();
  });
  it("reuses a completed paid composite on upload retry", async () => {
    const input = { ...photo(), showroomEnabled: true };
    mocks.upload.mockResolvedValueOnce({ error: new Error("offline") });
    await expect(uploadCapturePhoto(input)).rejects.toThrow("offline");
    await uploadCapturePhoto(input);
    expect(mocks.showroom).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[3][1]).toBe(input.showroomBlob);
  });
  it("never automatically replays an unknown paid AI outcome", async () => {
    const input = { ...photo(), showroomEnabled: true, showroomAttempted: true };
    await uploadCapturePhoto(input);
    expect(mocks.showroom).not.toHaveBeenCalled();
    expect(mocks.upload.mock.calls[0][1]).toBe(input.blob);
  });
  it("preserves the original bytes and puts the local composite only in the processed file", async () => {
    const input = { ...photo(), showroomEnabled: true };
    await uploadCapturePhoto(input);
    expect(mocks.upload.mock.calls[0][1]).toBe(input.blob);
    expect(mocks.upload.mock.calls[1][1]).toBe(await mocks.showroom.mock.results[0].value);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("never applies showroom to a non-primary capture shot", async () => {
    await uploadCapturePhoto({ ...photo(), shotType: "leva-predni", showroomEnabled: true });
    expect(mocks.showroom).not.toHaveBeenCalled();
  });
  it("leaves showroom disabled unless explicitly selected", async () => {
    await uploadCapturePhoto(photo());
    expect(mocks.showroom).not.toHaveBeenCalled();
  });
  it("saves the original when local AI fails without calling a paid fallback", async () => {
    mocks.showroom.mockRejectedValueOnce(new Error("Model unavailable"));
    const input = { ...photo(), showroomEnabled: true };
    await uploadCapturePhoto(input);
    expect(mocks.upload.mock.calls[1][1]).toBe(input.blob);
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("uses configured public URLs and current main-shot type", async () => {
    await uploadCapturePhoto(photo());
    const payload = mocks.upsert.mock.calls[0][0];
    expect(payload.is_main).toBe(true);
    expect(payload.shot_type).toBe("prava-predni");
    expect(payload.original_url).toBe("https://configured-storage.test/same-session/photo-stable-id_0_prava-predni_orig.jpg");
  });
  it("retry reuses paths and photo identity after a partial upload failure", async () => {
    mocks.upload.mockResolvedValueOnce({ error: new Error("offline") });
    await expect(uploadCapturePhoto(photo())).rejects.toThrow("offline");
    await uploadCapturePhoto(photo());
    expect(mocks.upload.mock.calls[0][0]).toBe(mocks.upload.mock.calls[2][0]);
    expect(mocks.upsert.mock.calls[0][0].id).toBe("photo-stable-id");
    expect(mocks.upsert.mock.calls[0][1]).toEqual({ onConflict: "id" });
  });
  it("saved photo completes even if advisory analysis never resolves", async () => {
    const bitmap = { width: 4032, height: 3024, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({ drawImage })) as unknown as typeof HTMLCanvasElement.prototype.getContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["small"])));
    mocks.invoke.mockImplementation(() => new Promise(() => {}));
    await uploadCapturePhoto({ ...photo(), aiEnabled: true });
    await Promise.resolve(); await Promise.resolve();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const canvas = drawImage.mock.instances.length ? drawImage.mock.calls[0] : [];
    expect(canvas[3]).toBe(1600);
    expect(canvas[4]).toBe(1200);
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  });
});
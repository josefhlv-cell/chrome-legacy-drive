import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), upsert: vi.fn(), invoke: vi.fn(), publicUrl: vi.fn(),
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

const photo = (): QueuedPhoto => ({
  id: "photo-stable-id", sessionId: "same-session", shotType: "prava-predni", shotIndex: 0,
  blob: new Blob(["photo"]), preview: "blob:local", status: "uploading", autoProcess: true, aiEnabled: false,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null }); mocks.upsert.mockResolvedValue({ error: null });
  mocks.publicUrl.mockImplementation(path => ({ data: { publicUrl: `https://configured-storage.test/${path}` } }));
});
describe("accepted photo background pipeline", () => {
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
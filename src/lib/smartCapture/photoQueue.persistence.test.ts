import "fake-indexeddb/auto";
import { Blob as NativeBlob } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "session" }, error: null }) }) }) }) }),
  storage: { from: () => ({ upload: () => new Promise(() => {}) }) },
} }));
vi.mock("./imageProcessing", () => ({ processImage: () => new Promise(() => {}) }));

describe("durable acceptance boundary", () => {
  it("commits the accepted blob and progress before resolving, without waiting for upload", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: vi.fn() });
    vi.stubGlobal("Blob", NativeBlob);
    const queue = await import("./photoQueue");
    const accepted = await queue.enqueuePhoto({ sessionId: "session", blob: new Blob(["accepted-photo"]), shotType: "prava-predni", shotIndex: 0, autoProcess: true, aiEnabled: false, progress: { skipped_steps: ["leva-predni"], next_step: 2 } });
    const request = indexedDB.open("chdp-capture-queue", 1);
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const stored = await new Promise<{ blob: Blob; progress: unknown }>(resolve => {
      const read = db.transaction("photos").objectStore("photos").get(accepted.id);
      read.onsuccess = () => resolve(read.result);
    });
    expect(stored.blob.size).toBe(14);
    expect(stored.progress).toEqual({ skipped_steps: ["leva-predni"], next_step: 2 });
    db.close();
    // A fresh JS realm (as after closing/reopening the browser) resumes the durable job.
    vi.resetModules();
    const restored = await import("./photoQueue");
    await restored.restoreQueue("session");
    expect(restored.photoQueue.getSnapshot()).toEqual([expect.objectContaining({ id: accepted.id, sessionId: "session", status: "uploading", shotIndex: 0 })]);
    vi.unstubAllGlobals();
  });
});
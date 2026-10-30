import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./imageProcessing", () => ({}));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("stalled local capture storage", () => {
  it("aborts an uncommitted photo, rejects acceptance and permits retry", async () => {
    vi.useFakeTimers();
    const transaction = { objectStore: () => ({ put: vi.fn() }), oncomplete: () => {}, onerror: () => {}, onabort: () => {}, abort: vi.fn(() => transaction.onabort()) };
    const request = { result: { transaction: () => transaction }, onsuccess: () => {} };
    vi.stubGlobal("indexedDB", { open: () => { queueMicrotask(() => request.onsuccess()); return request; } });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:timeout", revokeObjectURL: vi.fn() });
    const queue = await import("./photoQueue");
    const input = { sessionId: "session", blob: new Blob(["photo"]), shotType: "prava-predni" as const, shotIndex: 0, autoProcess: false, aiEnabled: false, progress: { next_step: 1, skipped_steps: [] } };
    const result = queue.enqueuePhoto(input);
    const rejection = expect(result).rejects.toThrow("trvá příliš dlouho");
    await vi.advanceTimersByTimeAsync(10000); await rejection;
    expect(transaction.abort).toHaveBeenCalledTimes(1);
    expect(queue.photoQueue.getSnapshot()).toHaveLength(0);
    const retry = queue.enqueuePhoto(input);
    const retryRejection = expect(retry).rejects.toThrow("trvá příliš dlouho");
    await vi.advanceTimersByTimeAsync(10000); await retryRejection;
    expect(transaction.abort).toHaveBeenCalledTimes(2);
  });
});
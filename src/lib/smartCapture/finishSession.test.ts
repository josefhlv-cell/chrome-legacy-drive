import { describe, expect, it, vi } from "vitest";
import { finishCaptureSession } from "./finishSession";

describe("save and finish capture", () => {
  const progress = { skipped_steps: ["leva-predni" as const], next_step: 20 };
  function setup() {
    return { restorePhotos: vi.fn().mockResolvedValue(undefined), waitForPhotos: vi.fn().mockResolvedValue(undefined),
      flushProgress: vi.fn().mockResolvedValue(undefined), save: vi.fn().mockResolvedValue(undefined), detach: vi.fn() };
  }
  it("preserves all skipped steps and only detaches after saving for PC", async () => {
    const deps = setup();
    deps.save.mockImplementation(async () => { expect(deps.detach).not.toHaveBeenCalled(); });
    await finishCaptureSession(progress, deps);
    expect(deps.save).toHaveBeenCalledWith({ skipped_steps: ["leva-predni"], next_step: 20 }, expect.any(String));
    expect(deps.detach).toHaveBeenCalledOnce();
  });
  it("waits for accepted photos before finishing", async () => {
    const deps = setup();
    let uploaded: (() => void) | undefined;
    deps.waitForPhotos.mockImplementation(() => new Promise<void>(resolve => { uploaded = resolve; }));
    const finishing = finishCaptureSession(progress, deps);
    await vi.waitFor(() => expect(deps.waitForPhotos).toHaveBeenCalled());
    expect(deps.save).not.toHaveBeenCalled();
    uploaded?.(); await finishing;
    expect(deps.detach).toHaveBeenCalledOnce();
  });
  it.each(["restorePhotos", "waitForPhotos", "save"] as const)("keeps the active session after %s fails", async failure => {
    const deps = setup(); deps[failure].mockRejectedValue(new Error("offline"));
    await expect(finishCaptureSession(progress, deps)).rejects.toThrow("offline");
    expect(deps.detach).not.toHaveBeenCalled();
  });
});
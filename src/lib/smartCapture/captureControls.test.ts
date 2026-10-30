import { afterEach, describe, expect, it, vi } from "vitest";
import { captureJpeg, watchCameraReady } from "./captureControls";

afterEach(() => vi.useRealTimers());
describe("capture control recovery", () => {
  it("enables the camera without a playing event", () => {
    vi.useFakeTimers();
    const video = Object.assign(new EventTarget(), { videoWidth: 0, videoHeight: 0, readyState: 0 });
    const ready = vi.fn(), timeout = vi.fn();
    const stop = watchCameraReady(video as HTMLVideoElement, ready, timeout);
    Object.assign(video, { videoWidth: 4032, videoHeight: 3024, readyState: 2 });
    vi.advanceTimersByTime(10000);
    expect(ready).toHaveBeenCalledTimes(1); expect(timeout).not.toHaveBeenCalled(); stop();
  });
  it("reports a stalled camera and stops observing a discarded stream", () => {
    vi.useFakeTimers();
    const video = Object.assign(new EventTarget(), { videoWidth: 0, videoHeight: 0, readyState: 0 });
    const ready = vi.fn(), timeout = vi.fn();
    const stop = watchCameraReady(video as HTMLVideoElement, ready, timeout);
    vi.advanceTimersByTime(10000); expect(timeout).toHaveBeenCalledTimes(1);
    stop(); Object.assign(video, { videoWidth: 4032, videoHeight: 3024, readyState: 2 });
    video.dispatchEvent(new Event("playing")); expect(ready).not.toHaveBeenCalled();
  });
  it("rejects a missing JPEG callback so the shutter can unlock", async () => {
    vi.useFakeTimers();
    const result = captureJpeg({ toBlob: () => {} } as unknown as HTMLCanvasElement);
    const assertion = expect(result).rejects.toThrow("trvá příliš dlouho");
    await vi.advanceTimersByTimeAsync(10000); await assertion;
  });
  it("keeps the original JPEG quality and accepts a completed callback", async () => {
    const blob = new Blob(["photo"]);
    const toBlob = vi.fn((done: BlobCallback) => done(blob));
    expect(await captureJpeg({ toBlob } as unknown as HTMLCanvasElement)).toBe(blob);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92);
  });
});
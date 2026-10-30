import type { CaptureProgress } from "./workflow";

type Dependencies = {
  restorePhotos: () => Promise<unknown>;
  waitForPhotos: () => Promise<void>;
  flushProgress: () => Promise<unknown>;
  save: (progress: CaptureProgress, finishedAt: string) => Promise<unknown>;
  detach: () => void;
};

/** Detach only after every accepted photo and the latest progress are remotely durable. */
export async function finishCaptureSession(progress: CaptureProgress, dependencies: Dependencies) {
  await dependencies.restorePhotos();
  await dependencies.waitForPhotos();
  await dependencies.flushProgress();
  await dependencies.save(progress, new Date().toISOString());
  dependencies.detach();
}
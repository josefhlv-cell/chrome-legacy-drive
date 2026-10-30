import { SHOT_SEQUENCE, type ShotType } from "./types";

export type CaptureProgress = { skipped_steps: ShotType[]; next_step: number };

export function readProgress(metadata: unknown): CaptureProgress {
  const meta = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  return {
    skipped_steps: Array.isArray(meta.skipped_steps)
      ? meta.skipped_steps.filter((t): t is ShotType => SHOT_SEQUENCE.some(s => s.type === t)) : [],
    next_step: typeof meta.next_step === "number" ? Math.max(0, Math.min(20, meta.next_step)) : 0,
  };
}

export function advanceProgress(progress: CaptureProgress, index: number, skipped: boolean): CaptureProgress {
  const type = SHOT_SEQUENCE[index]?.type;
  if (!type) return progress;
  const remaining = progress.skipped_steps.filter(t => t !== type);
  return { skipped_steps: skipped ? [...remaining, type] : remaining, next_step: index + 1 };
}

export const isMainShot = (type: string) => type === "prava-predni";

export function qualityTip(ai: { tip?: string; is_blurry?: boolean }, blur?: number): string | undefined {
  return ai.tip || (ai.is_blurry || (blur !== undefined && blur < 35) ? "Fotka vypadá mírně rozmazaná" : undefined);
}
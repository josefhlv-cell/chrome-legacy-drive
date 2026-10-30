import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else delete (navigator as { clipboard?: unknown }).clipboard;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the async Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await expect(copyTextToClipboard("https://x.cz/?session=1")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://x.cz/?session=1");
  });

  it("falls back to execCommand when the Clipboard API rejects (iOS / iframe)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const exec = vi.spyOn(document, "execCommand").mockReturnValue(true);
    await expect(copyTextToClipboard("odkaz")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("falls back when navigator.clipboard is missing entirely", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const exec = vi.spyOn(document, "execCommand").mockReturnValue(true);
    await expect(copyTextToClipboard("odkaz")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("reports failure instead of throwing when both paths fail", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    vi.spyOn(document, "execCommand").mockImplementation(() => { throw new Error("denied"); });
    await expect(copyTextToClipboard("odkaz")).resolves.toBe(false);
  });
});

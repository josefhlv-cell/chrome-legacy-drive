import { beforeEach, describe, expect, it, vi } from "vitest";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
import { generateVehicleShowroom } from "./vehicleShowroomGeneration";

describe("vehicle photo showroom generation", () => {
  beforeEach(() => invoke.mockReset());
  it("generates only the selected primary photo without forcing paid regeneration or applying it", async () => {
    invoke.mockResolvedValue({ data: { showroom_url: "https://example.test/result.jpg" }, error: null });
    expect(await generateVehicleShowroom("primary-photo")).toBe("https://example.test/result.jpg");
    expect(invoke.mock.calls).toEqual([["showroom-generate", { body: { imageId: "primary-photo", force: false } }]]);
  });
  it("preserves the server guard error for non-primary images", async () => {
    invoke.mockResolvedValue({ data: { error: "Pouze titulní fotografie" }, error: null });
    await expect(generateVehicleShowroom("secondary-photo")).rejects.toThrow("Pouze titulní fotografie");
  });
  it("does not silently retry an unsuccessful generation", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Nedostatek kreditů" } });
    await expect(generateVehicleShowroom("primary-photo")).rejects.toThrow("Nedostatek kreditů");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, calls, result } = vi.hoisted(() => ({
  from: vi.fn(),
  calls: [] as Array<{ method: string; args: unknown[] }>,
  result: { data: [] as unknown[] },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { useInfiniteVehicles, useVehicles } from "./useVehicles";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  calls.length = 0;
  result.data = [{ id: "vehicle-a", vin: "VIN-A", vehicle_images: [] }];
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: result.data, error: null }).then(resolve),
  };
  for (const method of ["select", "order", "neq", "limit", "range"]) {
    query[method] = (...args: unknown[]) => { calls.push({ method, args }); return query; };
  }
  from.mockReturnValue(query);
});

describe("vehicle card query budget", () => {
  it("limits public photos on the server and retains vehicles without photos", async () => {
    const hook = renderHook(() => useVehicles(false), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.map(v => v.id)).toEqual(["vehicle-a"]);
    expect(calls.filter(c => c.method === "limit")).toEqual([
      { method: "limit", args: [1, { referencedTable: "vehicle_images" }] },
    ]);
    expect(calls.filter(c => c.method === "order").slice(1)).toEqual([
      { method: "order", args: ["is_main", { referencedTable: "vehicle_images", ascending: false }] },
      { method: "order", args: ["sort_order", { referencedTable: "vehicle_images", ascending: true }] },
      { method: "order", args: ["id", { referencedTable: "vehicle_images", ascending: true }] },
    ]);
  });

  it("keeps the full admin row and all original gallery photos", async () => {
    result.data = [{ id: "vehicle-a", vin: "VIN-A", description: "Original", vehicle_images: [
      { image_url: "first.jpg", is_main: true }, { image_url: "second.jpg", is_main: false },
    ] }];
    const hook = renderHook(() => useVehicles(true), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.[0].vehicle_images).toHaveLength(2);
    expect(hook.result.current.data?.[0].description).toBe("Original");
    expect(calls.some(c => c.method === "limit")).toBe(false);
    expect(calls.find(c => c.method === "select")?.args[0]).toMatch(/^\*,vehicle_images\(/);
  });

  it("also limits embedded photos in paginated lists, not the vehicle page size", async () => {
    const hook = renderHook(() => useInfiniteVehicles(12), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(calls.find(c => c.method === "limit")?.args).toEqual([1, { referencedTable: "vehicle_images" }]);
    expect(calls.find(c => c.method === "range")?.args).toEqual([0, 11]);
  });
});
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPreviousVersions } from "./showroomPipeline.ts";

const OLD = "https://x/storage/v1/object/public/vehicles/showroom/Web_Showroom/ce6/d84_1794152371453.jpg";

Deno.test("existing preview is archived, not lost", () => {
  const v = buildPreviousVersions({ showroom_url: OLD, showroom_metadata: { placement_version: "placement-v7" } });
  assertEquals(v.length, 1);
  assertEquals(v[0].showroom_url, OLD);
  assertEquals((v[0].metadata as any).placement_version, "placement-v7");
});

Deno.test("history accumulates and never duplicates", () => {
  const first = buildPreviousVersions({ showroom_url: OLD, showroom_metadata: {} });
  const second = buildPreviousVersions({ showroom_url: "new.jpg", showroom_metadata: { previous_versions: first } });
  assertEquals(second.map((x) => x.showroom_url), ["new.jpg", OLD]);
  assertEquals(buildPreviousVersions({ showroom_url: OLD, showroom_metadata: { previous_versions: first } }).length, 1);
});

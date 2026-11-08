import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectNonExteriorShot } from "./showroomExteriorGuard.ts";

const base = "https://x.supabase.co/storage/v1/object/public/smart-capture/s1/";

Deno.test("exterior front-right shot is allowed", () => {
  assertEquals(detectNonExteriorShot(base + "p1_1_prava-predni_web.jpg"), null);
});
Deno.test("rear seats shot is blocked", () => {
  assertEquals(detectNonExteriorShot(base + "p8_8_sedacky-zezadu_web.jpg"), "sedacky-zezadu");
});
Deno.test("odometer shot is blocked", () => {
  assertEquals(detectNonExteriorShot(base + "p16_16_km_web.jpg"), "km");
});
Deno.test("interior word in admin filename is blocked", () => {
  assertEquals(detectNonExteriorShot("https://x/vehicles/abc/Interier-pacifica.jpg"), "interier");
});
Deno.test("plain uuid filename is allowed", () => {
  assertEquals(detectNonExteriorShot("https://x/vehicles/0b1c-22aa/9f8e.jpg"), null);
});

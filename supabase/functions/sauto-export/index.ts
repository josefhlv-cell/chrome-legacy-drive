import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SAUTO_RPC_URL = "https://import.sauto.cz/RPC2";
const CAR_LIST_URL = "https://www.sauto.cz/import/carList";

// ─── MD5 helper (Deno supports MD5 via crypto.subtle) ───
async function md5(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── XML-RPC helpers ───
function xmlRpcValue(val: unknown): string {
  if (typeof val === "number" && Number.isInteger(val)) return `<value><int>${val}</int></value>`;
  if (typeof val === "number") return `<value><double>${val}</double></value>`;
  if (typeof val === "boolean") return `<value><boolean>${val ? 1 : 0}</boolean></value>`;
  if (typeof val === "string" && val.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(val)) {
    return `<value><base64>${val}</base64></value>`;
  }
  if (typeof val === "string") return `<value><string>${escapeXml(val)}</string></value>`;
  if (Array.isArray(val)) {
    return `<value><array><data>${val.map(v => xmlRpcValue(v)).join("")}</data></array></value>`;
  }
  if (typeof val === "object" && val !== null) {
    const members = Object.entries(val as Record<string, unknown>)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `<member><name>${k}</name>${xmlRpcValue(v)}</member>`)
      .join("");
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string></string></value>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildXmlRpcRequest(method: string, params: unknown[]): string {
  const paramsXml = params.map(p => `<param>${xmlRpcValue(p)}</param>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><methodCall><methodName>${method}</methodName><params>${paramsXml}</params></methodCall>`;
}

// Simple XML-RPC response parser
function parseXmlRpcResponse(xml: string): any {
  // Extract fault if present
  if (xml.includes("<fault>")) {
    const faultCode = extractValue(xml, "faultCode");
    const faultString = extractValue(xml, "faultString");
    throw new Error(`XML-RPC Fault ${faultCode}: ${faultString}`);
  }

  return parseStruct(xml);
}

function parseStruct(xml: string): any {
  const result: any = {};

  // Parse struct members
  const memberRegex = /<member>\s*<name>(.*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
  let match;
  while ((match = memberRegex.exec(xml)) !== null) {
    const name = match[1];
    const valueXml = match[2];
    result[name] = parseValue(valueXml);
  }

  return result;
}

function parseValue(xml: string): any {
  xml = xml.trim();
  const intMatch = xml.match(/<(?:int|i4)>(.*?)<\/(?:int|i4)>/);
  if (intMatch) return parseInt(intMatch[1], 10);
  const strMatch = xml.match(/<string>([\s\S]*?)<\/string>/);
  if (strMatch) return strMatch[1];
  const boolMatch = xml.match(/<boolean>(.*?)<\/boolean>/);
  if (boolMatch) return boolMatch[1] === "1";
  const dblMatch = xml.match(/<double>(.*?)<\/double>/);
  if (dblMatch) return parseFloat(dblMatch[1]);
  if (xml.includes("<struct>")) return parseStruct(xml);
  if (xml.includes("<array>")) {
    const values: any[] = [];
    const valRegex = /<value>([\s\S]*?)<\/value>/g;
    let m;
    // Skip the outer <data> and get inner values
    const dataContent = xml.match(/<data>([\s\S]*?)<\/data>/);
    if (dataContent) {
      while ((m = valRegex.exec(dataContent[1])) !== null) {
        values.push(parseValue(m[1]));
      }
    }
    return values;
  }
  // Plain text without type tag
  return xml.replace(/<[^>]+>/g, "").trim();
}

function extractValue(xml: string, name: string): string {
  const regex = new RegExp(`<name>${name}</name>\\s*<value>([\\s\\S]*?)</value>`);
  const match = regex.exec(xml);
  if (!match) return "";
  return parseValue(match[1])?.toString() || "";
}

async function callXmlRpc(method: string, params: unknown[]): Promise<any> {
  const body = buildXmlRpcRequest(method, params);
  console.log(`[Sauto] Calling ${method}...`);

  const resp = await fetch(SAUTO_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);

  return parseXmlRpcResponse(text);
}

// ─── Sauto Auth ───
async function sautoAuth(login: string, password: string, swKey: string): Promise<string> {
  const hashResult = await callXmlRpc("getHash", [login]);
  console.log("[Sauto] getHash result:", JSON.stringify(hashResult));

  if (hashResult.status !== 200) {
    throw new Error(`getHash failed: ${hashResult.status_message || hashResult.status}`);
  }

  const sessionId = hashResult.output?.session_id;
  const hashKey = hashResult.output?.hash_key;
  if (!sessionId || !hashKey) throw new Error("Missing session_id or hash_key from getHash");

  // MD5(MD5(password) + hash_key)
  const md5Pass = await md5(password);
  const hash = await md5(md5Pass + hashKey);

  const loginResult = await callXmlRpc("login", [sessionId, hash, swKey]);
  console.log("[Sauto] login result:", JSON.stringify(loginResult));

  if (loginResult.status !== 200) {
    throw new Error(`Login failed: ${loginResult.status_message || loginResult.status}`);
  }

  return sessionId;
}

// ─── CarList Parser ───
interface CarListEntry {
  kind_id: number;
  manufacturer_id: number;
  manufacturer_name: string;
  model_id: number;
  model_name: string;
  body_ids: number[];
}

async function fetchCarList(): Promise<CarListEntry[]> {
  const resp = await fetch(CAR_LIST_URL);
  const xml = await resp.text();
  const entries: CarListEntry[] = [];

  // Parse XML: <kind><kind_id>...</kind_id>...<manufacturer>...</manufacturer></kind>
  const kindRegex = /<kind>([\s\S]*?)<\/kind>/g;
  let kindMatch;
  while ((kindMatch = kindRegex.exec(xml)) !== null) {
    const kindXml = kindMatch[1];
    const kindId = parseInt(kindXml.match(/<kind_id>(\d+)<\/kind_id>/)?.[1] || "0");

    // Extract bodies for this kind
    const bodyIds: number[] = [];
    const bodyIdRegex = /<body_id>(\d+)<\/body_id>/g;
    let bodyMatch;
    // Get bodies from the kind level (before manufacturers)
    const bodiesSection = kindXml.match(/<body>([\s\S]*?)<\/body>/g);
    if (bodiesSection) {
      for (const bs of bodiesSection) {
        const bid = bs.match(/<body_id>(\d+)<\/body_id>/);
        if (bid) bodyIds.push(parseInt(bid[1]));
      }
    }

    const mfgRegex = /<manufacturer>([\s\S]*?)<\/manufacturer>/g;
    let mfgMatch;
    while ((mfgMatch = mfgRegex.exec(kindXml)) !== null) {
      const mfgXml = mfgMatch[1];
      const mfgId = parseInt(mfgXml.match(/<manufacturer_id>(\d+)<\/manufacturer_id>/)?.[1] || "0");
      const mfgName = mfgXml.match(/<manufacturer_name>(.*?)<\/manufacturer_name>/)?.[1] || "";

      const modelRegex = /<model>([\s\S]*?)<\/model>/g;
      let modelMatch;
      while ((modelMatch = modelRegex.exec(mfgXml)) !== null) {
        const modelXml = modelMatch[1];
        const modelId = parseInt(modelXml.match(/<model_id>(\d+)<\/model_id>/)?.[1] || "0");
        const modelName = modelXml.match(/<model_name>(.*?)<\/model_name>/)?.[1] || "";

        entries.push({ kind_id: kindId, manufacturer_id: mfgId, manufacturer_name: mfgName, model_id: modelId, model_name: modelName, body_ids: bodyIds });
      }
    }
  }

  return entries;
}

// ─── Normalization & matching ───
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .replace(/[-_./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface MatchResult {
  manufacturer_id: number;
  model_id: number;
  kind_id: number;
  body_id: number;
  manufacturer_name: string;
  model_name: string;
  confidence: "exact" | "partial" | "fuzzy" | "fallback";
}

function findBestMatch(vehicleName: string, carList: CarListEntry[], allowFallback = false): MatchResult | null {
  const nameNorm = normalize(vehicleName);

  // Step 1: longest manufacturer match at the start of the string
  const manufacturers = [...new Set(carList.map(e => e.manufacturer_name))]
    .map(m => ({ raw: m, norm: normalize(m) }))
    .sort((a, b) => b.norm.length - a.norm.length);

  let bestMfg = "";
  for (const m of manufacturers) {
    if (nameNorm === m.norm || nameNorm.startsWith(m.norm + " ") || nameNorm.startsWith(m.norm)) {
      bestMfg = m.raw;
      break;
    }
  }
  if (!bestMfg) return null;

  const remaining = nameNorm.slice(normalize(bestMfg).length).trim();
  const mfgEntries = carList.filter(e => normalize(e.manufacturer_name) === normalize(bestMfg));

  // Step 2: longest model match
  let bestEntry: CarListEntry | null = null;
  let bestScore = 0;
  let confidence: MatchResult["confidence"] = "partial";

  const sortedModels = [...mfgEntries].sort(
    (a, b) => normalize(b.model_name).length - normalize(a.model_name).length,
  );

  for (const entry of sortedModels) {
    const modelNorm = normalize(entry.model_name);
    if (!modelNorm) continue;
    if (remaining === modelNorm || remaining.startsWith(modelNorm + " ") || remaining.startsWith(modelNorm)) {
      bestEntry = entry;
      confidence = remaining === modelNorm ? "exact" : "partial";
      bestScore = modelNorm.length;
      break;
    }
  }

  // Step 3: substring fuzzy
  if (!bestEntry) {
    for (const entry of sortedModels) {
      const modelNorm = normalize(entry.model_name);
      if (modelNorm && modelNorm.length >= 2 && remaining.includes(modelNorm)) {
        if (modelNorm.length > bestScore) {
          bestEntry = entry;
          bestScore = modelNorm.length;
          confidence = "fuzzy";
        }
      }
    }
  }

  // Step 4: explicit fallback (only when allowed)
  if (!bestEntry) {
    if (!allowFallback) return null;
    bestEntry = mfgEntries.find(e => normalize(e.model_name) === "ostatni") || mfgEntries[0];
    if (!bestEntry) return null;
    confidence = "fallback";
  }

  return {
    manufacturer_id: bestEntry.manufacturer_id,
    model_id: bestEntry.model_id,
    kind_id: bestEntry.kind_id,
    body_id: bestEntry.body_ids[0] || 9,
    manufacturer_name: bestEntry.manufacturer_name,
    model_name: bestEntry.model_name,
    confidence,
  };
}

// deno-lint-ignore no-explicit-any
async function logExport(supabase: any, row: { vehicle_id?: string | null; portal: string; operation: string; level: string; message: string; context?: any }) {
  try {
    await supabase.from("export_logs").insert({
      vehicle_id: row.vehicle_id || null,
      portal: row.portal,
      operation: row.operation,
      level: row.level,
      message: row.message.slice(0, 4000),
      context: row.context || {},
    });
  } catch (e) {
    console.warn("[log] insert failed:", e);
  }
}

// ─── Fuel/Color/Gearbox mapping ───
function mapFuel(fuel: string): number {
  const f = fuel.toLowerCase();
  if (f.includes("nafta") || f.includes("diesel")) return 2;
  if (f.includes("lpg")) return 3;
  if (f.includes("elektr") || f.includes("ev") || f.includes("electric")) return 4;
  if (f.includes("hybrid")) return 5;
  if (f.includes("cng")) return 6;
  if (f.includes("ethanol")) return 7;
  if (f.includes("vodík") || f.includes("hydrogen")) return 9;
  return 1; // Benzín
}

function mapColor(color: string): number {
  const c = color.toLowerCase();
  if (c.includes("bíl")) return 1;
  if (c.includes("žlut")) return 2;
  if (c.includes("oranž")) return 3;
  if (c.includes("červen")) return 4;
  if (c.includes("vínov")) return 5;
  if (c.includes("růžov")) return 6;
  if (c.includes("fialov")) return 7;
  if (c.includes("modr")) return 8;
  if (c.includes("zelen")) return 9;
  if (c.includes("hněd")) return 10;
  if (c.includes("šed") || c.includes("sed")) return 11;
  if (c.includes("čern") || c.includes("cern")) return 12;
  if (c.includes("béžov")) return 13;
  if (c.includes("stříbr") || c.includes("stribr")) return 14;
  if (c.includes("zlat")) return 15;
  if (c.includes("bronz")) return 17;
  return 16; // Jiná
}

function mapGearbox(transmission: string): number {
  const t = transmission.toLowerCase();
  if (t.includes("automat")) return 3;
  if (t.includes("poloautomat")) return 2;
  return 1; // Manuální
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // deno-lint-ignore no-explicit-any
  let supabase: any = null;
  let vehicleId: string | undefined;

  try {
    const {
      vehicle_id,
      sauto_login, sauto_password, sauto_sw_key,
      overrides,
      test_mode = false,
      allow_fallback_match = false,
    } = await req.json();
    vehicleId = vehicle_id;

    if (!vehicle_id || !sauto_login || !sauto_password || !sauto_sw_key) {
      return new Response(JSON.stringify({ error: "Chybí povinné parametry (vehicle_id, sauto_login, sauto_password, sauto_sw_key)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await logExport(supabase, {
      vehicle_id, portal: "sauto", operation: "export", level: "info",
      message: `Sauto export started${test_mode ? " (TEST MODE)" : ""}`,
      context: { test_mode, has_overrides: !!overrides },
    });

    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles").select("*").eq("id", vehicle_id).single();
    if (vErr || !vehicle) throw new Error(`Vozidlo nenalezeno: ${vErr?.message}`);

    const { data: images } = await supabase
      .from("vehicle_images").select("*").eq("vehicle_id", vehicle_id).order("sort_order");

    // Existing export record (for cached IDs and external_id)
    const { data: existingExport } = await supabase
      .from("vehicle_exports")
      .select("*")
      .eq("vehicle_id", vehicle_id).eq("portal", "sauto").maybeSingle();

    const cachedMeta = (existingExport?.metadata as Record<string, unknown>) || {};

    // ─── Match manufacturer/model ───
    let manufacturerId: number;
    let modelId: number;
    let kindId: number;
    let bodyId: number;
    let matchInfo: { confidence: string; manufacturer?: string; model?: string; source: string };

    if (overrides?.manufacturer_id && overrides?.model_id) {
      manufacturerId = overrides.manufacturer_id;
      modelId = overrides.model_id;
      kindId = overrides.kind_id || (cachedMeta.kind_id as number) || 1;
      bodyId = overrides.body_id || (cachedMeta.body_id as number) || 9;
      matchInfo = { confidence: "override", source: "override" };
    } else if (cachedMeta.manufacturer_id && cachedMeta.model_id) {
      manufacturerId = cachedMeta.manufacturer_id as number;
      modelId = cachedMeta.model_id as number;
      kindId = (cachedMeta.kind_id as number) || 1;
      bodyId = (cachedMeta.body_id as number) || 9;
      matchInfo = { confidence: "cached", source: "cached", manufacturer: cachedMeta.manufacturer_name as string, model: cachedMeta.model_name as string };
    } else {
      console.log("[Sauto] Fetching carList...");
      const carList = await fetchCarList();
      const match = findBestMatch(vehicle.name, carList, allow_fallback_match);
      if (!match) {
        await logExport(supabase, {
          vehicle_id, portal: "sauto", operation: "match", level: "error",
          message: `No match found for "${vehicle.name}"`,
          context: { allow_fallback: allow_fallback_match },
        });
        return new Response(JSON.stringify({
          error: `Nepodařilo se najít výrobce/model pro "${vehicle.name}".`,
          suggestion: "Zadejte overrides s manufacturer_id, model_id, body_id (najdete v Sauto číselníku) nebo nastavte allow_fallback_match=true.",
          needs_override: true,
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (match.confidence === "fallback") {
        await logExport(supabase, {
          vehicle_id, portal: "sauto", operation: "match", level: "warn",
          message: `Fallback match used: ${match.manufacturer_name} / ${match.model_name}`,
          context: match,
        });
      }
      manufacturerId = match.manufacturer_id;
      modelId = match.model_id;
      kindId = match.kind_id;
      bodyId = match.body_id;
      matchInfo = { confidence: match.confidence, source: "auto", manufacturer: match.manufacturer_name, model: match.model_name };
    }

    // Parse engine info
    let engineVolume = 0;
    if (vehicle.engine) {
      const ccmMatch = vehicle.engine.match(/(\d[\d\s]*)\s*ccm/i);
      if (ccmMatch) engineVolume = parseInt(ccmMatch[1].replace(/\s/g, ""));
    }
    let enginePower = 0;
    if (vehicle.power) {
      const kwMatch = vehicle.power.match(/(\d+)\s*kW/i);
      if (kwMatch) enginePower = parseInt(kwMatch[1]);
    }

    const priceToSend = vehicle.show_vat
      ? Math.round(vehicle.price_with_vat * 1.21)
      : vehicle.price_with_vat;

    const carData: Record<string, unknown> = {
      kind_id: kindId, manufacturer_id: manufacturerId, model_id: modelId, body_id: bodyId,
      condition: 2, price: priceToSend, dph: vehicle.show_vat ? 1 : 0,
      fuel: mapFuel(vehicle.fuel), tachometr: vehicle.mileage, tachometr_unit: 1,
      made_date: String(vehicle.year), state_id: 1, availability: 2,
      custom_id: vehicle.id,
    };
    if (vehicle.vin) carData.vin = vehicle.vin;
    if (vehicle.color) carData.color = mapColor(vehicle.color);
    if (engineVolume > 0) carData.engine_volume = engineVolume;
    if (enginePower > 0) carData.engine_power = enginePower;
    if (vehicle.transmission) carData.gearbox = mapGearbox(vehicle.transmission);
    if (vehicle.description) carData.note = vehicle.description.slice(0, 1000);
    if (overrides) {
      for (const [key, val] of Object.entries(overrides)) {
        if (val !== undefined && val !== null && val !== "") carData[key] = val;
      }
    }

    // Test mode: don't actually call API
    if (test_mode) {
      await logExport(supabase, {
        vehicle_id, portal: "sauto", operation: "export", level: "info",
        message: `TEST MODE OK — match=${matchInfo.confidence}`,
        context: { match: matchInfo, car_data: carData, photos: images?.length || 0 },
      });
      return new Response(JSON.stringify({
        success: true, test_mode: true, match: matchInfo,
        car_data_preview: carData, photos_count: images?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Live: auth + addEditCar + photos ───
    console.log("[Sauto] Authenticating...");
    const sessionId = await sautoAuth(sauto_login, sauto_password, sauto_sw_key);

    let carId: number | undefined;
    let photosUploaded = 0;
    let photosFailed = 0;
    const photoErrors: string[] = [];

    try {
      const addResult = await callXmlRpc("addEditCar", [sessionId, carData]);
      if (addResult.status !== 200) {
        const errorMsg = addResult.output?.error || addResult.status_message || `Status ${addResult.status}`;
        const errorItems = addResult.output?.error_items;
        throw new Error(`addEditCar failed: ${errorMsg}${errorItems ? " | " + JSON.stringify(errorItems) : ""}`);
      }
      carId = addResult.output?.car_id;
      await logExport(supabase, {
        vehicle_id, portal: "sauto", operation: "xmlrpc", level: "info",
        message: `addEditCar OK car_id=${carId}`, context: { car_id: carId },
      });

      if (carId && images && images.length > 0) {
        const limit = Math.min(images.length, 50);
        for (let i = 0; i < limit; i++) {
          const img = images[i];
          try {
            const imgResp = await fetch(img.image_url);
            if (!imgResp.ok) {
              photosFailed++;
              photoErrors.push(`#${i + 1}: HTTP ${imgResp.status}`);
              continue;
            }
            const imgBuffer = await imgResp.arrayBuffer();
            const bytes = new Uint8Array(imgBuffer);
            // chunked btoa to avoid stack overflow on large images
            let bin = "";
            const CHUNK = 0x8000;
            for (let off = 0; off < bytes.length; off += CHUNK) {
              bin += String.fromCharCode(...bytes.subarray(off, off + CHUNK));
            }
            const base64 = btoa(bin);
            const photoData: Record<string, unknown> = {
              main: img.is_main ? 1 : (i + 2),
              b64: base64, alt: vehicle.name, client_photo_id: img.id,
            };
            const photoResult = await callXmlRpc("addEditPhoto", [sessionId, carId, photoData]);
            if (photoResult.status === 200) {
              photosUploaded++;
            } else {
              photosFailed++;
              photoErrors.push(`#${i + 1}: ${photoResult.status_message || photoResult.status}`);
            }
          } catch (photoErr) {
            photosFailed++;
            photoErrors.push(`#${i + 1}: ${(photoErr as Error).message}`);
          }
        }
      }

      try { await callXmlRpc("logout", [sessionId]); } catch { /* ignore */ }
    } catch (err) {
      try { await callXmlRpc("logout", [sessionId]); } catch { /* ignore */ }
      throw err;
    }

    // Persist export status + IDs
    await supabase.from("vehicle_exports").upsert({
      vehicle_id,
      portal: "sauto",
      external_id: carId ? String(carId) : (existingExport?.external_id || ""),
      status: "online",
      last_export_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: photosFailed > 0 ? `${photosFailed} photo(s) failed` : "",
      attempts: (existingExport?.attempts || 0) + 1,
      metadata: {
        manufacturer_id: manufacturerId, model_id: modelId,
        kind_id: kindId, body_id: bodyId,
        manufacturer_name: matchInfo.manufacturer || cachedMeta.manufacturer_name || null,
        model_name: matchInfo.model || cachedMeta.model_name || null,
        match_confidence: matchInfo.confidence,
        match_source: matchInfo.source,
        photos_uploaded: photosUploaded, photos_failed: photosFailed,
        photo_errors: photoErrors.slice(0, 10),
      },
    }, { onConflict: "vehicle_id,portal" });

    await logExport(supabase, {
      vehicle_id, portal: "sauto", operation: "export", level: "info",
      message: `Sauto export OK car_id=${carId} photos=${photosUploaded}/${(images?.length || 0)}`,
      context: { car_id: carId, photos_uploaded: photosUploaded, photos_failed: photosFailed, match: matchInfo },
    });

    return new Response(JSON.stringify({
      success: true, car_id: carId,
      photos_uploaded: photosUploaded, photos_failed: photosFailed,
      photos_total: images?.length || 0,
      photo_errors: photoErrors,
      match: matchInfo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const e = err as Error;
    console.error("[Sauto] Error:", e);
    if (supabase) {
      try {
        await logExport(supabase, {
          vehicle_id: vehicleId || null, portal: "sauto", operation: "export", level: "error",
          message: e.message, context: { stack: e.stack?.slice(0, 1000) },
        });
        if (vehicleId) {
          await supabase.from("vehicle_exports").upsert({
            vehicle_id: vehicleId, portal: "sauto",
            status: "error", last_export_at: new Date().toISOString(),
            last_error: e.message,
          }, { onConflict: "vehicle_id,portal" });
        }
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

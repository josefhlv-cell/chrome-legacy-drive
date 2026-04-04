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

function findBestMatch(vehicleName: string, carList: CarListEntry[]): { manufacturer_id: number; model_id: number; kind_id: number; body_id: number } | null {
  const nameLower = vehicleName.toLowerCase().trim();

  // Try to find manufacturer from first word(s) of vehicle name
  const manufacturers = [...new Set(carList.map(e => e.manufacturer_name))];
  let bestMfg = "";
  for (const mfg of manufacturers) {
    if (nameLower.startsWith(mfg.toLowerCase())) {
      if (mfg.length > bestMfg.length) bestMfg = mfg;
    }
  }

  if (!bestMfg) return null;

  // Find model in remaining text
  const remaining = nameLower.slice(bestMfg.length).trim();
  const mfgEntries = carList.filter(e => e.manufacturer_name.toLowerCase() === bestMfg.toLowerCase());

  let bestEntry: CarListEntry | null = null;
  let bestScore = 0;

  for (const entry of mfgEntries) {
    const modelLower = entry.model_name.toLowerCase();
    if (remaining.startsWith(modelLower) || remaining.includes(modelLower)) {
      const score = entry.model_name.length;
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
  }

  // Fallback: use "Ostatní" (Other) model
  if (!bestEntry) {
    bestEntry = mfgEntries.find(e => e.model_name === "Ostatní") || mfgEntries[0];
  }

  if (!bestEntry) return null;

  return {
    manufacturer_id: bestEntry.manufacturer_id,
    model_id: bestEntry.model_id,
    kind_id: bestEntry.kind_id,
    body_id: bestEntry.body_ids[0] || 9, // default SUV
  };
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

  try {
    const { vehicle_id, sauto_login, sauto_password, sauto_sw_key, overrides } = await req.json();

    if (!vehicle_id || !sauto_login || !sauto_password || !sauto_sw_key) {
      return new Response(JSON.stringify({ error: "Chybí povinné parametry (vehicle_id, sauto_login, sauto_password, sauto_sw_key)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch vehicle
    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicle_id)
      .single();
    if (vErr || !vehicle) throw new Error(`Vozidlo nenalezeno: ${vErr?.message}`);

    // Fetch images
    const { data: images } = await supabase
      .from("vehicle_images")
      .select("*")
      .eq("vehicle_id", vehicle_id)
      .order("sort_order");

    // Fetch carList and find matching manufacturer/model
    console.log("[Sauto] Fetching carList...");
    const carList = await fetchCarList();
    console.log(`[Sauto] CarList loaded: ${carList.length} entries`);

    const match = findBestMatch(vehicle.name, carList);
    if (!match && !overrides?.manufacturer_id) {
      return new Response(JSON.stringify({
        error: `Nepodařilo se automaticky najít výrobce/model pro "${vehicle.name}". Zadejte manufacturer_id, model_id a body_id ručně.`,
        suggestion: "Zkuste zadat overrides s hodnotami z číselníku Sauto.cz",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const manufacturerId = overrides?.manufacturer_id || match!.manufacturer_id;
    const modelId = overrides?.model_id || match!.model_id;
    const kindId = overrides?.kind_id || match!.kind_id || 1;
    const bodyId = overrides?.body_id || match!.body_id || 9;

    // Auth with Sauto
    console.log("[Sauto] Authenticating...");
    const sessionId = await sautoAuth(sauto_login, sauto_password, sauto_sw_key);
    console.log("[Sauto] Authenticated successfully");

    try {
      // Parse engine volume (ccm)
      let engineVolume = 0;
      if (vehicle.engine) {
        const ccmMatch = vehicle.engine.match(/(\d[\d\s]*)\s*ccm/i);
        if (ccmMatch) engineVolume = parseInt(ccmMatch[1].replace(/\s/g, ""));
      }

      // Parse engine power (kW)
      let enginePower = 0;
      if (vehicle.power) {
        const kwMatch = vehicle.power.match(/(\d+)\s*kW/i);
        if (kwMatch) enginePower = parseInt(kwMatch[1]);
      }

      // Build car_data
      const carData: Record<string, unknown> = {
        kind_id: kindId,
        manufacturer_id: manufacturerId,
        model_id: modelId,
        body_id: bodyId,
        condition: 2, // ojeté
        price: vehicle.price_with_vat,
        dph: 1,
        fuel: mapFuel(vehicle.fuel),
        tachometr: vehicle.mileage,
        tachometr_unit: 1, // km
        made_date: String(vehicle.year),
        state_id: 1, // ČR
        availability: 2, // Skladem
        custom_id: vehicle.id,
      };

      if (vehicle.vin) carData.vin = vehicle.vin;
      if (vehicle.color) carData.color = mapColor(vehicle.color);
      if (engineVolume > 0) carData.engine_volume = engineVolume;
      if (enginePower > 0) carData.engine_power = enginePower;
      if (vehicle.transmission) carData.gearbox = mapGearbox(vehicle.transmission);
      if (vehicle.description) carData.note = vehicle.description.slice(0, 1000);

      // Apply any manual overrides
      if (overrides) {
        for (const [key, val] of Object.entries(overrides)) {
          if (val !== undefined && val !== null && val !== "") {
            carData[key] = val;
          }
        }
      }

      console.log("[Sauto] Calling addEditCar...", JSON.stringify(carData));
      const addResult = await callXmlRpc("addEditCar", [sessionId, carData]);
      console.log("[Sauto] addEditCar result:", JSON.stringify(addResult));

      if (addResult.status !== 200) {
        const errorMsg = addResult.output?.error || addResult.status_message || `Status ${addResult.status}`;
        const errorItems = addResult.output?.error_items;
        throw new Error(`addEditCar failed: ${errorMsg}${errorItems ? " | " + JSON.stringify(errorItems) : ""}`);
      }

      const carId = addResult.output?.car_id;
      console.log(`[Sauto] Car created/updated with car_id: ${carId}`);

      // Upload photos
      let photosUploaded = 0;
      if (carId && images && images.length > 0) {
        for (let i = 0; i < images.length && i < 50; i++) {
          const img = images[i];
          try {
            console.log(`[Sauto] Downloading image ${i + 1}/${images.length}: ${img.image_url}`);
            const imgResp = await fetch(img.image_url);
            if (!imgResp.ok) {
              console.warn(`[Sauto] Failed to download image: ${imgResp.status}`);
              continue;
            }

            const imgBuffer = await imgResp.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));

            const photoData: Record<string, unknown> = {
              main: img.is_main ? 1 : (i + 2), // main=1 for primary, sequential for others
              b64: base64,
              alt: vehicle.name,
              client_photo_id: img.id,
            };

            console.log(`[Sauto] Uploading photo ${i + 1}...`);
            const photoResult = await callXmlRpc("addEditPhoto", [sessionId, carId, photoData]);
            console.log(`[Sauto] Photo ${i + 1} result:`, JSON.stringify(photoResult));

            if (photoResult.status === 200) {
              photosUploaded++;
            } else {
              console.warn(`[Sauto] Photo upload failed: ${photoResult.status_message}`);
            }
          } catch (photoErr) {
            console.warn(`[Sauto] Photo ${i + 1} error:`, photoErr);
          }
        }
      }

      // Logout
      try {
        await callXmlRpc("logout", [sessionId]);
      } catch (_) {
        // ignore logout errors
      }

      return new Response(JSON.stringify({
        success: true,
        car_id: carId,
        photos_uploaded: photosUploaded,
        photos_total: images?.length || 0,
        matched_manufacturer: match?.manufacturer_id ? `ID ${match.manufacturer_id}` : "manual",
        matched_model: match?.model_id ? `ID ${match.model_id}` : "manual",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err) {
      // Try to logout even on error
      try { await callXmlRpc("logout", [sessionId]); } catch (_) {}
      throw err;
    }

  } catch (err: any) {
    console.error("[Sauto] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

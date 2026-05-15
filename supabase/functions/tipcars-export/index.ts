import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { zipSync } from "https://esm.sh/fflate@0.8.2";
import SftpClient from "npm:ssh2-sftp-client@10.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Fuel mapping: our DB → TipCars kód (CiselnikyXmlImport.xml verze 5.06) ───
// A=benzin, B=nafta, C=LPG, D=ethanol, E=elektro, F=hybridní-benzin,
// G=vodík, H=CNG, J=LNG, K=hybridní-nafta
function mapFuel(fuel: string): { kod: string; popis: string } {
  const f = (fuel || "").toLowerCase();
  // Hybrid first — text often contains both "ba 95" and "hybrid"
  if (f.includes("hybrid")) {
    if (f.includes("nafta") || f.includes("diesel")) return { kod: "K", popis: "hybridní - nafta" };
    return { kod: "F", popis: "hybridní - benzin" };
  }
  if (f.includes("lpg")) return { kod: "C", popis: "LPG" };
  if (f.includes("cng")) return { kod: "H", popis: "CNG" };
  if (f.includes("lng")) return { kod: "J", popis: "LNG" };
  if (f.includes("ethanol") || f.includes("e85")) return { kod: "D", popis: "ethanol" };
  if (f.includes("elektr") || f.includes("electric")) return { kod: "E", popis: "elektro" };
  if (f.includes("vodík") || f.includes("vodik") || f.includes("hydrogen")) return { kod: "G", popis: "vodík" };
  if (f.includes("nafta") || f.includes("diesel")) return { kod: "B", popis: "nafta" };
  return { kod: "A", popis: "benzin" };
}

// ─── Color mapping → TipCars BARVA codes ───
// Detekuje metalízu (suffix M), např. WBM = bílá metalíza.
function mapColor(color: string): { kod: string; popis: string } {
  const c = (color || "").toLowerCase();
  const isMet = c.includes("metalíz") || c.includes("metaliz") || c.includes("perl");
  const pick = (base: string, label: string): { kod: string; popis: string } => ({
    kod: isMet ? `${base}M` : base,
    popis: isMet ? `${label} metalíza` : label,
  });
  if (c.includes("bíl") || c.includes("bil") || c.includes("white"))   return pick("WB", "bílá");
  if (c.includes("čern") || c.includes("cern") || c.includes("black")) return pick("CB", "černá");
  if (c.includes("stříbr") || c.includes("stribr") || c.includes("silver")) return pick("SB", "stříbrná");
  if (c.includes("šed") || c.includes("sed") || c.includes("grey") || c.includes("gray")) return pick("EB", "šedá");
  if (c.includes("tmavě modr") || c.includes("tmave modr") || c.includes("dark blue")) return pick("BD", "tmavě modrá");
  if (c.includes("světle modr") || c.includes("svetle modr")) return pick("BC", "světle modrá");
  if (c.includes("modr") || c.includes("blue"))   return pick("BB", "modrá");
  if (c.includes("tmavě červen") || c.includes("tmave cerven")) return pick("RD", "tmavě červená");
  if (c.includes("červen") || c.includes("cerven") || c.includes("red")) return pick("RB", "červená");
  if (c.includes("vínov") || c.includes("vinov"))  return pick("VB", "vínová");
  if (c.includes("tmavě zelen") || c.includes("tmave zelen")) return pick("GD", "tmavě zelená");
  if (c.includes("zelen") || c.includes("green"))  return pick("GB", "zelená");
  if (c.includes("žlut") || c.includes("zlut") || c.includes("yellow")) return { kod: "YB", popis: "žlutá" };
  if (c.includes("tmavě hněd") || c.includes("tmave hned")) return pick("ND", "tmavě hnědá");
  if (c.includes("hněd") || c.includes("hned") || c.includes("brown")) return pick("NB", "hnědá");
  if (c.includes("oranž") || c.includes("oranz") || c.includes("orange")) return pick("OB", "oranžová");
  if (c.includes("béžov") || c.includes("bezov") || c.includes("beige")) return pick("BE", "béžová");
  if (c.includes("fialov") || c.includes("purple")) return pick("FB", "fialová");
  if (c.includes("růžov") || c.includes("ruzov") || c.includes("pink")) return { kod: "ZB", popis: "růžová" };
  if (c.includes("zlat") || c.includes("gold")) return { kod: "QBM", popis: "zlatá metalíza" };
  return { kod: "", popis: color.slice(0, 20) };
}

// ─── Transmission → gearbox equipment code ───
function mapTransmission(transmission: string): string | null {
  const t = transmission.toLowerCase();
  if (t.includes("automat")) return "04";
  return null;
}

// ─── XML builder helpers ───
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function extractBrand(name: string): string {
  const brands = [
    "Alfa Romeo", "Aston Martin", "Audi", "BMW", "Bentley", "Cadillac",
    "Chevrolet", "Chrysler", "Citroën", "Citroen", "Dacia", "Dodge",
    "Ferrari", "Fiat", "Ford", "Honda", "Hyundai", "Infiniti",
    "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus",
    "Lincoln", "Lotus", "Maserati", "Mazda", "McLaren", "Mercedes-Benz",
    "Mercedes", "Mini", "Mitsubishi", "Nissan", "Opel", "Peugeot",
    "Porsche", "RAM", "Renault", "Rolls-Royce", "Seat", "Skoda", "Škoda",
    "Smart", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
  ];
  const nameLower = name.toLowerCase();
  for (const b of brands) {
    if (nameLower.startsWith(b.toLowerCase())) return b;
  }
  return name.split(" ")[0];
}

function extractModel(name: string): string {
  const brand = extractBrand(name);
  return name.slice(brand.length).trim() || name;
}

// TipCars vyžaduje, aby <znacka_model> obsahoval kód značky a modelu z aktuálního
// CiselnikyXmlImport.xml. Mapujeme z názvu vozu — viz src/lib/tipcarsCodebook.ts.
type TipCarsCode = { znacka_kod: string; znacka: string; model_kod: string; model: string };

const TIPCARS_MAP: Array<{ keywords: string[]; code: TipCarsCode }> = [
  { keywords: ["pacifica"],      code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "AST", model: "Pacifica" } },
  { keywords: ["grand voyager"], code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASG", model: "Grand Voyager" } },
  { keywords: ["grand caravan"], code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRL", model: "Grand Caravan" } },
  { keywords: ["town"],          code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASP", model: "Town & Country" } },
  { keywords: ["300c", "300 c"], code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASU", model: "300C" } },
  { keywords: ["300m"],          code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASJ", model: "300M" } },
  { keywords: ["voyager"],       code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASF", model: "Voyager" } },
  { keywords: ["sebring"],       code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASO", model: "Sebring" } },
  { keywords: ["crossfire"],     code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASV", model: "Crossfire" } },
  { keywords: ["pt cruiser"],    code: { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASS", model: "PT Cruiser" } },
  { keywords: ["challenger"],    code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRT", model: "Challenger" } },
  { keywords: ["charger"],       code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRU", model: "Charger" } },
  { keywords: ["durango"],       code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRG", model: "Durango" } },
  { keywords: ["ram 1500"],      code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CR0", model: "RAM 1500" } },
  { keywords: ["ram"],           code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRF", model: "RAM" } },
  { keywords: ["caravan"],       code: { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRE", model: "Caravan" } },
  { keywords: ["flavia"],        code: { znacka_kod: "AW", znacka: "Lancia",   model_kod: "AWM", model: "Flavia" } },
  { keywords: ["thema"],         code: { znacka_kod: "AW", znacka: "Lancia",   model_kod: "AWE", model: "Thema" } },
  { keywords: ["delta"],         code: { znacka_kod: "AW", znacka: "Lancia",   model_kod: "AWB", model: "Delta" } },
];

function detectTipCarsCode(name: string): TipCarsCode {
  const lower = (name || "").toLowerCase();

  // Brand-aware special cases (must run first to avoid Chrysler/Dodge collision)
  if (lower.includes("grand caravan")) {
    if (lower.includes("chrysler")) return { znacka_kod: "AS", znacka: "Chrysler", model_kod: "AS2", model: "Grand Caravan" };
    return { znacka_kod: "CR", znacka: "Dodge", model_kod: "CRL", model: "Grand Caravan" };
  }
  if (lower.includes("voyager") && lower.includes("lancia"))
    return { znacka_kod: "AW", znacka: "Lancia", model_kod: "AWL", model: "Voyager" };

  let best: { idx: number; code: TipCarsCode } | null = null;
  for (const e of TIPCARS_MAP) {
    for (const kw of e.keywords) {
      const i = lower.indexOf(kw);
      if (i >= 0 && (!best || i < best.idx)) best = { idx: i, code: e.code };
    }
  }
  if (best) return best.code;
  if (lower.includes("chrysler")) return { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASZ", model: "Ostatní" };
  if (lower.includes("dodge"))    return { znacka_kod: "CR", znacka: "Dodge",    model_kod: "CRZ", model: "Ostatní" };
  if (lower.includes("lancia"))   return { znacka_kod: "AW", znacka: "Lancia",   model_kod: "AWZ", model: "Ostatní" };
  return { znacka_kod: "AS", znacka: "Chrysler", model_kod: "ASZ", model: "Ostatní" };
}

function buildInzeratXml(
  vehicle: any,
  images: any[],
  adNumber: number,
  kodFirmy: string,
  opts: { skipPhotos?: boolean; existingPhotoCount?: number } = {},
): { xml: string; photoFiles: { name: string; url: string }[] } {
  const cislo = pad4(adNumber);
  const skipPhotos = !!opts.skipPhotos;
  const today = new Date().toISOString().split("T")[0];
  const fuel = mapFuel(vehicle.fuel || "");
  const color = mapColor(vehicle.color || "");

  let engineVolume = 0;
  if (vehicle.engine) {
    const ccmMatch = vehicle.engine.match(/(\d[\d\s]*)\s*ccm/i);
    if (ccmMatch) engineVolume = parseInt(ccmMatch[1].replace(/\s/g, ""));
  }

  let power = 0;
  if (vehicle.power) {
    const kwMatch = vehicle.power.match(/(\d+)\s*kW/i);
    if (kwMatch) power = parseInt(kwMatch[1]);
  }

  const photoFiles: { name: string; url: string }[] = [];
  const photoCodes: string[] = [];
  if (skipPhotos) {
    // Already-uploaded vehicle: keep references to existing photos on TipCars
    // server (kept under same kod_firmy_cislo_*) — do NOT include the actual
    // image bytes in this ZIP. seznam_kodu mirrors the previously sent count.
    const n = Math.max(0, opts.existingPhotoCount || 0);
    for (let p = 1; p <= n; p++) photoCodes.push(String(p));
  } else {
    images.forEach((img, i) => {
      const photoNum = i + 1;
      // Per TipCars spec: kod_firmy_cislo_inzeratu_poradi.jpg
      const fileName = `${kodFirmy}_${cislo}_${photoNum}.jpg`;
      photoFiles.push({ name: fileName, url: img.image_url });
      photoCodes.push(String(photoNum));
    });
  }

  // Equipment (vybava) — codes must come from CiselnikyXmlImport.xml seznam_vybav.
  // Until we mirror & validate the codebook, we DO NOT emit any <vybava> entries.
  // Posting unverified codes ("32", "EN", etc.) is what causes TipCars to reject the batch.
  const equipmentItems: string[] = [];

  const modelInfo = detectTipCarsCode(vehicle.name || "");
  const modelKod = modelInfo.model_kod;

  // Cap cislo_inzeratu at 6999 per spec (4.65: range changed from 0001-9999 to 0001-6999)
  const safeAdNumber = ((adNumber - 1) % 6999) + 1;
  const cisloFinal = pad4(safeAdNumber);

  // <karoserie> — emit ONLY if a valid kod from the codebook is selected.
  const karoserieXml = vehicle.tipcars_karoserie_kod
    ? `\t\t<karoserie>\n\t\t\t<kod>${escapeXml(vehicle.tipcars_karoserie_kod)}</kod>\n\t\t\t<popis>${escapeXml(vehicle.tipcars_karoserie_popis || "")}</popis>\n\t\t</karoserie>\n`
    : "";

  // <barva> — if our color mapping does not produce a valid codebook kod,
  // omit <kod> entirely and send only the textual description (per spec, point 2 of <popis>).
  const barvaXml = color.kod
    ? `\t\t<barva>\n\t\t\t<kod>${color.kod}</kod>\n\t\t\t<popis>${escapeXml(color.popis)}</popis>\n\t\t</barva>\n`
    : (color.popis
        ? `\t\t<barva>\n\t\t\t<popis>${escapeXml(color.popis)}</popis>\n\t\t</barva>\n`
        : "");

  const xml = `\t<inzerat>
\t\t<cislo_inzeratu>${cisloFinal}</cislo_inzeratu>
\t\t<datum>${today}</datum>
${vehicle.vin ? `\t\t<vin>${escapeXml(vehicle.vin)}</vin>\n\t\t<vin_verejny>A</vin_verejny>\n` : ""}\t\t<kategorie>
\t\t\t<kod>O</kod>
\t\t\t<popis>Ojetý</popis>
\t\t</kategorie>
\t\t<skupina>
\t\t\t<kod>A</kod>
\t\t\t<popis>Osobní</popis>
\t\t</skupina>
\t\t<znacka_model>
\t\t\t<kod>${escapeXml(modelKod)}</kod>
\t\t\t<popis_znacka>${escapeXml(modelInfo.znacka)}</popis_znacka>
\t\t\t<popis_model>${escapeXml(modelInfo.model)}</popis_model>
\t\t</znacka_model>
${karoserieXml}${barvaXml}\t\t<palivo>
\t\t\t<kod>${fuel.kod}</kod>
\t\t\t<popis>${escapeXml(fuel.popis)}</popis>
\t\t</palivo>
\t\t<tachometr>
\t\t\t<najeto>${vehicle.mileage || 0}</najeto>
\t\t\t<kod_jednotky>A</kod_jednotky>
\t\t\t<popis_jednotky>km</popis_jednotky>
\t\t</tachometr>
\t\t<rok_vyroby>${vehicle.year}</rok_vyroby>
\t\t<cenove_udaje>
\t\t\t<cena>${vehicle.show_vat ? Math.round(vehicle.price_with_vat * 1.21) : vehicle.price_with_vat}</cena>
\t\t\t<dph>${vehicle.show_vat ? "A" : "N"}</dph>
\t\t\t<kod_meny>A</kod_meny>
\t\t\t<popis_meny>Kč</popis_meny>
\t\t</cenove_udaje>
\t\t<ekologicka_dan>N</ekologicka_dan>
${engineVolume > 0 ? `\t\t<obsah_motoru>${engineVolume}</obsah_motoru>\n` : ""}\t\t<prvni_majitel>${vehicle.tipcars_prvni_majitel ? "A" : "N"}</prvni_majitel>
\t\t<servisni_knizka>${vehicle.tipcars_servisni_knizka ? "A" : "N"}</servisni_knizka>
${vehicle.description ? `\t\t<poznamka>${escapeXml(vehicle.description.slice(0, 3000))}</poznamka>\n` : ""}${power > 0 ? `\t\t<vykon_motoru>\n\t\t\t<vykon>${power}</vykon>\n\t\t\t<kod_jednotky>A</kod_jednotky>\n\t\t\t<popis_jednotky>kW</popis_jednotky>\n\t\t</vykon_motoru>\n` : ""}\t\t<nebourane>${vehicle.tipcars_nebourane === false ? "N" : "A"}</nebourane>
\t\t<mista>${vehicle.tipcars_pocet_mist || 5}</mista>
\t\t<dvere>${vehicle.tipcars_pocet_dveri || 5}</dvere>
${vehicle.tipcars_stk_do ? `\t\t<stk>${vehicle.tipcars_stk_do.slice(0, 7)}</stk>\n` : ""}\t\t<fotky>
\t\t\t<seznam_kodu>${photoCodes.join(",")}</seznam_kodu>
\t\t</fotky>
\t</inzerat>`;

  return { xml, photoFiles };
}

function buildFullXml(
  kodFirmy: string,
  heslo: string,
  firmaNazev: string,
  firmaInfo: { ulice?: string; psc?: string; mesto?: string; telefon?: string; email?: string; www?: string },
  inzeraty: string[],
  testMode: boolean
): string {
  // Per TipCars docs (XmlVstupSchema verze 5.10):
  // "<test> - nepovinný. Element neobsahuje žádný údaj a pokud ano, tak je ignorován.
  //  Přítomnost tohoto elementu určuje, že při příjmu na serveru TipCars jsou
  //  inzertní data zapracována jen pro testovací účely."
  // ⇒ Mere PRESENCE of <test/> (even empty!) marks the batch as TEST.
  // For LIVE publishing, the element MUST be omitted entirely.
  const testTag = testMode ? "\t\t<test/>\n" : "";
  return `<?xml version="1.0" encoding="UTF-8" ?>
<tipcars xmlns:xs="http://www.w3.org/2001/XMLSchema">
\t<firma>
${testTag}\t\t<kod_firmy>${escapeXml(kodFirmy)}</kod_firmy>
\t\t<heslo>${escapeXml(heslo)}</heslo>
\t\t<jazyk>C</jazyk>
\t\t<verze>5.05</verze>
\t\t<nazev>${escapeXml(firmaNazev)}</nazev>
\t\t<ulice>${escapeXml(firmaInfo.ulice || "")}</ulice>
\t\t<psc>${escapeXml((firmaInfo.psc || "").replace(/\s+/g, ""))}</psc>
\t\t<mesto>${escapeXml(firmaInfo.mesto || "")}</mesto>
\t\t<telefon>${escapeXml(firmaInfo.telefon || "")}</telefon>
\t\t<email>${escapeXml(firmaInfo.email || "")}</email>
\t\t<www>${escapeXml(firmaInfo.www || "")}</www>
\t\t<cinnosti>S</cinnosti>
\t</firma>
${inzeraty.join("\n")}
</tipcars>`;
}

// ─── Minimal FTP client using Deno TCP ───
class FtpClient {
  private conn!: Deno.TcpConn;
  private reader!: ReadableStreamDefaultReader<Uint8Array>;
  private buffer = "";
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  async connect(host: string, port = 21): Promise<string> {
    this.conn = await Deno.connect({ hostname: host, port });
    this.reader = this.conn.readable.getReader();
    return await this.readResponse();
  }

  private async readResponse(): Promise<string> {
    while (true) {
      const { value, done } = await this.reader.read();
      if (done) throw new Error("FTP connection closed");
      this.buffer += this.decoder.decode(value, { stream: true });
      
      const lines = this.buffer.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const match = line.match(/^(\d{3})([ -])/);
        if (match && match[2] === " ") {
          const response = lines.slice(0, i + 1).join("\r\n");
          this.buffer = lines.slice(i + 1).join("\r\n");
          return response;
        }
      }
    }
  }

  async sendCommand(cmd: string): Promise<string> {
    const writer = this.conn.writable.getWriter();
    await writer.write(this.encoder.encode(cmd + "\r\n"));
    writer.releaseLock();
    return await this.readResponse();
  }

  async login(user: string, pass: string): Promise<void> {
    const userResp = await this.sendCommand(`USER ${user}`);
    console.log(`[FTP] USER: ${userResp.trim()}`);
    if (userResp.startsWith("331")) {
      const passResp = await this.sendCommand(`PASS ${pass}`);
      console.log(`[FTP] PASS: ${passResp.trim()}`);
      if (!passResp.startsWith("230")) {
        throw new Error(`FTP login failed: ${passResp.trim()}`);
      }
    } else if (!userResp.startsWith("230")) {
      throw new Error(`FTP USER failed: ${userResp.trim()}`);
    }
  }

  async passive(): Promise<{ host: string; port: number }> {
    const resp = await this.sendCommand("PASV");
    console.log(`[FTP] PASV: ${resp.trim()}`);
    const match = resp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
    if (!match) throw new Error(`Cannot parse PASV response: ${resp}`);
    const host = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
    const port = parseInt(match[5]) * 256 + parseInt(match[6]);
    return { host, port };
  }

  async uploadFile(remotePath: string, data: Uint8Array): Promise<string> {
    await this.sendCommand("TYPE I");
    const { host, port } = await this.passive();

    const dataConn = await Deno.connect({ hostname: host, port });

    const storResp = this.sendCommand(`STOR ${remotePath}`);

    const writer = dataConn.writable.getWriter();
    await writer.write(data);
    await writer.close();

    const resp = await storResp;
    console.log(`[FTP] STOR: ${resp.trim()}`);
    if (!resp.startsWith("150") && !resp.startsWith("125")) {
      throw new Error(`STOR rejected: ${resp.trim()}`);
    }

    const transferResp = await this.readResponse();
    console.log(`[FTP] Transfer: ${transferResp.trim()}`);
    if (!transferResp.startsWith("226") && !transferResp.startsWith("250")) {
      throw new Error(`Transfer not confirmed (expected 226): ${transferResp.trim()}`);
    }

    return transferResp;
  }

  async quit(): Promise<void> {
    try {
      await this.sendCommand("QUIT");
    } catch {
      // ignore
    }
    try {
      this.conn.close();
    } catch {
      // ignore
    }
  }
}

// ─── Hash + validation + DB logger ───
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function validateTipcarsXml(xml: string): { ok: boolean; error?: string } {
  if (!xml.startsWith("<?xml")) return { ok: false, error: "Missing XML declaration" };
  if (!xml.includes("<tipcars")) return { ok: false, error: "Missing <tipcars> root" };
  if (!xml.includes("</tipcars>")) return { ok: false, error: "Unclosed <tipcars> root" };
  if (!xml.includes("<firma>")) return { ok: false, error: "Missing <firma> block" };
  // crude tag balance check on key elements
  const opens = (xml.match(/<inzerat>/g) || []).length;
  const closes = (xml.match(/<\/inzerat>/g) || []).length;
  if (opens !== closes) return { ok: false, error: `Unbalanced <inzerat>: ${opens} open vs ${closes} close` };
  if (opens === 0) return { ok: false, error: "No <inzerat> entries" };
  return { ok: true };
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

async function ftpUploadWithRetry(opts: { host: string; user: string; pass: string; filename: string; data: Uint8Array; maxAttempts?: number; }): Promise<{ ok: boolean; message: string; attempts: number; lastResponse?: string; }> {
  const max = opts.maxAttempts ?? 3;
  let lastErr = "";
  let lastResp = "";
  for (let attempt = 1; attempt <= max; attempt++) {
    const ftp = new FtpClient();
    try {
      console.log(`[TipCars] FTP attempt ${attempt}/${max} → ${opts.host}`);
      const welcome = await ftp.connect(opts.host, 21);
      console.log(`[TipCars] welcome: ${welcome.trim()}`);
      await ftp.login(opts.user, opts.pass);
      const tr = await ftp.uploadFile(opts.filename, opts.data);
      lastResp = tr;
      await ftp.quit();
      return { ok: true, message: `226 Transfer complete (attempt ${attempt})`, attempts: attempt, lastResponse: tr.trim() };
    } catch (err) {
      lastErr = (err as Error).message;
      console.warn(`[TipCars] FTP attempt ${attempt} failed: ${lastErr}`);
      try { await ftp.quit(); } catch { /* ignore */ }
      if (attempt < max) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return { ok: false, message: lastErr || "FTP upload failed", attempts: max, lastResponse: lastResp };
}

// ─── SFTP upload via npm:ssh2-sftp-client ───
async function sftpUploadWithRetry(opts: { host: string; port: number; user: string; pass: string; filename: string; data: Uint8Array; maxAttempts?: number; }): Promise<{ ok: boolean; message: string; attempts: number; lastResponse?: string; }> {
  const max = opts.maxAttempts ?? 3;
  let lastErr = "";
  for (let attempt = 1; attempt <= max; attempt++) {
    const sftp = new SftpClient();
    try {
      console.log(`[TipCars] SFTP attempt ${attempt}/${max} → ${opts.host}:${opts.port}`);
      await sftp.connect({ host: opts.host, port: opts.port, username: opts.user, password: opts.pass, readyTimeout: 20000 });
      // Convert Uint8Array → Buffer for ssh2
      // @ts-ignore - Buffer is available via Node compat in Deno
      const buf = (globalThis as any).Buffer ? (globalThis as any).Buffer.from(opts.data) : opts.data;
      await sftp.put(buf, `/${opts.filename}`);
      await sftp.end();
      return { ok: true, message: `SFTP upload OK (attempt ${attempt})`, attempts: attempt, lastResponse: "OK" };
    } catch (err) {
      lastErr = (err as Error).message;
      console.warn(`[TipCars] SFTP attempt ${attempt} failed: ${lastErr}`);
      try { await sftp.end(); } catch { /* ignore */ }
      if (attempt < max) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return { ok: false, message: lastErr || "SFTP upload failed", attempts: max };
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    let {
      vehicle_ids,
      tipcars_kod_firmy,
      tipcars_heslo,
      firma_nazev,
      firma_info = {},
      ftp_host,
      ftp_user,
      ftp_password,
      sftp_host,
      sftp_port,
      sftp_user,
      sftp_password,
      use_sftp,
      test_mode,
      dry_run = false,
      use_settings = false,
    } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optionally load credentials & defaults from tipcars_settings table.
    // The `test_mode` flag chooses between the TEST credential set (sftp_*, kod_firmy, heslo)
    // and the LIVE credential set (live_sftp_*, live_kod_firmy, live_heslo).
    if (use_settings) {
      const { data: s } = await supabase.from("tipcars_settings").select("*").limit(1).maybeSingle();
      if (s) {
        // SAFETY LOCK: if test_mode_locked is on, force test_mode = true regardless of caller intent.
        // This prevents accidental LIVE publishing while TipCars hasn't approved the production import.
        if ((s as any).test_mode_locked) {
          test_mode = true;
        } else if (test_mode === undefined) {
          test_mode = s.test_mode;
        }
        const useLive = !test_mode;


        if (useLive) {
          tipcars_kod_firmy = tipcars_kod_firmy || s.live_kod_firmy;
          tipcars_heslo = tipcars_heslo || s.live_heslo;
          sftp_host = sftp_host || s.live_sftp_host;
          sftp_port = sftp_port || s.live_sftp_port;
          sftp_user = sftp_user || s.live_sftp_user;
          sftp_password = sftp_password || s.live_sftp_password;

          if (!tipcars_kod_firmy || !sftp_host || !sftp_user || !sftp_password) {
            return new Response(JSON.stringify({
              success: false,
              error: "Pro OSTRÝ provoz nejsou vyplněny přihlašovací údaje (live_*). Doplň je v admin → TipCars → OSTRÝ provoz, nebo přepni na TEST.",
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else {
          tipcars_kod_firmy = tipcars_kod_firmy || s.kod_firmy;
          tipcars_heslo = tipcars_heslo || s.heslo;
          sftp_host = sftp_host || s.sftp_host;
          sftp_port = sftp_port || s.sftp_port;
          sftp_user = sftp_user || s.sftp_user;
          sftp_password = sftp_password || s.sftp_password;
        }

        firma_nazev = firma_nazev || s.firma_nazev;
        firma_info = {
          ulice: firma_info.ulice || s.firma_ulice,
          psc: firma_info.psc || s.firma_psc,
          mesto: firma_info.mesto || s.firma_mesto,
          telefon: firma_info.telefon || s.firma_telefon,
          email: firma_info.email || s.firma_email,
          www: firma_info.www || s.firma_www,
        };
        // Default to plain FTP — ssh2-sftp-client is incompatible with Deno
        if (use_sftp === undefined) use_sftp = false;
        // Mirror SFTP creds onto FTP fields so plain FTP path uses the configured host
        ftp_host = ftp_host || sftp_host;
        ftp_user = ftp_user || sftp_user;
        ftp_password = ftp_password || sftp_password;
      }
    }

    if (test_mode === undefined) test_mode = false;

    firma_nazev = firma_nazev || "Chrysler Pardubice";
    ftp_host = ftp_host || "ftp.tipcars.com";

    if (!vehicle_ids || !Array.isArray(vehicle_ids) || vehicle_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Chybí vehicle_ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tipcars_kod_firmy || !tipcars_heslo) {
      return new Response(JSON.stringify({ error: "Chybí tipcars_kod_firmy nebo tipcars_heslo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logExport(supabase, {
      portal: "tipcars",
      operation: "export",
      level: "info",
      message: `Export started: ${vehicle_ids.length} vehicles (${test_mode ? "TEST" : "LIVE"}${dry_run ? " · DRY RUN" : ""})`,
      context: { vehicle_ids, test_mode, dry_run, target_host: ftp_host },
    });

    // ─── NEW vehicles (full export with photos) ───
    const { data: newVehicles, error: vErr } = await supabase
      .from("vehicles")
      .select("*")
      .in("id", vehicle_ids);
    if (vErr) throw new Error(`Chyba načítání vozidel: ${vErr.message}`);
    if (!newVehicles || newVehicles.length === 0) throw new Error("Žádná vozidla nenalezena");

    // ─── Inkrementální logika: doplň VŠECHNA již nahraná vozidla bez fotek ───
    // TipCars vyžaduje, aby každý import obsahoval kompletní inventář (jinak
    // zmizí z portálu vše, co v souboru není). Existující vozy posíláme bez
    // photo bytes – TipCars u nich ponechá fotky uložené z minulých dávek.
    const { data: existingExports } = await supabase
      .from("vehicle_exports")
      .select("vehicle_id, external_id, metadata, status")
      .eq("portal", "tipcars")
      .neq("status", "removed");

    const newIdSet = new Set<string>(vehicle_ids);
    const carriedIds = (existingExports || [])
      .map((e: any) => e.vehicle_id)
      .filter((id: string) => !newIdSet.has(id));

    let carriedVehicles: any[] = [];
    if (carriedIds.length > 0) {
      const { data: cv } = await supabase
        .from("vehicles")
        .select("*")
        .in("id", carriedIds);
      carriedVehicles = cv || [];
    }

    // Stable cislo_inzeratu allocator. Reuse persisted number from
    // vehicle_exports.metadata.cislo_inzeratu when present so TipCars
    // photos (named kod_firmy_cislo_*) keep matching after re-uploads.
    const cisloByVehicle = new Map<string, number>();
    const photoCountByVehicle = new Map<string, number>();
    const used = new Set<number>();
    for (const e of (existingExports || []) as any[]) {
      const c = Number(e.metadata?.cislo_inzeratu);
      if (Number.isFinite(c) && c > 0) {
        cisloByVehicle.set(e.vehicle_id, c);
        used.add(c);
      }
      const p = Number(e.metadata?.photos);
      if (Number.isFinite(p) && p >= 0) photoCountByVehicle.set(e.vehicle_id, p);
    }
    let nextCislo = 1;
    const allocCislo = (vid: string): number => {
      const existing = cisloByVehicle.get(vid);
      if (existing) return existing;
      while (used.has(nextCislo)) nextCislo++;
      const c = nextCislo;
      used.add(c);
      cisloByVehicle.set(vid, c);
      return c;
    };

    const allInzeratyXml: string[] = [];
    const allPhotoFiles: { name: string; data: Uint8Array }[] = [];
    const perVehicle: Array<{ id: string; photos: number; cislo: number; carried: boolean }> = [];
    let photosDownloaded = 0;

    // 1) NEW vehicles → full export with photos
    for (const vehicle of newVehicles) {
      const adNumber = allocCislo(vehicle.id);
      const { data: images } = await supabase
        .from("vehicle_images")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .order("sort_order");

      const { xml, photoFiles } = buildInzeratXml(
        vehicle, images || [], adNumber, tipcars_kod_firmy,
      );
      allInzeratyXml.push(xml);
      let vehiclePhotoCount = 0;

      for (const pf of photoFiles) {
        try {
          const resp = await fetch(pf.url);
          if (!resp.ok) {
            await logExport(supabase, {
              vehicle_id: vehicle.id, portal: "tipcars", operation: "photo", level: "warn",
              message: `Photo HTTP ${resp.status}: ${pf.name}`, context: { url: pf.url },
            });
            continue;
          }
          const buf = await resp.arrayBuffer();
          allPhotoFiles.push({ name: pf.name, data: new Uint8Array(buf) });
          photosDownloaded++;
          vehiclePhotoCount++;
        } catch (err) {
          await logExport(supabase, {
            vehicle_id: vehicle.id, portal: "tipcars", operation: "photo", level: "warn",
            message: `Photo download error: ${(err as Error).message}`, context: { url: pf.url },
          });
        }
      }
      perVehicle.push({ id: vehicle.id, photos: vehiclePhotoCount, cislo: adNumber, carried: false });
    }

    // 2) CARRIED vehicles → XML only, NO photo bytes (server keeps existing)
    for (const vehicle of carriedVehicles) {
      const adNumber = allocCislo(vehicle.id);
      const existingPhotoCount = photoCountByVehicle.get(vehicle.id) || 0;
      const { xml } = buildInzeratXml(
        vehicle, [], adNumber, tipcars_kod_firmy,
        { skipPhotos: true, existingPhotoCount },
      );
      allInzeratyXml.push(xml);
      perVehicle.push({ id: vehicle.id, photos: existingPhotoCount, cislo: adNumber, carried: true });
    }

    await logExport(supabase, {
      portal: "tipcars", operation: "export", level: "info",
      message: `Batch: ${newVehicles.length} new (with photos) + ${carriedVehicles.length} carried (no photos)`,
      context: { new_count: newVehicles.length, carried_count: carriedVehicles.length },
    });

    const vehicles = [...newVehicles, ...carriedVehicles];

    const xmlContent = buildFullXml(
      tipcars_kod_firmy, tipcars_heslo, firma_nazev, firma_info, allInzeratyXml, !!test_mode,
    );

    // ─── Validate XML ───
    const validation = validateTipcarsXml(xmlContent);
    if (!validation.ok) {
      await logExport(supabase, {
        portal: "tipcars", operation: "validate", level: "error",
        message: `XML validation failed: ${validation.error}`,
        context: { xml_preview: xmlContent.slice(0, 500) },
      });
      throw new Error(`XML validace selhala: ${validation.error}`);
    }

    const payloadHash = await sha256Hex(xmlContent);
    console.log(`[TipCars] XML OK, ${vehicles.length} vehicles, ${photosDownloaded} photos, hash=${payloadHash.slice(0, 12)}`);

    // Test mode: stop here
    // Dry run: stop after building/validating XML, do not ZIP or upload
    if (dry_run) {
      await logExport(supabase, {
        portal: "tipcars", operation: "export", level: "info",
        message: `DRY RUN OK — XML valid, ${vehicles.length} vehicles, ${photosDownloaded} photos (${test_mode ? "TEST" : "LIVE"})`,
        context: { xml_size: xmlContent.length, payload_hash: payloadHash, test_mode },
      });
      return new Response(JSON.stringify({
        success: true, dry_run: true, test_mode,
        vehicles_count: vehicles.length, photos_count: photosDownloaded,
        xml_size: xmlContent.length, payload_hash: payloadHash,
        xml_preview: xmlContent.slice(0, 1000),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Build ZIP ───
    const zipData: Record<string, Uint8Array> = {};
    zipData["inzerce.xml"] = new TextEncoder().encode(xmlContent);
    for (const pf of allPhotoFiles) zipData[pf.name] = pf.data;
    const zipped = zipSync(zipData);

    const now = new Date();
    const dateStr = [
      now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0"),
    ].join("_");
    const zipFileName = `${tipcars_kod_firmy}_${dateStr}.zip`;

    // ─── FTP upload with retry ───
    let ftpUploaded = false;
    let ftpMessage = "";
    let ftpAttempts = 0;
    let ftpResponse = "";

    if (use_sftp && sftp_host && sftp_user && sftp_password) {
      const result = await sftpUploadWithRetry({
        host: sftp_host, port: sftp_port || 22, user: sftp_user, pass: sftp_password,
        filename: zipFileName, data: zipped, maxAttempts: 3,
      });
      ftpUploaded = result.ok;
      ftpMessage = result.message;
      ftpAttempts = result.attempts;
      ftpResponse = result.lastResponse || "";

      await logExport(supabase, {
        portal: "tipcars", operation: "sftp", level: result.ok ? "info" : "error",
        message: `SFTP ${result.ok ? "OK" : "FAILED"} (${ftpAttempts} attempts): ${ftpMessage}`,
        context: { filename: zipFileName, host: sftp_host, port: sftp_port },
      });
    } else if (ftp_user && ftp_password) {
      const result = await ftpUploadWithRetry({
        host: ftp_host, user: ftp_user, pass: ftp_password,
        filename: zipFileName, data: zipped, maxAttempts: 3,
      });
      ftpUploaded = result.ok;
      ftpMessage = result.message;
      ftpAttempts = result.attempts;
      ftpResponse = result.lastResponse || "";

      await logExport(supabase, {
        portal: "tipcars", operation: "ftp", level: result.ok ? "info" : "error",
        message: `FTP ${result.ok ? "OK" : "FAILED"} (${ftpAttempts} attempts): ${ftpMessage}`,
        context: { filename: zipFileName, host: ftp_host, response: ftpResponse },
      });
    }

    // Storage backup
    const { error: uploadErr } = await supabase.storage
      .from("vehicles")
      .upload(`tipcars-export/${zipFileName}`, zipped, {
        contentType: "application/zip", upsert: true,
      });
    if (uploadErr) console.warn(`[TipCars] Storage upload warning: ${uploadErr.message}`);
    const { data: urlData } = supabase.storage
      .from("vehicles").getPublicUrl(`tipcars-export/${zipFileName}`);

    // ─── Update per-vehicle export status ───
    const finalStatus = ftpUploaded ? "online" : (ftp_user ? "error" : "pending");
    const finalError = ftpUploaded ? "" : ftpMessage;
    for (const v of perVehicle) {
      await supabase.from("vehicle_exports").upsert({
        vehicle_id: v.id,
        portal: "tipcars",
        external_id: `${tipcars_kod_firmy}_${pad4(perVehicle.indexOf(v) + 1)}`,
        status: finalStatus,
        last_export_at: new Date().toISOString(),
        last_success_at: ftpUploaded ? new Date().toISOString() : null,
        last_error: finalError,
        payload_hash: payloadHash,
        attempts: ftpAttempts || 1,
        metadata: { zip_filename: zipFileName, photos: v.photos },
      }, { onConflict: "vehicle_id,portal" });
    }

    return new Response(JSON.stringify({
      success: true,
      env: test_mode ? "test" : "live",
      test_mode,
      zip_url: urlData.publicUrl,
      zip_filename: zipFileName,
      vehicles_count: vehicles.length,
      photos_count: photosDownloaded,
      zip_size_mb: (zipped.length / 1024 / 1024).toFixed(2),
      ftp_uploaded: ftpUploaded,
      ftp_attempts: ftpAttempts,
      ftp_host,
      ftp_message: ftpMessage || (ftp_user ? undefined : "FTP přihlašovací údaje nebyly zadány, ZIP pouze uložen ke stažení"),
      payload_hash: payloadHash,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const e = err as Error;
    console.error("[TipCars] Error:", e);
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await logExport(supabase, {
        portal: "tipcars", operation: "export", level: "error",
        message: e.message, context: { stack: e.stack?.slice(0, 1000) },
      });
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

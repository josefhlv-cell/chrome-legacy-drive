import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { zipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Fuel mapping: our DB → TipCars kód ───
function mapFuel(fuel: string): { kod: string; popis: string } {
  const f = fuel.toLowerCase();
  if (f.includes("nafta") || f.includes("diesel")) return { kod: "B", popis: "nafta" };
  if (f.includes("lpg")) return { kod: "C", popis: "LPG" };
  if (f.includes("cng")) return { kod: "D", popis: "CNG" };
  if (f.includes("elektr") || f.includes("ev") || f.includes("electric")) return { kod: "E", popis: "elektro" };
  if (f.includes("hybrid")) return { kod: "F", popis: "hybridní" };
  if (f.includes("ethanol")) return { kod: "G", popis: "ethanol" };
  if (f.includes("vodík") || f.includes("hydrogen")) return { kod: "H", popis: "vodík" };
  return { kod: "A", popis: "benzín" };
}

// ─── Color mapping ───
function mapColor(color: string): { kod: string; popis: string } {
  const c = color.toLowerCase();
  if (c.includes("bíl") || c.includes("bil")) return { kod: "WB", popis: "bílá" };
  if (c.includes("čern") || c.includes("cern")) return { kod: "AB", popis: "černá" };
  if (c.includes("šed") || c.includes("sed") || c.includes("grey") || c.includes("gray")) return { kod: "SB", popis: "šedá" };
  if (c.includes("stříbr") || c.includes("stribr") || c.includes("silver")) return { kod: "SM", popis: "stříbrná" };
  if (c.includes("modr") || c.includes("blue")) return { kod: "LB", popis: "modrá" };
  if (c.includes("červen") || c.includes("cerven") || c.includes("red")) return { kod: "RB", popis: "červená" };
  if (c.includes("zelen") || c.includes("green")) return { kod: "GB", popis: "zelená" };
  if (c.includes("žlut") || c.includes("zlut") || c.includes("yellow")) return { kod: "YB", popis: "žlutá" };
  if (c.includes("hněd") || c.includes("hned") || c.includes("brown")) return { kod: "NB", popis: "hnědá" };
  if (c.includes("oranž") || c.includes("oranz") || c.includes("orange")) return { kod: "OB", popis: "oranžová" };
  if (c.includes("béžov") || c.includes("bezov") || c.includes("beige")) return { kod: "BB", popis: "béžová" };
  if (c.includes("fialov") || c.includes("purple")) return { kod: "VB", popis: "fialová" };
  if (c.includes("zlat") || c.includes("gold")) return { kod: "DB", popis: "zlatá" };
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

function buildInzeratXml(
  vehicle: any,
  images: any[],
  adNumber: number,
  kodFirmy: string
): { xml: string; photoFiles: { name: string; url: string }[] } {
  const cislo = pad4(adNumber);
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
  images.forEach((img, i) => {
    const photoNum = i + 1;
    const fileName = `${kodFirmy}${cislo}_${photoNum}.jpg`;
    photoFiles.push({ name: fileName, url: img.image_url });
    photoCodes.push(String(photoNum));
  });

  const equipmentItems: string[] = [];
  const trans = mapTransmission(vehicle.transmission || "");
  if (trans) {
    equipmentItems.push(`\t\t\t\t<typ>E</typ>\n\t\t\t\t<kod>${trans}</kod>\n\t\t\t\t<popis>aut. převodovka</popis>`);
  }

  const xml = `\t<inzerat>
\t\t<cislo_inzeratu>${cislo}</cislo_inzeratu>
\t\t<datum>${today}</datum>
${vehicle.vin ? `\t\t<vin>${escapeXml(vehicle.vin)}</vin>\n\t\t<vin_verejny>A</vin_verejny>` : ""}
\t\t<kategorie>
\t\t\t<kod>O</kod>
\t\t\t<popis>Ojetý</popis>
\t\t</kategorie>
\t\t<skupina>
\t\t\t<kod>A</kod>
\t\t\t<popis>Osobní</popis>
\t\t</skupina>
\t\t<znacka_model>
\t\t\t<kod></kod>
\t\t\t<popis_znacka>${escapeXml(extractBrand(vehicle.name))}</popis_znacka>
\t\t\t<popis_model>${escapeXml(extractModel(vehicle.name))}</popis_model>
\t\t</znacka_model>
\t\t<karoserie>
\t\t\t<kod></kod>
\t\t\t<popis></popis>
\t\t</karoserie>
\t\t<barva>
\t\t\t<kod>${color.kod}</kod>
\t\t\t<popis>${escapeXml(color.popis)}</popis>
\t\t</barva>
\t\t<stat_puvodu>
\t\t\t<kod>A</kod>
\t\t\t<popis>CZ</popis>
\t\t</stat_puvodu>
\t\t<palivo>
\t\t\t<kod>${fuel.kod}</kod>
\t\t\t<popis>${escapeXml(fuel.popis)}</popis>
\t\t</palivo>
\t\t<tachometr>
\t\t\t<najeto>${vehicle.mileage || 0}</najeto>
\t\t\t<kod_jednotky>A</kod_jednotky>
\t\t\t<popis_jednotky>km</popis_jednotky>
\t\t</tachometr>
\t\t<rok_vyroby>${vehicle.year}</rok_vyroby>
\t\t<stav>
\t\t\t<kod>XX</kod>
\t\t\t<popis>ojeté vozidlo</popis>
\t\t</stav>
\t\t<cenove_udaje>
\t\t\t<cena>${vehicle.price_with_vat}</cena>
\t\t\t<dph>${vehicle.show_vat ? "A" : "N"}</dph>
\t\t\t<kod_meny>A</kod_meny>
\t\t\t<popis_meny>Kč</popis_meny>
\t\t\t<dobra_cena></dobra_cena>
\t\t\t<puvodni_cena></puvodni_cena>
\t\t\t<dealerska_cena></dealerska_cena>
\t\t\t<moznosti_financovani></moznosti_financovani>
\t\t\t<leasing_splatka></leasing_splatka>
\t\t\t<leasing_pocet></leasing_pocet>
\t\t\t<cenova_kategorie></cenova_kategorie>
\t\t\t<horni_hranice></horni_hranice>
\t\t</cenove_udaje>
\t\t<ekologicka_dan>N</ekologicka_dan>
${engineVolume > 0 ? `\t\t<obsah_motoru>${engineVolume}</obsah_motoru>` : "\t\t<obsah_motoru></obsah_motoru>"}
\t\t<prvni_majitel>N</prvni_majitel>
\t\t<servisni_knizka></servisni_knizka>
${vehicle.description ? `\t\t<poznamka>${escapeXml(vehicle.description.slice(0, 3000))}</poznamka>` : "\t\t<poznamka></poznamka>"}
\t\t<vykon_motoru>
${power > 0 ? `\t\t\t<vykon>${power}</vykon>\n\t\t\t<kod_jednotky>A</kod_jednotky>\n\t\t\t<popis_jednotky>kW</popis_jednotky>` : "\t\t\t<vykon></vykon>\n\t\t\t<kod_jednotky></kod_jednotky>\n\t\t\t<popis_jednotky></popis_jednotky>"}
\t\t</vykon_motoru>
\t\t<nebourane></nebourane>
${equipmentItems.length > 0 ? `\t\t<vybava>\n\t\t\t<razeni></razeni>\n\t\t\t<seznam>\n${equipmentItems.join("\n")}\n\t\t\t</seznam>\n\t\t</vybava>` : ""}
\t\t<mista>5</mista>
\t\t<dvere>5</dvere>
\t\t<fotky>
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
  inzeraty: string[]
): string {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<tipcars xmlns:xs="http://www.w3.org/2001/XMLSchema">
\t<firma>
\t\t<test></test>
\t\t<kod_firmy>${escapeXml(kodFirmy)}</kod_firmy>
\t\t<heslo>${escapeXml(heslo)}</heslo>
\t\t<jazyk>C</jazyk>
\t\t<verze>5.06</verze>
\t\t<nazev>${escapeXml(firmaNazev)}</nazev>
\t\t<ulice>${escapeXml(firmaInfo.ulice || "")}</ulice>
\t\t<psc>${escapeXml(firmaInfo.psc || "")}</psc>
\t\t<mesto>${escapeXml(firmaInfo.mesto || "")}</mesto>
\t\t<telefon>${escapeXml(firmaInfo.telefon || "")}</telefon>
\t\t<fax></fax>
\t\t<email>${escapeXml(firmaInfo.email || "")}</email>
\t\t<www>${escapeXml(firmaInfo.www || "")}</www>
\t\t<cinnosti>S</cinnosti>
\t\t<znacky></znacky>
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
    
    const transferResp = await this.readResponse();
    console.log(`[FTP] Transfer: ${transferResp.trim()}`);
    
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

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      vehicle_ids,
      tipcars_kod_firmy,
      tipcars_heslo,
      firma_nazev = "Chrysler Pardubice",
      firma_info = {},
      ftp_host = "ftp.tipcars.com",
      ftp_user,
      ftp_password,
    } = await req.json();

    if (!vehicle_ids || !Array.isArray(vehicle_ids) || vehicle_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Chybí vehicle_ids (pole ID vozidel)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tipcars_kod_firmy || !tipcars_heslo) {
      return new Response(JSON.stringify({ error: "Chybí tipcars_kod_firmy nebo tipcars_heslo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch vehicles
    const { data: vehicles, error: vErr } = await supabase
      .from("vehicles")
      .select("*")
      .in("id", vehicle_ids);
    if (vErr) throw new Error(`Chyba načítání vozidel: ${vErr.message}`);
    if (!vehicles || vehicles.length === 0) throw new Error("Žádná vozidla nenalezena");

    const allInzeratyXml: string[] = [];
    const allPhotoFiles: { name: string; data: Uint8Array }[] = [];
    let photosDownloaded = 0;

    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const adNumber = i + 1;

      const { data: images } = await supabase
        .from("vehicle_images")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .order("sort_order");

      const { xml, photoFiles } = buildInzeratXml(
        vehicle,
        images || [],
        adNumber,
        tipcars_kod_firmy,
      );
      allInzeratyXml.push(xml);

      for (const pf of photoFiles) {
        try {
          console.log(`[TipCars] Downloading photo: ${pf.url}`);
          const resp = await fetch(pf.url);
          if (!resp.ok) {
            console.warn(`[TipCars] Failed to download ${pf.name}: ${resp.status}`);
            continue;
          }
          const buf = await resp.arrayBuffer();
          allPhotoFiles.push({ name: pf.name, data: new Uint8Array(buf) });
          photosDownloaded++;
        } catch (err) {
          console.warn(`[TipCars] Photo download error: ${err}`);
        }
      }
    }

    // Build the full XML
    const xmlContent = buildFullXml(
      tipcars_kod_firmy,
      tipcars_heslo,
      firma_nazev,
      firma_info,
      allInzeratyXml,
    );

    console.log(`[TipCars] XML generated, ${vehicles.length} vehicles, ${photosDownloaded} photos`);

    // Create ZIP using fflate
    const zipData: Record<string, Uint8Array> = {};
    zipData["inzerce.xml"] = new TextEncoder().encode(xmlContent);
    for (const pf of allPhotoFiles) {
      zipData[pf.name] = pf.data;
    }

    const zipped = zipSync(zipData);

    // Generate ZIP filename: {kod_firmy}_{date_time}.zip
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("_");
    const zipFileName = `${tipcars_kod_firmy}_${dateStr}.zip`;

    console.log(`[TipCars] ZIP created: ${zipFileName} (${(zipped.length / 1024 / 1024).toFixed(2)} MB)`);

    // Upload to FTP if credentials provided
    let ftpUploaded = false;
    let ftpMessage = "";

    if (ftp_user && ftp_password) {
      const ftp = new FtpClient();
      try {
        console.log(`[TipCars] Connecting to FTP: ${ftp_host}`);
        const welcome = await ftp.connect(ftp_host, 21);
        console.log(`[TipCars] FTP welcome: ${welcome.trim()}`);
        
        await ftp.login(ftp_user, ftp_password);
        console.log(`[TipCars] FTP logged in as ${ftp_user}`);
        
        await ftp.uploadFile(zipFileName, zipped);
        console.log(`[TipCars] FTP upload complete: ${zipFileName}`);
        
        ftpUploaded = true;
        ftpMessage = `Soubor ${zipFileName} úspěšně nahrán na FTP ${ftp_host}`;
        
        await ftp.quit();
      } catch (ftpErr: any) {
        console.error(`[TipCars] FTP error:`, ftpErr);
        ftpMessage = `FTP upload selhal: ${ftpErr.message}`;
        try { await ftp.quit(); } catch { /* ignore */ }
      }
    }

    // Also upload to storage as backup
    const { error: uploadErr } = await supabase.storage
      .from("vehicles")
      .upload(`tipcars-export/${zipFileName}`, zipped, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadErr) console.warn(`[TipCars] Storage upload warning: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage
      .from("vehicles")
      .getPublicUrl(`tipcars-export/${zipFileName}`);

    return new Response(JSON.stringify({
      success: true,
      zip_url: urlData.publicUrl,
      zip_filename: zipFileName,
      vehicles_count: vehicles.length,
      photos_count: photosDownloaded,
      zip_size_mb: (zipped.length / 1024 / 1024).toFixed(2),
      ftp_uploaded: ftpUploaded,
      ftp_message: ftpMessage || (ftp_user ? undefined : "FTP přihlašovací údaje nebyly zadány, ZIP pouze uložen ke stažení"),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[TipCars] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

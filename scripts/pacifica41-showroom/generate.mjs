/**
 * Offline showroom composites for one vehicle.
 * Reads originals, writes new JPEG files, never overwrites a source or the master.
 * Does not call Supabase writes or production storage uploads.
 *
 * Extraction is IMG.LY removeBackground (the same segmentation the Smart Capture
 * and flyer code import). The hosted remove-background function needs
 * REMOVEBG_API_KEY plus an admin session; those are not used here.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";
import { ALBUM, STORAGE_PREFIX, VEHICLE } from "./album.mjs";
import { integerPlacement, SHOWROOM_GEOMETRY } from "./geometry.mjs";

const { values } = parseArgs({
  options: {
    originals: { type: "string" },
    storage: { type: "string" },
    master: { type: "string" },
    out: { type: "string" },
    artifacts: { type: "string" },
  },
});

if (!values.originals || !values.master || !values.out) {
  console.error("Usage: node generate.mjs --originals DIR --master FILE --out DIR [--storage DIR] [--artifacts DIR]");
  process.exit(1);
}

const originalsDir = path.resolve(values.originals);
const masterPath = path.resolve(values.master);
const outDir = path.resolve(values.out);
const showroomDir = path.join(outDir, "showroom");
if (outDir === originalsDir || showroomDir === originalsDir) {
  throw new Error("Výstupní složka nesmí být složka originálů.");
}
if (path.dirname(masterPath) === showroomDir) {
  throw new Error("Master se nesmí zapisovat do výstupu.");
}

await mkdir(showroomDir, { recursive: true });
const masterBefore = await sha256(masterPath);
const masterMeta = await sharp(masterPath).metadata();
if (masterMeta.width !== 1500 || masterMeta.height !== 846) {
  throw new Error(`Master nemá 1500×846, ale ${masterMeta.width}×${masterMeta.height}. Zpracování zastaveno.`);
}

const sourceHashes = new Map();
for (const item of ALBUM) {
  const file = path.join(originalsDir, item.filename);
  if (await exists(file)) sourceHashes.set(item.filename, await sha256(file));
}

const storageMatches = values.storage ? await matchStorage(values.storage, sourceHashes) : [];
const results = [];

for (const item of ALBUM) {
  const sourcePath = path.join(originalsDir, item.filename);
  const present = sourceHashes.has(item.filename);
  if (item.disposition === "absent" || item.disposition === "not_in_album") {
    results.push(row(item, present ? "unexpected_file" : item.disposition, {
      source_sha256: sourceHashes.get(item.filename) ?? null,
    }));
    continue;
  }
  if (!present) {
    results.push(row(item, "absent_local_file", { source_sha256: null }));
    continue;
  }
  if (item.disposition === "unsuitable") {
    results.push(row(item, "unsuitable_interior_or_detail", {
      source_sha256: sourceHashes.get(item.filename),
    }));
    continue;
  }
  if (item.disposition !== "exterior") {
    results.push(row(item, "skipped", { source_sha256: sourceHashes.get(item.filename) }));
    continue;
  }
  results.push(await compositeOne(item, sourcePath));
}

for (const [filename, before] of sourceHashes) {
  const after = await sha256(path.join(originalsDir, filename));
  if (after !== before) throw new Error(`Originál se změnil: ${filename}`);
}
const masterAfter = await sha256(masterPath);
if (masterAfter !== masterBefore) throw new Error("Master background se změnil.");

const generated = results.filter((item) => item.status === "generated");
const manifest = {
  generated_at: new Date().toISOString(),
  vehicle: VEHICLE,
  master: {
    path: masterPath,
    sha256: masterAfter,
    width: masterMeta.width,
    height: masterMeta.height,
    rear_wall_m: { width: 6.6, height: 3.0 },
    unchanged: true,
  },
  extraction: {
    app_browser_package: "@imgly/background-removal",
    app_call: "removeBackground(photo, { output: { format: image/png, quality: 0.95 } })",
    server_function: "supabase/functions/remove-background",
    server_blocker: "REMOVEBG_API_KEY is not in the repo or this environment. The edge function also requires an admin JWT. It was not called.",
    method_used: "@imgly/background-removal-node@1.4.5 removeBackground",
    model: "medium",
    generative_image_model: false,
  },
  capture_show_background: {
    key: "capture-show-background",
    app_default: "off unless localStorage is 1 or composeBackground is true",
    app_setting_changed: false,
    this_run: "explicit offline batch; originals stay intact and no app preference was written",
  },
  geometry: SHOWROOM_GEOMETRY,
  album_total_feed_urls: ALBUM.filter((item) => item.disposition !== "not_in_album").length,
  accounted_entries: ALBUM.length,
  generated_count: generated.length,
  unsuitable_count: results.filter((item) => item.status === "unsuitable_interior_or_detail").length,
  absent_count: results.filter((item) => item.status === "absent" || item.status === "absent_local_file").length,
  not_in_album_count: results.filter((item) => item.status === "not_in_album").length,
  failed_count: results.filter((item) => item.status === "failed").length,
  database: {
    mutated: false,
    vehicle_images_rows: 30,
    vehicle_images_unique_files: 15,
    duplicate_note: "Each existing storage object is referenced by two vehicle_images rows.",
    storage_prefix: STORAGE_PREFIX,
    storage_matches: storageMatches,
    show_room_images: [],
  },
  entries: results,
};

const manifestPath = path.join(outDir, "manifest.json");
const { writeFile } = await import("node:fs/promises");
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

let contactPath = null;
let titlePath = null;
let zipPath = null;
if (generated.length) {
  contactPath = path.join(outDir, "contact-sheet.jpg");
  await writeContact(generated, contactPath);
  const title = generated.find((item) => item.role === "title") ?? generated[0];
  titlePath = path.join(outDir, "title-preview.jpg");
  await copyFile(title.output_path, titlePath);
  zipPath = path.join(outDir, "showroom.zip");
  execFileSync("python3", ["-c", `
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w", compression=zipfile.ZIP_DEFLATED) as z:
    for p in sys.argv[2:]:
        z.write(p, __import__("os").path.basename(p))
`, zipPath, ...generated.map((item) => item.output_path)], { stdio: "inherit" });
}

if (values.artifacts) {
  const dest = path.resolve(values.artifacts);
  await mkdir(dest, { recursive: true });
  await copyFile(manifestPath, path.join(dest, "pacifica-41-manifest.json"));
  if (contactPath) await copyFile(contactPath, path.join(dest, "pacifica-41-showroom-contact.jpg"));
  if (titlePath) await copyFile(titlePath, path.join(dest, "pacifica-41-title-preview.jpg"));
  if (zipPath) await copyFile(zipPath, path.join(dest, "pacifica-41-showroom.zip"));
}

console.log(JSON.stringify({
  generated: generated.length,
  unsuitable: manifest.unsuitable_count,
  absent: manifest.absent_count,
  failed: manifest.failed_count,
  manifest: manifestPath,
}, null, 2));

async function compositeOne(item, sourcePath) {
  const outputPath = path.join(showroomDir, item.filename.replace(/\.jpe?g$/i, ".showroom.jpg"));
  if (path.resolve(outputPath) === path.resolve(sourcePath) || path.resolve(outputPath) === masterPath) {
    throw new Error(`Výstup by přepsal zdroj: ${outputPath}`);
  }
  try {
    const cutoutBlob = await removeBackground(sourcePath, {
      model: "medium",
      output: { format: "image/png", quality: 0.95 },
    });
    const cutout = Buffer.from(await cutoutBlob.arrayBuffer());
    const bounds = await trimAlpha(cutout, SHOWROOM_GEOMETRY.alphaThreshold);
    if (!bounds) {
      return row(item, "failed", {
        source_sha256: sourceHashes.get(item.filename),
        error: "Výřez neobsahuje vozidlo.",
      });
    }
    const fidelity = await opaqueFidelity(sourcePath, cutout);
    if (fidelity.meanChannelSum > 30) {
      return row(item, "failed", {
        source_sha256: sourceHashes.get(item.filename),
        error: `Výřez změnil barvy vozu (mean ${fidelity.meanChannelSum.toFixed(2)}).`,
        fidelity,
      });
    }
    const placement = integerPlacement(masterMeta.width, masterMeta.height, bounds.cropW, bounds.cropH);
    if (placement.widthRatio > 0.72 + 1e-6 || placement.heightRatio > 0.53 + 1e-6) {
      throw new Error(`Geometrie mimo limit ${placement.widthRatio} × ${placement.heightRatio}`);
    }
    const vehicle = await sharp(cutout)
      .extract({ left: bounds.minX, top: bounds.minY, width: bounds.cropW, height: bounds.cropH })
      .resize(placement.drawW, placement.drawH, { fit: "fill", kernel: "lanczos3" })
      .png()
      .toBuffer();
    const shadow = await shadowPng(masterMeta.width, masterMeta.height, placement);
    await sharp(masterPath)
      .composite([
        { input: shadow, blend: "over" },
        { input: vehicle, left: placement.x, top: placement.y, blend: "over" },
      ])
      .jpeg({ quality: SHOWROOM_GEOMETRY.jpegQuality })
      .toFile(outputPath);
    const outMeta = await sharp(outputPath).metadata();
    const ceiling = await ceilingDelta(masterPath, outputPath);
    if (outMeta.width !== 1500 || outMeta.height !== 846) {
      throw new Error(`Výstup nemá velikost masteru: ${outMeta.width}×${outMeta.height}`);
    }
    if (ceiling.mean > 4 || ceiling.max > 20) {
      throw new Error(`Strop masteru se rozchází (mean ${ceiling.mean.toFixed(2)} max ${ceiling.max}).`);
    }
    return row(item, "generated", {
      source_sha256: sourceHashes.get(item.filename),
      output_path: outputPath,
      output_sha256: await sha256(outputPath),
      output_width: outMeta.width,
      output_height: outMeta.height,
      crop: bounds,
      placement,
      fidelity,
      master_ceiling_delta: ceiling,
    });
  } catch (error) {
    return row(item, "failed", {
      source_sha256: sourceHashes.get(item.filename),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function row(item, status, extra) {
  return {
    index: item.index,
    filename: item.filename,
    url: item.url,
    shot_type: item.shot_type,
    role: item.role,
    disposition: item.disposition,
    observed: item.observed,
    status,
    ...extra,
  };
}

async function trimAlpha(png, threshold) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const rowStart = y * width * channels;
    for (let x = 0; x < width; x++) {
      if (data[rowStart + x * channels + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, cropW: maxX - minX + 1, cropH: maxY - minY + 1, source_width: width, source_height: height };
}

async function opaqueFidelity(sourcePath, cutout) {
  const source = await sharp(sourcePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cut = await sharp(cutout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = source.info.width;
  let samples = 0;
  let sum = 0;
  for (let y = 0; y < source.info.height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const alpha = cut.data[(y * cut.info.width + x) * 4 + 3];
      if (alpha < 250) continue;
      const s = (y * width + x) * source.info.channels;
      const c = (y * cut.info.width + x) * 4;
      sum += Math.abs(source.data[s] - cut.data[c])
        + Math.abs(source.data[s + 1] - cut.data[c + 1])
        + Math.abs(source.data[s + 2] - cut.data[c + 2]);
      samples++;
    }
  }
  return { samples, meanChannelSum: samples ? sum / samples : null };
}

async function shadowPng(canvasW, canvasH, placement) {
  const { cx, cy, rx, ry } = placement.shadow;
  const svg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(0,0,0,${SHOWROOM_GEOMETRY.shadowAlpha})"/></svg>`;
  return sharp(Buffer.from(svg)).blur(SHOWROOM_GEOMETRY.shadowBlurPx).png().toBuffer();
}

async function ceilingDelta(master, output) {
  const a = await sharp(master).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(output).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = a.info.width;
  const band = 36;
  let n = 0;
  let sum = 0;
  let max = 0;
  for (let y = 0; y < band; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        const delta = Math.abs(a.data[(y * width + x) * a.info.channels + c] - b.data[(y * width + x) * b.info.channels + c]);
        sum += delta;
        if (delta > max) max = delta;
        n++;
      }
    }
  }
  return { mean: sum / n, max, band_px: band };
}

async function writeContact(items, dest) {
  const cellW = 500;
  const cellH = 330;
  const composites = [];
  for (let i = 0; i < items.length; i++) {
    const photo = await sharp(items[i].output_path)
      .resize(cellW, cellH - 36, { fit: "contain", background: { r: 12, g: 12, b: 12 } })
      .png()
      .toBuffer();
    composites.push({ input: photo, left: i * cellW, top: 0 });
    const label = escapeXml(items[i].filename);
    const svg = `<svg width="${cellW}" height="36" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="10" y="24" fill="#ffffff" font-size="16" font-family="DejaVu Sans, sans-serif">${label}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left: i * cellW, top: cellH - 36 });
  }
  await sharp({
    create: { width: cellW * items.length, height: cellH, channels: 3, background: { r: 12, g: 12, b: 12 } },
  }).composite(composites).jpeg({ quality: 86 }).toFile(dest);
}

async function matchStorage(storageDir, hashes) {
  const { readdir } = await import("node:fs/promises");
  const byHash = new Map([...hashes].map(([filename, hash]) => [hash, filename]));
  const matches = [];
  for (const name of await readdir(storageDir)) {
    if (!name.endsWith(".jpg")) continue;
    const hash = await sha256(path.join(storageDir, name));
    matches.push({ storage_file: name, sha256: hash, named_file: byHash.get(hash) ?? null });
  }
  return matches.sort((a, b) => a.storage_file.localeCompare(b.storage_file, undefined, { numeric: true }));
}

async function sha256(file) {
  const data = await readFile(file);
  return createHash("sha256").update(data).digest("hex");
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(value) {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

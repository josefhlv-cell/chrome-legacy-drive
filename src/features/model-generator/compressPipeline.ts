/**
 * compressPipeline — čistá (DOM-free) komprese GLB.
 *
 * Proč zvlášť: stejný kód spouštíme jak ve Web Workeru (aby admin UI
 * nezamrzlo na desítky sekund), tak ve hlavním vlákně jako záložní cestu,
 * kdyby Worker v prohlížeči selhal. Kód proto nesmí používat `document`.
 */

export type CompressStage =
  | "load"
  | "dedup"
  | "prune"
  | "weld"
  | "textures"
  | "encode"
  | "done";

export type CompressProgress = { stage: CompressStage; label: string; percent: number };

const STAGE_LABELS: Record<CompressStage, string> = {
  load: "Načítám model…",
  dedup: "Sjednocuji materiály…",
  prune: "Odstraňuji nepoužité části…",
  weld: "Svařuji geometrii…",
  textures: "Komprimuji textury…",
  encode: "Kvantizuji a balím GLB…",
  done: "Hotovo",
};

const PERCENTS: Record<CompressStage, number> = {
  load: 10,
  dedup: 25,
  prune: 35,
  weld: 50,
  textures: 70,
  encode: 92,
  done: 100,
};

/**
 * Zkomprimuje GLB buffer (meshopt kvantizace + WebP textury).
 * Vrací `null`, pokud se výsledek nepovedl zmenšit — volající pak
 * publikuje originál, aby export nikdy nespadl kvůli optimalizaci.
 */
export async function compressGLBBuffer(
  input: ArrayBuffer,
  onProgress?: (p: CompressProgress) => void,
): Promise<ArrayBuffer | null> {
  const report = (stage: CompressStage) =>
    onProgress?.({ stage, label: STAGE_LABELS[stage], percent: PERCENTS[stage] });

  report("load");

  const [{ WebIO }, extensions, functions] = await Promise.all([
    import("@gltf-transform/core"),
    import("@gltf-transform/extensions"),
    import("@gltf-transform/functions"),
  ]);
  const { KHRDracoMeshCompression, KHRMeshQuantization } = extensions;

  const io = new WebIO().registerExtensions([KHRDracoMeshCompression, KHRMeshQuantization]);

  /*
   * Draco je jediná komprese geometrie, kterou model-viewer (Android AR
   * i desktopový náhled) umí dekódovat sám. Kdyby se kodér v prohlížeči
   * nepodařilo nahrát, spadneme na čistou kvantizaci — ta je podporovaná
   * všude, jen je soubor větší.
   */
  let dracoReady = false;
  try {
    const draco3d = (await import("draco3dgltf")).default as {
      createEncoderModule: () => Promise<unknown>;
    };
    io.registerDependencies({ "draco3d.encoder": await draco3d.createEncoderModule() });
    dracoReady = true;
  } catch (error) {
    console.warn("compressPipeline: Draco kodér není dostupný, použiji kvantizaci", error);
  }

  const doc = await io.readBinary(new Uint8Array(input));


  report("dedup");
  await doc.transform(functions.dedup());
  report("prune");
  await doc.transform(functions.prune());
  report("weld");
  /*
   * weld() v této verzi slučuje pouze BITOVĚ shodné vrcholy, takže UV ani
   * normálové švy na laku nezmizí (žádné vlny ani fazety na karoserii).
   */
  await doc.transform(functions.weld());

  report("textures");
  try {
    await doc.transform(
      functions.textureCompress({ targetFormat: "webp", resize: [4096, 4096], quality: 95 }),
    );
  } catch (error) {
    // WebP kodek nemusí být v daném prostředí dostupný — geometrii to nebrání.
    console.warn("compressPipeline: komprese textur přeskočena", error);
  }

  report("encode");
  /*
   * KRITICKÉ: nikdy nepoužívat EXT_meshopt_compression.
   *
   * PROČ: model-viewer (Android AR i desktopový náhled) umí Draco a KTX2,
   * ale meshopt dekodér neobsahuje — takto komprimované modely se nikdy
   * nenačetly ("setMeshoptDecoder must be called") a zákazník viděl v AR
   * prázdnou scénu. Draco zmenší geometrii ~4×, kvantizace je záloha.
   */
  if (dracoReady) {
    await doc.transform(
      functions.draco({
        method: "edgebreaker",
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
      }),
    );
  } else {
    await doc.transform(
      functions.quantize({
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
      }),
    );
  }


  const out = await io.writeBinary(doc);
  report("done");

  const buffer = (out as Uint8Array).buffer as ArrayBuffer;
  return buffer.byteLength > 0 && buffer.byteLength < input.byteLength ? buffer : null;
}


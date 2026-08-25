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

  const [{ WebIO }, { EXTMeshoptCompression, KHRMeshQuantization }, functions, meshopt] =
    await Promise.all([
      import("@gltf-transform/core"),
      import("@gltf-transform/extensions"),
      import("@gltf-transform/functions"),
      import("meshoptimizer"),
    ]);

  const { MeshoptEncoder } = meshopt as unknown as { MeshoptEncoder: { ready: Promise<void> } };
  await MeshoptEncoder.ready;

  const io = new WebIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]);
  io.registerDependencies({ "meshopt.encoder": MeshoptEncoder });

  const doc = await io.readBinary(new Uint8Array(input));

  report("dedup");
  await doc.transform(functions.dedup());
  report("prune");
  await doc.transform(functions.prune());
  report("weld");
  await doc.transform(functions.weld());

  report("textures");
  try {
    await doc.transform(functions.textureCompress({ targetFormat: "webp", resize: [2048, 2048] }));
  } catch (error) {
    // WebP kodek nemusí být v daném prostředí dostupný — geometrii to nebrání.
    console.warn("compressPipeline: komprese textur přeskočena", error);
  }

  report("encode");
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });

  const out = await io.writeBinary(doc);
  report("done");

  const buffer = (out as Uint8Array).buffer as ArrayBuffer;
  return buffer.byteLength > 0 && buffer.byteLength < input.byteLength ? buffer : null;
}

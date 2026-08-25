/**
 * glbBuilder — přenese "appearance profil" na základní model Pacifiky
 * a vyexportuje GLB pro AR.
 *
 * Proč v prohlížeči a ne v edge funkci: manipulace s meshi a export GLB
 * potřebuje three.js runtime a WebGL; edge funkce nemají GPU ani binárky
 * a nesmí běžet minuty.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { AppearanceProfile } from "./appearance";

export const BASE_MODEL_URL = "/models/pacifica.glb";
const DRACO_DECODER = "https://www.gstatic.com/draco/versioned/decoders/1.5.6/";

const isBody = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("body") || n.includes("paint") || n.includes("karoserie");
};
const isGlass = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("glass") || n.includes("window") || n.includes("sklo") || n.includes("windshield");
};
const isTrim = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("chrome") || n.includes("trim") || n.includes("grill") || n.includes("molding");
};
/** Pneumatika má vlastní matný gumový materiál — nesmí zčernat jako disk. */
const isTire = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("tire") || n.includes("tyre") || n.includes("rubber") || n.includes("pneu");
};
const isWheel = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("wheel") || n.includes("rim") || n.includes("disc") || n.includes("kolo");
};
/** Světla — čirý kryt + reflektor, aby v AR nevypadala jako slepá plocha. */
const isLight = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("light") || n.includes("lamp") || n.includes("head_l") || n.includes("tail");
};
const isInterior = (name: string) => {
  const n = name.toLowerCase();
  return (
    n.includes("seat") || n.includes("interior") || n.includes("dashboard") ||
    n.includes("dash") || n.includes("carpet") || n.includes("sedack")
  );
};


let cachedScene: THREE.Group | null = null;

/** Načte (a nacachuje) základní model. */
export async function loadBaseModel(): Promise<THREE.Group> {
  if (cachedScene) return cachedScene.clone(true) as THREE.Group;

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER);
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync(BASE_MODEL_URL);
  cachedScene = gltf.scene as THREE.Group;
  return cachedScene.clone(true) as THREE.Group;
}

/**
 * Vytvoří proceduální texturu s poškozením (škrábance / dolík / odřený lak).
 * Nejde o fotorealistickou repliku, ale o poctivé vyznačení místa a rozsahu.
 */
const damageTexture = (profile: AppearanceProfile, base?: THREE.Texture | null): THREE.Texture | null => {
  if (!profile.damages?.length) return null;

  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = profile.body_color_hex;
  ctx.fillRect(0, 0, size, size);

  // Když má model vlastní texturu karoserie (spáry, loga), necháme ji pod lakem.
  const baseImage = base?.image as CanvasImageSource | undefined;
  if (baseImage) {
    try {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(baseImage, 0, 0, size, size);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = profile.body_color_hex;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = "source-over";
    } catch {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }


  // Rozvržení podle částí vozu — hrubá UV mapa (stačí pro čitelnou indikaci).
  const zones: Record<string, [number, number]> = {
    predni_naraznik: [0.15, 0.8],
    zadni_naraznik: [0.85, 0.8],
    dvere_levo: [0.4, 0.45],
    dvere_pravo: [0.6, 0.45],
    blatnik: [0.25, 0.6],
    kapota: [0.2, 0.25],
    paty_dvere: [0.8, 0.3],
    strecha: [0.5, 0.12],
    jine: [0.5, 0.6],
  };

  profile.damages.forEach((damage) => {
    const [zx, zy] = zones[damage.part] ?? zones.jine;
    const cx = zx * size;
    const cy = zy * size;
    // ×2 — textura je 2048 px, aby detaily zůstaly ve stejném fyzickém měřítku.
    const scale = (damage.severity === "vyrazne" ? 1.6 : damage.severity === "stredni" ? 1.1 : 0.7) * 2;


    ctx.save();
    if (damage.type === "dulek") {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60 * scale);
      grad.addColorStop(0, "rgba(0,0,0,0.45)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 60 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (damage.type === "koroze" || damage.type === "odrena_barva") {
      ctx.fillStyle = damage.type === "koroze" ? "rgba(120,60,25,0.75)" : "rgba(190,190,195,0.8)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 34 * scale, 20 * scale, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(235,235,240,0.85)";
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 45 * scale, cy - 8 * scale);
      ctx.lineTo(cx + 45 * scale, cy + 6 * scale);
      ctx.stroke();
    }
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = "damage_overlay";
  return texture;
};

const wheelTint = (style: string): THREE.Color | null => {
  switch (style) {
    case "alloy_dark":
      return new THREE.Color("#3a3d42");
    case "steel_cover":
      return new THREE.Color("#8d9096");
    case "5spoke":
    case "10spoke":
    case "multispoke":
      return new THREE.Color("#c8ccd2");
    default:
      return null;
  }
};

/** Aplikuje profil na scénu (in-place). */
export function applyProfile(root: THREE.Object3D, profile: AppearanceProfile) {
  const bodyColor = new THREE.Color(profile.body_color_hex);
  const wheels = wheelTint(profile.wheel_style);
  const interiorColor = new THREE.Color(profile.interior_color_hex || "#2b2b2e");
  const seen = new Set<string>();
  // Základní texturu karoserie použijeme jako podklad pro overlay poškození.
  let bodyBaseMap: THREE.Texture | null = null;
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!bodyBaseMap && m && !Array.isArray(m) && isBody(m.name || o.name || "")) bodyBaseMap = m.map ?? null;
  });
  const damage = damageTexture(profile, bodyBaseMap);

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;

    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src || seen.has(src.uuid)) return;
    seen.add(src.uuid);

    const name = src.name || mesh.name || "";

    if (isBody(name)) {
      const paint = new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        map: damage ?? src.map ?? null,
        normalMap: src.normalMap ?? null,
        metalness: profile.paint_finish === "solid" ? 0.25 : profile.paint_finish === "matte" ? 0.1 : 0.62,
        roughness: profile.paint_finish === "matte" ? 0.65 : profile.roughness,
        clearcoat: profile.paint_finish === "matte" ? 0 : profile.clearcoat,
        clearcoatRoughness: profile.paint_finish === "matte" ? 0.6 : 0.03,
        envMapIntensity: 1.35,
        // Metalíza/perleť má jemný "flake" lesk — dělá to hloubku laku v AR.
        sheen: profile.paint_finish === "pearl" ? 0.65 : profile.paint_finish === "metallic" ? 0.3 : 0.1,
        sheenRoughness: 0.35,
        sheenColor: new THREE.Color("#ffffff"),
        specularIntensity: profile.paint_finish === "matte" ? 0.3 : 1,
      });
      // Když kreslíme poškození do mapy, barva už je v textuře — nechceme dvojí tón.
      if (damage) paint.color = new THREE.Color("#ffffff");
      paint.name = name || "body_paint";
      mesh.material = paint;
      return;
    }

    if (isLight(name)) {
      const lamp = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(name.toLowerCase().includes("tail") ? "#8e1218" : "#f4f7fb"),
        transparent: true,
        opacity: 0.9,
        roughness: 0.05,
        metalness: 0,
        transmission: 0.55,
        ior: 1.45,
        clearcoat: 1,
        emissive: new THREE.Color(name.toLowerCase().includes("tail") ? "#5a0a0e" : "#1a2430"),
        emissiveIntensity: 0.35,
      });
      lamp.name = name || "lamp";
      mesh.material = lamp;
      return;
    }

    if (isGlass(name)) {
      const glass = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#0e1114"),
        transparent: true,
        opacity: THREE.MathUtils.clamp(profile.glass_opacity, 0.2, 0.95),
        roughness: 0.04,
        metalness: 0,
        ior: 1.52,
        thickness: 0.006,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        transmission: Math.max(0, 0.75 - profile.glass_opacity * 0.6),
      });
      glass.name = name || "glass";
      mesh.material = glass;
      return;
    }

    if (isTrim(name)) {
      const trim = src.clone() as THREE.MeshStandardMaterial;
      if (profile.trim_style === "black") {
        trim.color = new THREE.Color("#1b1c1f");
        trim.metalness = 0.4;
        trim.roughness = 0.45;
      } else if (profile.trim_style === "body") {
        trim.color = bodyColor.clone();
        trim.metalness = 0.6;
        trim.roughness = profile.roughness;
      } else {
        trim.color = new THREE.Color("#e6e8ea");
        trim.metalness = 1;
        trim.roughness = 0.1;
      }
      trim.envMapIntensity = 1.4;
      mesh.material = trim;
      return;
    }

    // Guma pneumatik: matná, mírně "prašná" — nikdy chrom.
    if (isTire(name)) {
      const tire = src.clone() as THREE.MeshStandardMaterial;
      tire.color = new THREE.Color("#15161a");
      tire.metalness = 0;
      tire.roughness = 0.92;
      tire.envMapIntensity = 0.5;
      mesh.material = tire;
      return;
    }

    if (isWheel(name) && wheels) {
      const wheel = src.clone() as THREE.MeshStandardMaterial;
      wheel.color = wheels;
      wheel.metalness = profile.wheel_style === "steel_cover" ? 0.5 : 0.9;
      wheel.roughness = profile.wheel_style === "alloy_dark" ? 0.45 : 0.18;
      wheel.envMapIntensity = 1.5;
      mesh.material = wheel;
      return;
    }

    if (isInterior(name)) {
      const trimIn = src.clone() as THREE.MeshStandardMaterial;
      trimIn.color = interiorColor.clone();
      trimIn.metalness = 0.05;
      trimIn.roughness = 0.72;
      mesh.material = trimIn;
      return;
    }

    // Ostrost textur na šikmých plochách (kola, spáry) — velký vizuální rozdíl.
    if (src.map) src.map.anisotropy = 8;
  });
}


/** Postaví scénu konkrétního vozu z base modelu + profilu. */
export async function buildVehicleScene(profile: AppearanceProfile): Promise<THREE.Group> {
  const scene = await loadBaseModel();
  applyProfile(scene, profile);
  return scene;
}

/** Vyexportuje scénu jako binární GLB (bez komprese). */
export function exportGLB(scene: THREE.Object3D): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: "model/gltf-binary" }));
        } else {
          reject(new Error("Export nevrátil binární GLB."));
        }
      },
      (error) => reject(error),
      { binary: true, onlyVisible: true, maxTextureSize: 2048 },
    );
  });
}

/**
 * Zkomprimuje vyexportovaný GLB, aby se dal rozumně stáhnout na mobilu v AR.
 *
 * GLTFExporter umí jen nekomprimovaný výstup — model Pacifiky má skoro milion
 * trojúhelníků, takže surový GLB má desítky MB. Tady se proto spustí
 * `meshopt` (kvantizace pozic/UV + komprese bufferů), což typicky sníží
 * velikost 4–6× BEZ viditelné ztráty kvality geometrie.
 *
 * Když by komprese z jakéhokoli důvodu selhala, vrací se originál —
 * publikace modelu nikdy nespadne kvůli optimalizaci.
 */
export async function compressGLB(input: Blob): Promise<Blob> {
  try {
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

    const doc = await io.readBinary(new Uint8Array(await input.arrayBuffer()));

    await doc.transform(
      functions.dedup(),
      functions.prune(),
      functions.weld(),
      functions.textureCompress({ targetFormat: "webp", resize: [2048, 2048] }),
    );

    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
    });

    const out = await io.writeBinary(doc);
    const blob = new Blob([out as unknown as BlobPart], { type: "model/gltf-binary" });
    return blob.size > 0 && blob.size < input.size ? blob : input;
  } catch (error) {
    console.warn("compressGLB: komprese selhala, publikuji nekomprimovaný model", error);
    return input;
  }
}


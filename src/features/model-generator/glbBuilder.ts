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
import { compressGLBBuffer, type CompressProgress } from "./compressPipeline";

/** Zprávy z `glbCompress.worker.ts`. */
type WorkerMessage =
  | { type: "progress"; progress: CompressProgress }
  | { type: "done"; buffer: ArrayBuffer | null }
  | { type: "error"; message: string };


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

/**
 * Three.js `scene.clone(true)` sdílí geometrii i materiály. To je u nás
 * nebezpečné: export USDZ následně geometrii zmenšoval in-place a tím poškodil
 * i živý náhled / další exporty ze stejné cache. Každý pracovní model proto
 * dostane vlastní BufferGeometry a vlastní Material instance.
 */
const cloneVehicleScene = (source: THREE.Object3D): THREE.Group => {
  const clone = source.clone(true) as THREE.Group;

  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    if (mesh.geometry) mesh.geometry = mesh.geometry.clone();

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone());
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  return clone;
};

/** Načte (a nacachuje) základní model. */
export async function loadBaseModel(): Promise<THREE.Group> {
  if (cachedScene) return cloneVehicleScene(cachedScene);

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER);
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync(BASE_MODEL_URL);
  cachedScene = gltf.scene as THREE.Group;
  return cloneVehicleScene(cachedScene);
}

/** Sada map pro karoserii: barva laku + normálová mapa reliéfu poškození. */
type DamageMaps = { color: THREE.Texture | null; normal: THREE.Texture | null };

/**
 * Ze šedotónové výškové mapy spočítá normálovou mapu (Sobel).
 *
 * Proč: dolík nakreslený jen do barvy vypadá jako nálepka. Normálová mapa
 * ohne odraz světla, takže promáčklina se v AR chová jako skutečná
 * deformace plechu — reflexe se v ní „zlomí“.
 */
const heightToNormal = (height: HTMLCanvasElement, strength: number): THREE.Texture | null => {
  const size = height.width;
  const src = height.getContext("2d")?.getImageData(0, 0, size, size);
  if (!src) return null;

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  const dst = ctx.createImageData(size, size);
  const h = (x: number, y: number) => {
    const cx = Math.min(size - 1, Math.max(0, x));
    const cy = Math.min(size - 1, Math.max(0, y));
    return src.data[(cy * size + cx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1) -
        (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1));
      const dy =
        h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1) -
        (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1));

      let nx = dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;

      const i = (y * size + x) * 4;
      dst.data[i] = (nx * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (nz / len) * 255;
      dst.data[i + 3] = 255;
    }
  }

  ctx.putImageData(dst, 0, 0);
  const texture = new THREE.CanvasTexture(out);
  // Normálová mapa je vektorová data — NESMÍ projít sRGB konverzí.
  texture.colorSpace = THREE.NoColorSpace;
  texture.name = "damage_normal";
  return texture;
};

/**
 * Vytvoří proceduální mapy s poškozením (škrábance / dolík / odřený lak).
 * Nejde o fotorealistickou repliku, ale o poctivé vyznačení místa a rozsahu.
 */
const damageMaps = (profile: AppearanceProfile, base?: THREE.Texture | null): DamageMaps => {
  if (!profile.damages?.length) return { color: null, normal: null };

  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { color: null, normal: null };

  // Druhé plátno = výšková mapa. Šedá 128 = rovný plech.
  const height = document.createElement("canvas");
  height.width = size;
  height.height = size;
  const hctx = height.getContext("2d");
  if (hctx) {
    hctx.fillStyle = "#808080";
    hctx.fillRect(0, 0, size, size);
  }

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
    const depth = damage.severity === "vyrazne" ? 0.75 : damage.severity === "stredni" ? 0.5 : 0.3;


    ctx.save();
    if (damage.type === "dulek") {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60 * scale);
      grad.addColorStop(0, "rgba(0,0,0,0.45)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 60 * scale, 0, Math.PI * 2);
      ctx.fill();

      if (hctx) {
        // Promáčklina = plynulé snížení povrchu (tmavší = níž).
        const hg = hctx.createRadialGradient(cx, cy, 2, cx, cy, 60 * scale);
        hg.addColorStop(0, `rgba(0,0,0,${depth})`);
        hg.addColorStop(0.75, `rgba(0,0,0,${depth * 0.25})`);
        hg.addColorStop(1, "rgba(0,0,0,0)");
        hctx.fillStyle = hg;
        hctx.beginPath();
        hctx.arc(cx, cy, 60 * scale, 0, Math.PI * 2);
        hctx.fill();
      }
    } else if (damage.type === "koroze" || damage.type === "odrena_barva") {
      ctx.fillStyle = damage.type === "koroze" ? "rgba(120,60,25,0.75)" : "rgba(190,190,195,0.8)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 34 * scale, 20 * scale, 0.3, 0, Math.PI * 2);
      ctx.fill();

      if (hctx) {
        // Koroze/odřenina = drsný, nepravidelný povrch (jemné zvlnění).
        hctx.save();
        hctx.globalAlpha = depth * 0.6;
        hctx.fillStyle = damage.type === "koroze" ? "#4a4a4a" : "#a0a0a0";
        hctx.beginPath();
        hctx.ellipse(cx, cy, 34 * scale, 20 * scale, 0.3, 0, Math.PI * 2);
        hctx.fill();
        hctx.restore();
      }
    } else {
      ctx.strokeStyle = "rgba(235,235,240,0.85)";
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 45 * scale, cy - 8 * scale);
      ctx.lineTo(cx + 45 * scale, cy + 6 * scale);
      ctx.stroke();

      if (hctx) {
        // Škrábanec = úzká rýha; tmavá linka + světlý okraj (vyhrnutý lak).
        hctx.save();
        hctx.lineCap = "round";
        hctx.strokeStyle = `rgba(255,255,255,${depth * 0.5})`;
        hctx.lineWidth = 4 * scale;
        hctx.beginPath();
        hctx.moveTo(cx - 45 * scale, cy - 8 * scale);
        hctx.lineTo(cx + 45 * scale, cy + 6 * scale);
        hctx.stroke();
        hctx.strokeStyle = `rgba(0,0,0,${depth})`;
        hctx.lineWidth = 2 * scale;
        hctx.beginPath();
        hctx.moveTo(cx - 45 * scale, cy - 8 * scale);
        hctx.lineTo(cx + 45 * scale, cy + 6 * scale);
        hctx.stroke();
        hctx.restore();
      }
    }
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = "damage_overlay";

  /*
   * DŮLEŽITÉ: normálovou mapu poškození zatím NEvracíme do laku.
   * Hrubá UV mapa se na některých dílech Pacifiky opakuje přes více panelů a
   * v iOS USDZ pak deformuje odlesky po celé karoserii — zákazník vidí vůz jako
   * „pomačkaný po bouračce“. Poškození ponecháváme jako jemnou barevnou stopu,
   * ale hladké tovární normály karoserie zůstanou nedotčené.
   */
  return { color: texture, normal: null };
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
  // Základní texturu karoserie použijeme jako podklad pro overlay poškození.
  let bodyBaseMap: THREE.Texture | null = null;
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!bodyBaseMap && m && !Array.isArray(m) && isBody(m.name || o.name || "")) bodyBaseMap = m.map ?? null;
  });
  const damage = damageMaps(profile, bodyBaseMap);

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;

    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src) return;

    const name = src.name || mesh.name || "";

    if (isBody(name)) {
      const paint = new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        map: damage.color ?? src.map ?? null,
        // Používáme pouze původní hladké normály modelu. Procedurální reliéf
        // poškození uměl v AR rozbít odlesky a vizuálně „zmačkat“ bok auta.
        normalMap: src.normalMap ?? null,
        normalScale: src.normalScale?.clone() ?? new THREE.Vector2(1, 1),
        // Automobilový lak není chrom. Nízká metalness + čirý clearcoat dá
        // realistický hluboký lesk bez alobalových deformací odrazů.
        metalness: profile.paint_finish === "matte" ? 0.02 : profile.paint_finish === "metallic" || profile.paint_finish === "pearl" ? 0.08 : 0.03,
        roughness: profile.paint_finish === "matte" ? 0.68 : THREE.MathUtils.clamp(profile.roughness, 0.24, 0.48),
        clearcoat: profile.paint_finish === "matte" ? 0 : profile.clearcoat,
        clearcoatRoughness: profile.paint_finish === "matte" ? 0.58 : 0.08,
        envMapIntensity: 1.05,
        // Metalíza/perleť má jemný "flake" lesk — dělá to hloubku laku v AR.
        sheen: profile.paint_finish === "pearl" ? 0.35 : profile.paint_finish === "metallic" ? 0.18 : 0.04,
        sheenRoughness: 0.35,
        sheenColor: new THREE.Color("#ffffff"),
        specularIntensity: profile.paint_finish === "matte" ? 0.3 : 1,
      });
      // Když kreslíme poškození do mapy, barva už je v textuře — nechceme dvojí tón.
      if (damage.color) paint.color = new THREE.Color("#ffffff");
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
 * Vyexportuje scénu jako USDZ pro iOS AR Quick Look.
 *
 * PROČ je to důležité: iPhone neumí GLB. Bez USDZ se na iOS zobrazoval
 * generický bílý model, takže barva a stav KONKRÉTNÍHO vozu se zákazníkovi
 * na iPhonu nikdy neukázala. USDZ vyrobíme ze stejné scény jako GLB,
 * takže lak, skla, kola i poškození jsou identické na obou platformách.
 */
export async function exportUSDZ(scene: THREE.Object3D, ratio = 0.28): Promise<Blob> {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");

  /*
   * USDZ je ZIP BEZ komprese a geometrie se do něj zapisuje TEXTOVĚ — surová
   * Pacifica (≈890 tis. trojúhelníků) proto dá ~90 MB, což si nikdo na
   * mobilních datech nestáhne. Před exportem tedy geometrii decimujeme
   * a textury zmenšíme na 1024 px. Na displeji telefonu je rozdíl
   * nepostřehnutelný, ale AR se otevře v sekundách místo minut.
   */
  const light = await decimateForUSDZ(scene, ratio);
  const exporter = new USDZExporter();
  const result = await exporter.parseAsync(light, { maxTextureSize: 1024 });
  return new Blob([result as unknown as BlobPart], { type: "model/vnd.usdz+zip" });
}

/**
 * Decimace scény pro USDZ.
 *
 * Model Pacifiky je „trojúhelníková polévka" (rozpojené plochy bez sdílených
 * vrcholů) — standardní simplifikace na něm nezabere. Proto používáme meshopt
 * přímo s příznaky `Permissive` + `Sparse` + `Prune`, které kolaps hran přes
 * švy povolují, a výsledek pak zkompaktníme (zahodíme nepoužité vrcholy),
 * protože právě soupis vrcholů tvoří většinu objemu USDZ.
 *
 * Když cokoli selže, vrací se původní scéna — export nikdy nespadne
 * kvůli optimalizaci.
 */
async function decimateForUSDZ(scene: THREE.Object3D, ratio: number): Promise<THREE.Object3D> {
  try {
    const { MeshoptSimplifier } = (await import("meshoptimizer")) as unknown as {
      MeshoptSimplifier: {
        ready: Promise<void>;
        simplify: (
          indices: Uint32Array,
          positions: Float32Array,
          stride: number,
          targetIndexCount: number,
          targetError: number,
          flags?: string[],
        ) => [Uint32Array, number];
      };
    };
    await MeshoptSimplifier.ready;

    const clone = cloneVehicleScene(scene);
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      const geometry = mesh.geometry as THREE.BufferGeometry;
      const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!position) return;

      const vertexCount = position.count;
      const indices = geometry.index
        ? new Uint32Array(geometry.index.array as ArrayLike<number>)
        : Uint32Array.from({ length: vertexCount }, (_, i) => i);

      const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
      if (target >= indices.length) return;

      const positions = new Float32Array(position.array as ArrayLike<number>);
      const [simplified] = MeshoptSimplifier.simplify(indices, positions, 3, target, 0.05, [
        "Permissive",
        "Sparse",
        "Prune",
      ]);

      /*
       * Normály NEpřepočítáváme — původní hladké normály z modelu drží plynulé
       * odlesky na laku. Přepočet z decimované sítě dělá "fazetový" povrch,
       * který v AR vypadá jako pomačkaný plech.
       */
      compactGeometry(geometry, simplified);
    });

    return clone;
  } catch (error) {
    console.warn("decimateForUSDZ: decimace selhala, exportuji plnou geometrii", error);
    return scene;
  }
}

/**
 * Zahodí vrcholy, které po decimaci nikdo nepoužívá. USDZ je textový formát,
 * takže každý zbytečný vrchol = ~60 bajtů navíc ve výsledném souboru.
 */
function compactGeometry(geometry: THREE.BufferGeometry, indices: Uint32Array) {
  const remap = new Map<number, number>();
  const order: number[] = [];
  const newIndices = new Uint32Array(indices.length);

  for (let i = 0; i < indices.length; i++) {
    const old = indices[i];
    let next = remap.get(old);
    if (next === undefined) {
      next = order.length;
      remap.set(old, next);
      order.push(old);
    }
    newIndices[i] = next;
  }

  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
    const itemSize = attribute.itemSize;
    const source = attribute.array as ArrayLike<number>;
    const packed = new Float32Array(order.length * itemSize);
    for (let i = 0; i < order.length; i++) {
      for (let c = 0; c < itemSize; c++) packed[i * itemSize + c] = source[order[i] * itemSize + c];
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(packed, itemSize, attribute.normalized));
  }

  geometry.setIndex(Array.from(newIndices));
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
export async function compressGLB(
  input: Blob,
  onProgress?: (p: CompressProgress) => void,
): Promise<Blob> {
  try {
    const out = await compressGLBBuffer(await input.arrayBuffer(), onProgress);
    return out ? new Blob([out], { type: "model/gltf-binary" }) : input;
  } catch (error) {
    console.warn("compressGLB: komprese selhala, publikuji nekomprimovaný model", error);
    return input;
  }
}

/**
 * Stejná komprese, ale ve Web Workeru — hlavní vlákno (a tím i admin UI)
 * zůstane plynulé a průběh se hlásí přes `onProgress`.
 *
 * Když Worker není k dispozici (starší prohlížeč, blokovaný modul),
 * automaticky se použije synchronní varianta.
 */
export async function compressGLBInWorker(
  input: Blob,
  onProgress?: (p: CompressProgress) => void,
): Promise<Blob> {
  if (typeof Worker === "undefined") return compressGLB(input, onProgress);

  try {
    const worker = new Worker(new URL("./glbCompress.worker.ts", import.meta.url), {
      type: "module",
    });
    const buffer = await input.arrayBuffer();

    const result = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;
        if (data.type === "progress") onProgress?.(data.progress);
        else if (data.type === "done") resolve(data.buffer);
        else reject(new Error(data.message));
      };
      worker.onerror = (e) => reject(new Error(e.message || "Worker selhal"));
      worker.postMessage({ buffer }, [buffer]);
    }).finally(() => worker.terminate());

    return result ? new Blob([result], { type: "model/gltf-binary" }) : input;
  } catch (error) {
    console.warn("compressGLBInWorker: fallback do hlavního vlákna", error);
    return compressGLB(input, onProgress);
  }
}



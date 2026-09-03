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
import type { AppearanceProfile, Damage } from "./appearance";
import { resolveWheel, wheelMaterial } from "./wheelCatalog";
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
  return (
    (n.includes("window") || n.includes("sklo") || n.includes("windshield")) &&
    !n.includes("light")
  );
};
/**
 * Tmavé plasty a mřížka. Musí se řešit DŘÍV než chrom — jinak z černých
 * lišt a mřížky vznikne bílý „chromový“ flek pod maskou.
 */
const isDarkPlastic = (name: string) => {
  const n = name.toLowerCase();
  return (
    n.includes("blacktrim") ||
    n.includes("black1") ||
    n.includes("grill") ||
    n.includes("default_material") ||
    n === "material" ||
    /^material_\d+$/.test(n)
  );
};
const isTrim = (name: string) => {
  const n = name.toLowerCase();
  if (isDarkPlastic(name)) return false;
  return n.includes("chrome") || n.includes("trim") || n.includes("molding");
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
/** Brzdové třmeny — grafitový kov, nikdy světlá plocha v kole. */
const isCaliper = (name: string) => name.toLowerCase().includes("caliper");
/**
 * Brzdové kotouče. Bez vlastního pravidla si nechávaly světlý základní
 * materiál a přes výplet disku prosvítaly jako bílý flek — přesně ten
 * „duch v kole“, který byl vidět u každé barvy laku.
 */
const isRotor = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("rotor") || n.includes("brakedisc") || n.includes("kotouc");
};
/** Denní svícení — musí svítit, ne být bílý flek v masce. */
const isDRL = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("drl") || n.includes("reflector");
};
/** Čirý kryt světla (lens). */
const isLightLens = (name: string) => {
  const n = name.toLowerCase();
  return (n.includes("light") || n.includes("lamp") || n.includes("tail")) && n.includes("glass");
};
/** Tělo světlometu za krytem — tmavé, matné. */
const isLightHousing = (name: string) => {
  const n = name.toLowerCase();
  return (n.includes("light") || n.includes("lamp") || n.includes("tail")) && !n.includes("glass");
};
const isLight = (name: string) => isLightLens(name) || isLightHousing(name);
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

/*
 * ============================ POŠKOZENÍ ============================
 *
 * PROČ SE ZMĚNIL PŘÍSTUP
 * Poškození se dřív kreslilo do UV textury karoserie. UV mapa Pacifiky se ale
 * na několika panelech opakuje, takže:
 *   a) zadané poškození na dveřích se často nezobrazilo vůbec (padlo do části
 *      textury, která na dveřích není), a
 *   b) přemalovaná textura + clearcoat vytvářely na hladkém laku světlé šmouhy,
 *      které zákazník čte jako škrábance, i když vůz žádné zadané nemá.
 *
 * Nově se poškození vkládá jako samostatné „decal“ plošky umístěné geometricky
 * podle bounding boxu vozu. Zadaná hodnota se tak promítne VŽDY a přesně na
 * daný panel, a lak samotný zůstane nedotčený — žádné falešné škrábance
 * z odlesků.
 */

type DecalOrientation = "left" | "right" | "front" | "rear" | "top";

/** Kde na vozu daný panel leží: podíl délky (0 = předek, 1 = zadek) + výška. */
const DAMAGE_ANCHORS: Record<
  string,
  { along: number; height: number; face: DecalOrientation }
> = {
  predni_naraznik: { along: 0.02, height: 0.28, face: "front" },
  zadni_naraznik: { along: 0.98, height: 0.28, face: "rear" },
  dvere_levo: { along: 0.5, height: 0.42, face: "left" },
  dvere_pravo: { along: 0.5, height: 0.42, face: "right" },
  blatnik: { along: 0.2, height: 0.42, face: "left" },
  kapota: { along: 0.13, height: 0.99, face: "top" },
  paty_dvere: { along: 0.96, height: 0.55, face: "rear" },
  strecha: { along: 0.5, height: 1, face: "top" },
  jine: { along: 0.62, height: 0.45, face: "left" },
};

const DAMAGE_SIZE_M: Record<string, number> = {
  lehke: 0.16,
  stredni: 0.28,
  vyrazne: 0.44,
};

/**
 * Textura jednoho poškození s průhledným okolím.
 * Kreslí se v poměru 1:1 nad velikost decalu, takže rozsah odpovídá severitě.
 */
const damageDecalTexture = (damage: Damage): THREE.Texture | null => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  const c = size / 2;

  if (damage.type === "dulek") {
    // Promáčklina: tmavé jádro s měkkým přechodem + světlý horní okraj.
    const grad = ctx.createRadialGradient(c, c * 0.9, 4, c, c, c * 0.9);
    grad.addColorStop(0, "rgba(0,0,0,0.42)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.16)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.9, 0, Math.PI * 2);
    ctx.fill();
  } else if (damage.type === "koroze") {
    ctx.fillStyle = "rgba(112,58,24,0.8)";
    ctx.beginPath();
    ctx.ellipse(c, c, c * 0.72, c * 0.46, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Nepravidelný okraj koroze — jinak vypadá jako nálepka.
    ctx.fillStyle = "rgba(80,40,16,0.55)";
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = c * (0.45 + Math.random() * 0.4);
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r * 0.6, 3 + Math.random() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (damage.type === "odrena_barva") {
    ctx.fillStyle = "rgba(178,180,186,0.85)";
    ctx.beginPath();
    ctx.ellipse(c, c, c * 0.7, c * 0.4, 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Škrábanec / řez: úzká rýha — tmavé dno a jen velmi jemný světlý okraj.
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(20,20,22,0.75)";
    ctx.lineWidth = damage.type === "rez" ? 9 : 6;
    ctx.beginPath();
    ctx.moveTo(c - c * 0.8, c + c * 0.16);
    ctx.lineTo(c + c * 0.8, c - c * 0.12);
    ctx.stroke();
    ctx.strokeStyle = "rgba(226,228,232,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c - c * 0.8, c + c * 0.16 + 4);
    ctx.lineTo(c + c * 0.8, c - c * 0.12 + 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `damage_${damage.part}_${damage.type}`;
  return texture;
};

/**
 * Umístí zadaná poškození na povrch vozu jako decal plošky.
 * Pozice se počítá z bounding boxu, takže funguje nezávisle na UV mapě.
 */
const applyDamageDecals = (root: THREE.Object3D, profile: AppearanceProfile) => {
  const damages = profile.damages ?? [];
  // Vždy nejdřív odstraníme decaly z předchozího průchodu (idempotentní).
  root.children
    .filter((child) => child.name === "damage_decals")
    .forEach((child) => root.remove(child));
  if (!damages.length) return;

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!Number.isFinite(size.x) || size.length() === 0) return;

  // Osu délky/šířky určíme z rozměrů (délka > šířka > výška u minivanu).
  const lengthAxis: "x" | "z" = size.x >= size.z ? "x" : "z";
  const widthAxis: "x" | "z" = lengthAxis === "x" ? "z" : "x";
  const lengthSize = lengthAxis === "x" ? size.x : size.z;
  const widthSize = widthAxis === "x" ? size.x : size.z;

  const group = new THREE.Group();
  group.name = "damage_decals";

  damages.forEach((damage, index) => {
    const anchor = DAMAGE_ANCHORS[damage.part] ?? DAMAGE_ANCHORS.jine;
    const texture = damageDecalTexture(damage);
    if (!texture) return;

    const plane = DAMAGE_SIZE_M[damage.severity] ?? DAMAGE_SIZE_M.stredni;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(plane * 1.6, plane),
      new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        roughness: damage.type === "dulek" ? 0.35 : 0.7,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
    );
    mesh.name = `damage_${index}_${damage.part}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const along = box.min[lengthAxis] + anchor.along * lengthSize;
    const y = box.min.y + anchor.height * size.y;
    // 1,5 cm nad povrchem — decal nesmí zapadnout do plechu ani plavat ve vzduchu.
    const lift = 0.015;

    const pos = new THREE.Vector3();
    if (anchor.face === "left" || anchor.face === "right") {
      const side = anchor.face === "left" ? -1 : 1;
      pos[lengthAxis] = along;
      pos[widthAxis] = box.min[widthAxis] + (side < 0 ? 0 : widthSize) + side * lift;
      pos.y = y;
      mesh.rotation.y = widthAxis === "x" ? (side < 0 ? -Math.PI / 2 : Math.PI / 2) : side < 0 ? Math.PI : 0;
    } else if (anchor.face === "top") {
      pos[lengthAxis] = along;
      pos[widthAxis] = box.min[widthAxis] + widthSize / 2;
      pos.y = box.min.y + anchor.height * size.y + lift;
      mesh.rotation.x = -Math.PI / 2;
      if (lengthAxis === "z") mesh.rotation.z = Math.PI / 2;
    } else {
      const front = anchor.face === "front" ? -1 : 1;
      pos[lengthAxis] = box.min[lengthAxis] + (front < 0 ? 0 : lengthSize) + front * lift;
      pos[widthAxis] = box.min[widthAxis] + widthSize / 2;
      pos.y = y;
      mesh.rotation.y = lengthAxis === "z" ? (front < 0 ? Math.PI : 0) : front < 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    mesh.position.copy(pos);
    group.add(mesh);
  });

  root.add(group);
};


/** Aplikuje profil na scénu (in-place). */
export function applyProfile(root: THREE.Object3D, profile: AppearanceProfile) {
  const bodyColor = new THREE.Color(profile.body_color_hex);
  const wheel = resolveWheel(profile.wheel_style);
  const wheels = wheelMaterial(wheel.finish);
  const interiorColor = new THREE.Color(profile.interior_color_hex || "#2b2b2e");


  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;

    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src) return;

    const name = src.name || mesh.name || "";

    if (isBody(name)) {
      const paint = new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        map: src.map ?? null,
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
      paint.name = name || "body_paint";
      mesh.material = paint;
      return;
    }

    // Tmavé plasty a mřížka — dřív než chrom, jinak zbělají.
    if (isDarkPlastic(name)) {
      const plastic = src.clone() as THREE.MeshStandardMaterial;
      plastic.color = new THREE.Color("#1c1d21");
      plastic.metalness = 0.15;
      plastic.roughness = 0.62;
      plastic.envMapIntensity = 0.6;
      mesh.material = plastic;
      return;
    }

    // Denní svícení / odrazky — svítí, ale nejsou to bílé plochy.
    if (isDRL(name)) {
      const n = name.toLowerCase();
      const isRear = n.includes("reflector");
      const drl = new THREE.MeshPhysicalMaterial({
        // Vypnuté LED nejsou bílé — jsou to světle šedé difuzory za čočkou.
        color: new THREE.Color(isRear ? "#7a0d12" : "#aab6c6"),
        metalness: 0,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: new THREE.Color(isRear ? "#5a0a0e" : "#7f9dd0"),
        emissiveIntensity: isRear ? 0.3 : 0.22,
        envMapIntensity: 0.55,
      });
      drl.name = name || "drl";
      mesh.material = drl;
      return;
    }

    // Tělo světlometu za krytem — tmavé, matné, nikdy bílé.
    if (isLightHousing(name)) {
      const housing = src.clone() as THREE.MeshStandardMaterial;
      housing.color = new THREE.Color("#0f1115");
      housing.metalness = 0.2;
      housing.roughness = 0.6;
      housing.envMapIntensity = 0.35;
      mesh.material = housing;
      return;
    }

    if (isLightLens(name)) {
      const rear = name.toLowerCase().includes("tail") || name.toLowerCase().includes("brake");
      /*
       * PROČ TAK TMAVÁ ČOČKA: dřív měla přední čočka barvu #dfe6ef a
       * emissive, takže se z ní na modelu udělal mléčně bílý flek — přesně ten
       * „bílý stín ve světlech“, který vypadal jako vada laku. Reálný krytý
       * světlometu je čirý a bere barvu tmavého vnitřku pod sebou.
       */
      const lamp = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(rear ? "#5e0a10" : "#20262e"),
        transparent: true,
        opacity: rear ? 0.9 : 0.62,
        roughness: 0.04,
        metalness: 0,
        transmission: rear ? 0.45 : 0.82,
        ior: 1.5,
        thickness: 0.004,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        emissive: new THREE.Color(rear ? "#3d0709" : "#000000"),
        emissiveIntensity: rear ? 0.22 : 0,
      });
      lamp.name = name || "lamp";
      mesh.material = lamp;
      return;
    }


    // Brzdové kotouče — tmavá ocel se stopou po broušení, ne světlý flek.
    if (isRotor(name)) {
      const rotor = src.clone() as THREE.MeshStandardMaterial;
      rotor.color = new THREE.Color("#3a3d42");
      rotor.metalness = 0.85;
      rotor.roughness = 0.5;
      rotor.envMapIntensity = 0.7;
      mesh.material = rotor;
      return;
    }

    // Brzdové třmeny — grafit, aby v kole nesvítil světlý flek.
    if (isCaliper(name)) {
      const caliper = src.clone() as THREE.MeshStandardMaterial;
      caliper.color = new THREE.Color("#33373d");
      caliper.metalness = 0.75;
      caliper.roughness = 0.42;
      caliper.envMapIntensity = 0.8;
      mesh.material = caliper;
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
        /*
         * Chrom je zrcadlo, ne bílá barva. #e6e8ea s metalness 1 a
         * envMapIntensity 1,4 přesvítilo lišty i rám mřížky do bílé —
         * na fotce to vypadalo jako bílý stín kolem masky.
         */
        trim.color = new THREE.Color("#b7bcc2");
        trim.metalness = 1;
        trim.roughness = 0.16;
      }
      trim.envMapIntensity = 1;
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

    /*
     * Disky: parametry přebírá vždy konkrétní OEM kolo z katalogu (Mopar
     * diagram). Žádný fallback „nechat jak je“ — jinak měl každý vůz jiná kola.
     */
    if (isWheel(name)) {
      const rim = src.clone() as THREE.MeshStandardMaterial;
      rim.color = new THREE.Color(wheels.hex);
      rim.metalness = wheels.metalness;
      rim.roughness = wheels.roughness;
      rim.envMapIntensity = 1.05;
      mesh.material = rim;
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

  // Poškození až nakonec — decaly se nesmí přebarvit lakem ani plastem.
  applyDamageDecals(root, profile);
}


/** Postaví scénu konkrétního vozu z base modelu + profilu. */
export async function buildVehicleScene(profile: AppearanceProfile): Promise<THREE.Group> {
  const scene = await loadBaseModel();
  applyProfile(scene, profile);
  return scene;
}

/**
 * Skutečné fyzické rozměry Chrysler Pacifica (RU, MY2017+) v metrech.
 * Slouží jako referenční délka pro 1:1 měřítko v AR — stejná hodnota jako
 * u HQ masteru v `pacificaModels.ts`, aby vůz z nabídky nebyl maketa.
 */
export const REAL_DIMENSIONS_M = {
  length: 5.193,
  width: 2.2989,
  height: 1.7514,
} as const;

export type ExportBundle = {
  /** Scéna připravená k exportu (1 unit = 1 m, Y-up, stojí na Y = 0). */
  scene: THREE.Group;
  /** Změřený bounding box po normalizaci — v metrech. */
  dimensions: { length: number; width: number; height: number };
  /** Uvolní pomocné objekty po exportu. */
  dispose: () => void;
};

/**
 * Připraví JEDNU scénu, ze které se exportuje GLB i USDZ.
 *
 * PROČ JEDNA SCÉNA PRO OBA FORMÁTY: dřív se GLB i USDZ exportovaly ze dvou
 * různých průchodů; když jeden z nich selhal, u vozu skončil GLB v jedné
 * konfiguraci a USDZ v jiné (nebo vůbec). Takhle jsou oba soubory zaručeně
 * tentýž vůz — stejná geometrie, barva, kola i poškození.
 *
 * MĚŘÍTKO: obal (`Group`) dostane uniformní scale tak, aby délka vozu byla
 * přesně 5,193 m a spodek pneumatik ležel na Y = 0. Scale se aplikuje TADY,
 * při exportu — nikdy runtime v AR, takže GLB i USDZ jsou fyzicky konzistentní.
 *
 * PAMĚŤ: klonuje se pouze struktura uzlů (`clone(true)` sdílí BufferGeometry
 * i materiály). Plný deep-clone milionu trojúhelníků byl hlavní příčinou pádu
 * karty prohlížeče při publikaci.
 */
export function prepareForExport(source: THREE.Object3D): ExportBundle {
  const wrapper = new THREE.Group();
  wrapper.name = "vehicle_root";

  const model = source.clone(true) as THREE.Group;
  wrapper.add(model);
  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  // Délka = největší horizontální rozměr (model může být orientovaný na X i Z).
  const measuredLength = Math.max(size.x, size.z);
  const scale = measuredLength > 0.01 ? REAL_DIMENSIONS_M.length / measuredLength : 1;

  model.scale.multiplyScalar(scale);
  wrapper.updateMatrixWorld(true);

  // Posadit na Y = 0 a vycentrovat vodorovně (AR anchor = střed vozu).
  const scaled = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaled.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaled.min.y;
  wrapper.updateMatrixWorld(true);

  const final = new THREE.Box3().setFromObject(model);
  const finalSize = new THREE.Vector3();
  final.getSize(finalSize);

  return {
    scene: wrapper,
    dimensions: {
      length: Number(Math.max(finalSize.x, finalSize.z).toFixed(4)),
      width: Number(Math.min(finalSize.x, finalSize.z).toFixed(4)),
      height: Number(finalSize.y.toFixed(4)),
    },
    dispose: () => {
      wrapper.clear();
    },
  };
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
      { binary: true, onlyVisible: true, maxTextureSize: 4096 },
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
export async function exportUSDZ(scene: THREE.Object3D, ratio = 0.7): Promise<Blob> {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");

  /*
   * USDZ je ZIP BEZ komprese a geometrie se do něj zapisuje TEXTOVĚ, proto
   * geometrii zjednodušujeme — ALE POUZE tam, kde to zákazník nevidí.
   *
   * PROČ: dřívější globální decimace (72 % trojúhelníků dolů) kolabovala hrany
   * i na karoserii, sklech a discích. Model Pacifiky je „trojúhelníková
   * polévka“ bez sdílených vrcholů, takže kolaps přes švy zvlnil plechy a lak
   * v AR vypadal jako po bouračce. Vnější povrch teď zůstává přesně takový,
   * jaký je v původním modelu.
   */
  const light = await decimateForUSDZ(scene, ratio);

  // Necháme prohlížeč vydechnout (uvolní paměť po decimaci) — bez tohoto
  // yieldu se USDZ export a decimace potkaly ve stejném GC okně a karta padala.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const exporter = new USDZExporter();
  /*
   * 2048 px textury. PROČ NE 4096: USDZ nese textury NEKOMPRIMOVANÉ a
   * exportér si je nejdřív celé vyrenderuje do canvasu v paměti. Se 4096 px
   * a plnou geometrií karta prohlížeče vyčerpala paměť a spadla ještě před
   * dokončením publikace. 2048 px je na iPhonu vizuálně nerozlišitelné.
   */
  const result = await exporter.parseAsync(light, { maxTextureSize: 2048 });
  return new Blob([result as unknown as BlobPart], { type: "model/vnd.usdz+zip" });
}



/**
 * Povrchy, které tvoří vzhled vozu: karoserie, skla, chrom, světla, kola,
 * pneumatiky. Tyto NIKDY nedecimujeme — každý kolaps hrany se na lesklém
 * laku projeví jako vlna nebo promáčklina.
 */
const isShowSurface = (name: string) =>
  isBody(name) || isGlass(name) || isTrim(name) || isLight(name) || isWheel(name) || isTire(name);

/**
 * Decimace scény pro USDZ — jen skrytá/nelesklá geometrie (interiér, podvozek,
 * vnitřní výplně). Používá `LockBorder`, aby se okraje ploch nehýbaly, takže
 * nikde nevzniknou dírky ani zvlnění.
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

    /*
     * PAMĚŤ: klonuje se jen struktura uzlů — geometrie a materiály se sdílí
     * s náhledem. Vlastní kopii geometrie dostane pouze mesh, který se
     * skutečně decimuje (níže), takže se náhled ani cache nepoškodí.
     * Plný deep-clone celého vozu tady dřív zabil kartu prohlížeče (OOM)
     * a publikace „PUBLIKOVAT PRO AR“ spadla ještě před zápisem do databáze.
     */
    const clone = scene.clone(true) as THREE.Group;
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const name = `${material?.name ?? ""} ${mesh.name ?? ""}`;

      // Vnější, lesklé plochy zůstávají v plné kvalitě.
      if (isShowSurface(name)) return;

      const original = mesh.geometry as THREE.BufferGeometry;
      const position = original.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!position) return;

      const geometry = original.clone() as THREE.BufferGeometry;
      mesh.geometry = geometry;

      const vertexCount = position.count;

      const indices = geometry.index
        ? new Uint32Array(geometry.index.array as ArrayLike<number>)
        : Uint32Array.from({ length: vertexCount }, (_, i) => i);

      const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
      if (target >= indices.length) return;

      const positions = new Float32Array(position.array as ArrayLike<number>);
      const [simplified] = MeshoptSimplifier.simplify(indices, positions, 3, target, 0.01, [
        "LockBorder",
        "Sparse",
        "Prune",
      ]);

      /*
       * Normály NEpřepočítáváme — původní hladké normály z modelu drží plynulé
       * odlesky. Přepočet z decimované sítě dělá "fazetový" povrch.
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



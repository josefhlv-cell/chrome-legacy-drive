import { supabase } from "@/integrations/supabase/client";
import { computeBlurScore, fileToBase64, processImage } from "./imageProcessing";
import { isMainShot, qualityTip, type CaptureProgress } from "./workflow";
import type { ShotType } from "./types";

export type QueuedPhoto = {
  id: string; sessionId: string; shotType: ShotType; shotIndex: number;
  blob: Blob; preview: string; status: "uploading" | "done" | "error";
  autoProcess: boolean; aiEnabled: boolean; error?: string; tip?: string;
  progress?: CaptureProgress;
};
type StoredPhoto = Omit<QueuedPhoto, "preview">;
let items: QueuedPhoto[] = [];
const listeners = new Set<() => void>();
const running = new Set<string>();
const persisting = new Set<string>();
const dropped = new Set<string>();
let dbPromise: Promise<IDBDatabase> | undefined;
const emit = () => listeners.forEach(fn => fn());

function database() {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("chdp-capture-queue", 1);
    let expired = false;
    const timeout = setTimeout(() => { expired = true; dbPromise = undefined; reject(new Error("Úložiště telefonu nereaguje. Zavřete ostatní karty s focením a zkuste to znovu.")); }, 10000);
    request.onupgradeneeded = () => request.result.createObjectStore("photos", { keyPath: "id" });
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (expired) { request.result.close(); return; }
      request.result.onversionchange = () => { request.result.close(); dbPromise = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { clearTimeout(timeout); if (!expired) dbPromise = undefined; reject(request.error); };
  });
  return dbPromise;
}
async function store(photo: QueuedPhoto, remove = false) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    // Abort before rejecting: never advance for a timed-out, uncommitted photograph.
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; try { tx.abort(); } catch { /* A completed transaction will settle through oncomplete. */ } }, 10000);
    const { preview: _preview, ...stored } = photo;
    if (remove) tx.objectStore("photos").delete(photo.id);
    else tx.objectStore("photos").put(stored);
    tx.oncomplete = () => { clearTimeout(timeout); resolve(); };
    tx.onerror = () => { clearTimeout(timeout); reject(tx.error); };
    tx.onabort = () => { clearTimeout(timeout); reject(timedOut ? new Error("Uložení do telefonu trvá příliš dlouho. Zkuste fotografii uložit znovu.") : tx.error); };
  });
}
export async function persistQueuedPhoto(photo: QueuedPhoto) {
  await store(photo);
}
function change(id: string, patch: Partial<QueuedPhoto>) {
  items = items.map(p => p.id === id ? { ...p, ...patch } : p);
  emit();
}

export async function uploadCapturePhoto(photo: QueuedPhoto) {
  if (dropped.has(photo.id)) return;
  const processed = photo.autoProcess ? await processImage(photo.blob) : { blob: photo.blob, width: 0, height: 0 };
  const base = `${photo.sessionId}/${photo.id}_${photo.shotIndex}_${photo.shotType}`;
  const originalPath = `${base}_orig.jpg`, processedPath = `${base}_web.jpg`;
  const bucket = supabase.storage.from("smart-capture");
  const results = await Promise.all([
    bucket.upload(originalPath, photo.blob, { contentType: "image/jpeg", upsert: true }),
    bucket.upload(processedPath, processed.blob, { contentType: "image/jpeg", upsert: true }),
  ]);
  for (const result of results) if (result.error) throw result.error;
  if (dropped.has(photo.id)) return;
  const { error } = await supabase.from("smart_capture_photos").upsert({
    id: photo.id, session_id: photo.sessionId, shot_type: photo.shotType, shot_index: photo.shotIndex,
    original_url: bucket.getPublicUrl(originalPath).data.publicUrl,
    processed_url: bucket.getPublicUrl(processedPath).data.publicUrl,
    width: processed.width, height: processed.height, is_main: isMainShot(photo.shotType),
  }, { onConflict: "id" });
  if (error) throw error;
  if (dropped.has(photo.id)) {
    await supabase.from("smart_capture_photos").delete().eq("id", photo.id);
    return;
  }
  // Advisory enrichment must never hold up upload or turn a saved photo into an error.
  if (photo.aiEnabled) void (async () => {
    try {
      const bitmap = await createImageBitmap(photo.blob);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) { bitmap.close(); return; }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const small = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Náhled se nevytvořil")), "image/jpeg", 0.8));
      const [blur, response] = await Promise.all([
        computeBlurScore(small).catch(() => 50),
        fileToBase64(small).then(imageBase64 => supabase.functions.invoke("smart-capture-analyze", { body: { imageBase64 } })),
      ]);
      const ai = response.error ? {} : response.data ?? {};
      change(photo.id, { tip: qualityTip(ai, blur) });
      await supabase.from("smart_capture_photos").update({
        quality: { blur, ai }, quality_score: ai.quality_score ?? blur, ai_classification: ai,
      }).eq("id", photo.id);
    } catch { /* advice is optional */ }
  })();
}

async function run(photo: QueuedPhoto) {
  if (running.has(photo.id)) return;
  running.add(photo.id);
  change(photo.id, { status: "uploading", error: undefined });
  try {
    if (dropped.has(photo.id)) return;
    await store({ ...photo, status: "uploading" });
    if (dropped.has(photo.id)) { await store(photo, true).catch(() => undefined); return; }
    await uploadCapturePhoto(photo);
    if (dropped.has(photo.id)) { await store(photo, true).catch(() => undefined); return; }
    change(photo.id, { status: "done" });
    // A local cleanup error must not turn a successfully saved photo into failure.
    await store(photo, true).catch(() => undefined);
    const saved = items.find(p => p.id === photo.id);
    if (saved) {
      URL.revokeObjectURL(saved.preview);
      const publicUrl = supabase.storage.from("smart-capture").getPublicUrl(`${photo.sessionId}/${photo.id}_${photo.shotIndex}_${photo.shotType}_web.jpg`).data.publicUrl;
      change(photo.id, { preview: publicUrl, blob: new Blob() });
    }
  } catch (e) {
    if (dropped.has(photo.id)) { await store(photo, true).catch(() => undefined); return; }
    change(photo.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
    await store({ ...photo, status: "error" }).catch(() => undefined);
  } finally {
    running.delete(photo.id);
    pump();
  }
}
function pump() {
  // One full-resolution job at a time bounds memory on phones.
  if (running.size) return;
  const photo = items.find(p => p.status === "uploading" && !running.has(p.id) && !persisting.has(p.id));
  if (photo) void run(photo);
}
export async function enqueuePhoto(input: Omit<QueuedPhoto, "id" | "status" | "preview">) {
  const photo: QueuedPhoto = { ...input, id: crypto.randomUUID(), preview: URL.createObjectURL(input.blob), status: "uploading" };
  persisting.add(photo.id);
  items = [...items, photo]; emit();
  try {
    // The acceptance boundary is the completed local transaction, NEVER network/AI.
    await persistQueuedPhoto(photo);
    return photo;
  } catch (e) {
    items = items.filter(p => p.id !== photo.id); URL.revokeObjectURL(photo.preview); emit();
    throw e;
  } finally { persisting.delete(photo.id); pump(); }
}
export function retryPhoto(id: string) {
  change(id, { status: "uploading", error: undefined }); pump();
}
export function retrySessionPhotos(sessionId: string) {
  for (const photo of items) if (photo.sessionId === sessionId && photo.status === "error") retryPhoto(photo.id);
}
/** Drop queued shots for a session, or one shot type when replacing a single frame. */
export async function discardQueuedPhotos(sessionId: string, shotType?: ShotType) {
  const drop = items.filter(p => p.sessionId === sessionId && (!shotType || p.shotType === shotType));
  for (const photo of drop) dropped.add(photo.id);
  if (!drop.length) return;
  items = items.filter(p => !drop.some(d => d.id === p.id));
  emit();
  await Promise.all(drop.map(async photo => {
    if (photo.preview.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
    await store(photo, true).catch(() => undefined);
  }));
}
export async function restoreQueue(sessionId: string) {
  const db = await database();
  const stored = await new Promise<StoredPhoto[]>((resolve, reject) => {
    const req = db.transaction("photos").objectStore("photos").getAll();
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: session, error } = await supabase.from("smart_capture_sessions").select("id").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  if (error || !session) return;
  const owned = stored.filter(p => p.sessionId === sessionId);
  await Promise.all(owned.filter(p => dropped.has(p.id)).map(p => store({ ...p, preview: "" }, true).catch(() => undefined)));
  const fresh = owned.filter(p => !dropped.has(p.id) && !items.some(i => i.id === p.id));
  items = [...items, ...fresh.map(p => ({ ...p, status: "uploading" as const, error: undefined, preview: URL.createObjectURL(p.blob) }))];
  emit(); pump();
  return stored.filter(p => p.sessionId === sessionId);
}
export const photoQueue = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getSnapshot: () => items,
};
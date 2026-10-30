import { supabase } from "@/integrations/supabase/client";
import { computeBlurScore, fileToBase64, processImage } from "./imageProcessing";
import { isMainShot, qualityTip } from "./workflow";
import type { ShotType } from "./types";

export type QueuedPhoto = {
  id: string; sessionId: string; shotType: ShotType; shotIndex: number;
  blob: Blob; preview: string; status: "uploading" | "done" | "error";
  autoProcess: boolean; aiEnabled: boolean; error?: string; tip?: string;
};
type StoredPhoto = Omit<QueuedPhoto, "preview">;
let items: QueuedPhoto[] = [];
const listeners = new Set<() => void>();
const running = new Set<string>();
let dbPromise: Promise<IDBDatabase> | undefined;
const emit = () => listeners.forEach(fn => fn());

function database() {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("chdp-capture-queue", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = undefined; reject(request.error); };
  });
  return dbPromise;
}
async function store(photo: QueuedPhoto, remove = false) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    const { preview: _preview, ...stored } = photo;
    if (remove) tx.objectStore("photos").delete(photo.id);
    else tx.objectStore("photos").put(stored);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
function change(id: string, patch: Partial<QueuedPhoto>) {
  items = items.map(p => p.id === id ? { ...p, ...patch } : p);
  emit();
}

export async function uploadCapturePhoto(photo: QueuedPhoto) {
  const processed = photo.autoProcess ? await processImage(photo.blob) : { blob: photo.blob, width: 0, height: 0 };
  const base = `${photo.sessionId}/${photo.id}_${photo.shotIndex}_${photo.shotType}`;
  const originalPath = `${base}_orig.jpg`, processedPath = `${base}_web.jpg`;
  const bucket = supabase.storage.from("smart-capture");
  const results = await Promise.all([
    bucket.upload(originalPath, photo.blob, { contentType: "image/jpeg", upsert: true }),
    bucket.upload(processedPath, processed.blob, { contentType: "image/jpeg", upsert: true }),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const { error } = await supabase.from("smart_capture_photos").upsert({
    id: photo.id, session_id: photo.sessionId, shot_type: photo.shotType, shot_index: photo.shotIndex,
    original_url: bucket.getPublicUrl(originalPath).data.publicUrl,
    processed_url: bucket.getPublicUrl(processedPath).data.publicUrl,
    width: processed.width, height: processed.height, is_main: isMainShot(photo.shotType),
  }, { onConflict: "id" });
  if (error) throw error;
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
    await store({ ...photo, status: "uploading" });
    await uploadCapturePhoto(photo);
    change(photo.id, { status: "done" });
    await store(photo, true);
  } catch (e) {
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
  const photo = items.find(p => p.status === "uploading" && !running.has(p.id));
  if (photo) void run(photo);
}
export function enqueuePhoto(input: Omit<QueuedPhoto, "id" | "status" | "preview">) {
  const photo: QueuedPhoto = { ...input, id: crypto.randomUUID(), preview: URL.createObjectURL(input.blob), status: "uploading" };
  items = [...items, photo]; emit();
  // Persist every accepted photo immediately, including jobs waiting behind another upload.
  void store(photo).then(pump).catch(e => change(photo.id, { status: "error", error: String(e) }));
  return photo;
}
export function retryPhoto(id: string) {
  change(id, { status: "uploading", error: undefined }); pump();
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
  const fresh = stored.filter(p => p.sessionId === sessionId && !items.some(i => i.id === p.id));
  items = [...items, ...fresh.map(p => ({ ...p, preview: URL.createObjectURL(p.blob) }))];
  emit(); pump();
}
export const photoQueue = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getSnapshot: () => items,
};
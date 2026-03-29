import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vehicles";
const BASE_URL = `https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/${BUCKET}`;
const MIN_VALID_IMAGE_SIZE = 10000;
const MAX_GALLERY_SCAN = 120;

type FileMeta = {
  size: number;
};

// Cache full file metadata so we don't re-fetch on every vehicle
let fileListCache: Map<string, FileMeta> | null = null;
let fileListPromise: Promise<Map<string, FileMeta>> | null = null;

const getFileList = async (): Promise<Map<string, FileMeta>> => {
  if (fileListCache) return fileListCache;
  if (fileListPromise) return fileListPromise;

  fileListPromise = (async () => {
    const allFiles = new Map<string, FileMeta>();
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const { data } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: batchSize, offset });

      if (!data || data.length === 0) break;

      for (const f of data) {
        const size = typeof f.metadata?.size === "number"
          ? f.metadata.size
          : Number(f.metadata?.size ?? 0);

        allFiles.set(f.name, { size: Number.isFinite(size) ? size : 0 });
      }

      if (data.length < batchSize) break;
      offset += batchSize;
    }

    fileListCache = allFiles;
    return fileListCache;
  })();

  return fileListPromise;
};

/**
 * Given a main image URL like .../IMG_7445.jpg,
 * finds sequential gallery images while skipping broken tiny files.
 */
export const useVehicleGallery = (mainImageUrl: string | undefined) => {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mainImageUrl) {
      setImages([]);
      setLoading(false);
      return;
    }

    const fetchGallery = async () => {
      setLoading(true);

      const filename = mainImageUrl.split("/").pop() || "";
      const match = filename.match(/IMG_(\d+)/i);

      if (!match) {
        setImages([mainImageUrl]);
        setLoading(false);
        return;
      }

      const baseNum = parseInt(match[1], 10);

      try {
        const fileMap = await getFileList();

        const gallery: string[] = [mainImageUrl];
        let missingStreak = 0;

        for (let i = 1; i <= MAX_GALLERY_SCAN; i++) {
          const nextName = `IMG_${String(baseNum + i).padStart(4, "0")}.jpg`;
          const meta = fileMap.get(nextName);

          if (!meta) {
            missingStreak += 1;
            if (missingStreak >= 8) break;
            continue;
          }

          missingStreak = 0;

          if (meta.size < MIN_VALID_IMAGE_SIZE) {
            continue;
          }

          gallery.push(`${BASE_URL}/${nextName}`);
        }

        setImages(Array.from(new Set(gallery)));
      } catch (err) {
        console.error("Gallery fetch error:", err);
        setImages([mainImageUrl]);
      }

      setLoading(false);
    };

    fetchGallery();
  }, [mainImageUrl]);

  return { images, loading };
};

export const uploadVehicleImage = async (file: File, filename?: string) => {
  const name = filename || `IMG_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(name, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return `${BASE_URL}/${name}`;
};

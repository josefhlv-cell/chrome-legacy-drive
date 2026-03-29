import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vehicles";
const BASE_URL = `https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/${BUCKET}`;
const MIN_VALID_IMAGE_SIZE = 10000;

type FileMeta = {
  size: number;
  num: number | null; // parsed IMG number, null for non-standard names
};

// Cache full file metadata so we don't re-fetch on every vehicle
let fileListCache: Map<string, FileMeta> | null = null;
let fileListPromise: Promise<Map<string, FileMeta>> | null = null;

const parseImgNum = (name: string): number | null => {
  const m = name.match(/IMG_(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
};

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

        allFiles.set(f.name, {
          size: Number.isFinite(size) ? size : 0,
          num: parseImgNum(f.name),
        });
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
 * finds nearby gallery images by proximity of IMG number.
 * Looks for real images (>10KB) within ±120 of the main image number,
 * sorted by IMG number ascending.
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
      const baseNum = parseImgNum(filename);

      if (baseNum === null) {
        setImages([mainImageUrl]);
        setLoading(false);
        return;
      }

      try {
        const fileMap = await getFileList();

        // Find all valid images within ±120 of the base number
        const nearby: { name: string; num: number }[] = [];
        for (const [name, meta] of fileMap) {
          if (meta.num === null) continue;
          if (meta.size < MIN_VALID_IMAGE_SIZE) continue;
          if (Math.abs(meta.num - baseNum) <= 120) {
            nearby.push({ name, num: meta.num });
          }
        }

        // Sort by IMG number
        nearby.sort((a, b) => a.num - b.num);

        // Build gallery: main image first, then the rest
        const mainName = filename;
        const gallery = [mainImageUrl];
        for (const item of nearby) {
          if (item.name !== mainName) {
            gallery.push(`${BASE_URL}/${item.name}`);
          }
        }

        setImages(gallery);
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
  // Invalidate cache so new uploads appear in gallery
  fileListCache = null;
  fileListPromise = null;
  return `${BASE_URL}/${name}`;
};

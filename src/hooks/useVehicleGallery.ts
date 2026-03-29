import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vehicles";
const BASE_URL = `https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/${BUCKET}`;

// Cache the full file list so we don't re-fetch on every vehicle
let fileListCache: Set<string> | null = null;
let fileListPromise: Promise<Set<string>> | null = null;

const getFileList = async (): Promise<Set<string>> => {
  if (fileListCache) return fileListCache;
  if (fileListPromise) return fileListPromise;

  fileListPromise = (async () => {
    const allFiles: string[] = [];
    let offset = 0;
    const batchSize = 1000;

    // Paginate through all files in the bucket
    while (true) {
      const { data } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: batchSize, offset });

      if (!data || data.length === 0) break;
      allFiles.push(...data.map((f) => f.name));
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    fileListCache = new Set(allFiles);
    return fileListCache;
  })();

  return fileListPromise;
};

/**
 * Given a main image URL like .../IMG_7445.jpg,
 * finds all sequential gallery images (IMG_7446, IMG_7447, ...) in the bucket.
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
      const match = filename.match(/IMG_(\d+)/);

      if (!match) {
        setImages([mainImageUrl]);
        setLoading(false);
        return;
      }

      const baseNum = parseInt(match[1], 10);

      try {
        const fileSet = await getFileList();

        const gallery: string[] = [mainImageUrl];
        for (let i = 1; i <= 50; i++) {
          const nextName = `IMG_${String(baseNum + i).padStart(4, "0")}.jpg`;
          if (fileSet.has(nextName)) {
            gallery.push(`${BASE_URL}/${nextName}`);
          } else {
            break;
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
  return `${BASE_URL}/${name}`;
};

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vehicles";
const BASE_URL = `https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/${BUCKET}`;

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

      // Extract filename from URL (e.g., IMG_7445.jpg)
      const filename = mainImageUrl.split("/").pop() || "";
      const match = filename.match(/IMG_(\d+)/);

      if (!match) {
        setImages([mainImageUrl]);
        setLoading(false);
        return;
      }

      const baseNum = parseInt(match[1], 10);

      // List all files in bucket
      const { data: files } = await supabase.storage.from(BUCKET).list("", { limit: 1500 });

      if (!files) {
        setImages([mainImageUrl]);
        setLoading(false);
        return;
      }

      // Find sequential images starting from baseNum
      const gallery: string[] = [mainImageUrl];
      for (let i = 1; i <= 35; i++) {
        const nextName = `IMG_${String(baseNum + i).padStart(4, "0")}.jpg`;
        if (files.some((f) => f.name === nextName)) {
          gallery.push(`${BASE_URL}/${nextName}`);
        } else {
          break; // Stop at first gap
        }
      }

      setImages(gallery);
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

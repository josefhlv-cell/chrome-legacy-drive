const imageDimensionCache = new Map<string, Promise<{ width: number; height: number } | null>>();

const loadImageDimensions = (url: string) => {
  if (!url) return Promise.resolve(null);

  const cached = imageDimensionCache.get(url);
  if (cached) return cached;

  const promise = new Promise<{ width: number; height: number } | null>((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  imageDimensionCache.set(url, promise);
  return promise;
};

export const dedupeImageUrls = (urls: Array<string | null | undefined>) =>
  Array.from(new Set(urls.filter((url): url is string => Boolean(url))));

export const findPreferredLandscapeIndex = async (urls: string[]) => {
  if (!urls.length) return -1;

  const dimensions = await Promise.all(urls.map(loadImageDimensions));
  const preferredIndex = dimensions.findIndex(
    (dimension) => dimension !== null && dimension.width >= dimension.height,
  );

  return preferredIndex >= 0 ? preferredIndex : 0;
};

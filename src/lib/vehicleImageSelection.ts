export const dedupeImageUrls = (urls: Array<string | null | undefined>) =>
  Array.from(new Set(urls.filter((url): url is string => Boolean(url))));

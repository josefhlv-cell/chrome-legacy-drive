export type ShowroomImageLike = {
  image_url?: string | null;
  showroom_url?: string | null;
  showroom_applied_at?: string | null;
};

export const getPublicVehicleImageUrl = (image: ShowroomImageLike): string => {
  if (image.showroom_applied_at && image.showroom_url) return image.showroom_url;
  return image.image_url || "";
};

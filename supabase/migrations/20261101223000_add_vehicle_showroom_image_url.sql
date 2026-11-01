-- A showroom render is a separate offer-only asset. It must never replace
-- the original vehicle gallery or the catalogue-card image.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS showroom_image_url text;

COMMENT ON COLUMN public.vehicles.showroom_image_url IS
  'Optional standalone showroom image shown only as the first image in the vehicle offer detail; never used by catalogue cards or vehicle gallery storage.';

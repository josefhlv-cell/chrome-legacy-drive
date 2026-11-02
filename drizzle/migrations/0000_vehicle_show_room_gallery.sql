ALTER TABLE public.vehicles ADD COLUMN show_room_images jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN show_room_enabled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.vehicles.show_room_images IS 'Independent admin-uploaded detail gallery. Array order defines primary image; original vehicle_images and catalog image fields remain unchanged.';
COMMENT ON COLUMN public.vehicles.show_room_enabled IS 'Explicit opt-in for public vehicle detail gallery only; unrelated to showroom_mode or opening the admin panel.';
CREATE OR REPLACE FUNCTION public.validate_vehicle_show_room_gallery() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; expected_prefix text;
BEGIN
  IF jsonb_typeof(NEW.show_room_images) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Show Room musí být seznam fotografií'; END IF;
  expected_prefix := 'show-room/' || NEW.id::text || '/';
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.show_room_images) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR COALESCE(item->>'id','') = '' OR COALESCE(item->>'path','') NOT LIKE expected_prefix || '%' OR (item->>'path') LIKE '%..%' OR (item->>'path') !~ '^show-room/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$' OR COALESCE(item->>'url','') NOT LIKE 'https://%/storage/v1/object/public/vehicles/' || (item->>'path') THEN
      RAISE EXCEPTION 'Neplatná fotografie Show Room';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(NEW.show_room_images)) <> (SELECT count(DISTINCT value->>'path') FROM jsonb_array_elements(NEW.show_room_images)) THEN RAISE EXCEPTION 'Duplicitní fotografie Show Room'; END IF;
  IF NEW.show_room_enabled AND jsonb_array_length(NEW.show_room_images) = 0 THEN RAISE EXCEPTION 'Nejprve nahrajte fotografie Show Room'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_vehicle_show_room_gallery BEFORE INSERT OR UPDATE OF show_room_images, show_room_enabled ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_show_room_gallery();
-- Backfill unique sort_order per vehicle so updates don't reshuffle gallery order
WITH ordered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY vehicle_id
      ORDER BY is_main DESC, sort_order ASC, created_at ASC, id ASC
    ) - 1) AS new_order
  FROM public.vehicle_images
)
UPDATE public.vehicle_images vi
SET sort_order = ordered.new_order
FROM ordered
WHERE ordered.id = vi.id
  AND vi.sort_order IS DISTINCT FROM ordered.new_order;
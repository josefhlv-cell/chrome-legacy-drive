WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY vehicle_id
           ORDER BY is_main DESC, sort_order NULLS LAST, created_at, id
         ) - 1 AS rn
  FROM public.vehicle_images
)
UPDATE public.vehicle_images vi
SET sort_order = ranked.rn
FROM ranked
WHERE vi.id = ranked.id AND COALESCE(vi.sort_order, -1) <> ranked.rn;
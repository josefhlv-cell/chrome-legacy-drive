-- 1) Delete duplicate vehicles, keep best per VIN
WITH ranked AS (
  SELECT v.id,
         ROW_NUMBER() OVER (
           PARTITION BY v.vin
           ORDER BY (CASE WHEN v.status = 'skladem' THEN 0 ELSE 1 END),
                    (SELECT COUNT(*) FROM public.vehicle_images vi WHERE vi.vehicle_id = v.id) DESC,
                    v.created_at DESC
         ) AS rn
  FROM public.vehicles v
  WHERE v.vin <> ''
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.vehicle_images WHERE vehicle_id IN (SELECT id FROM to_delete);

WITH ranked AS (
  SELECT v.id,
         ROW_NUMBER() OVER (
           PARTITION BY v.vin
           ORDER BY (CASE WHEN v.status = 'skladem' THEN 0 ELSE 1 END),
                    (SELECT COUNT(*) FROM public.vehicle_images vi WHERE vi.vehicle_id = v.id) DESC,
                    v.created_at DESC
         ) AS rn
  FROM public.vehicles v
  WHERE v.vin <> ''
)
DELETE FROM public.vehicle_exports WHERE vehicle_id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT v.id,
         ROW_NUMBER() OVER (
           PARTITION BY v.vin
           ORDER BY (CASE WHEN v.status = 'skladem' THEN 0 ELSE 1 END),
                    (SELECT COUNT(*) FROM public.vehicle_images vi WHERE vi.vehicle_id = v.id) DESC,
                    v.created_at DESC
         ) AS rn
  FROM public.vehicles v
  WHERE v.vin <> ''
)
DELETE FROM public.vehicles WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Add unique constraint on VIN (only for non-empty VINs)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_vin_unique_idx
ON public.vehicles (vin)
WHERE vin <> '';
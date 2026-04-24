-- Delete duplicate vehicles, keeping the row with the most images (or newest if tied).
WITH ranked AS (
  SELECT v.id,
         ROW_NUMBER() OVER (
           PARTITION BY NULLIF(TRIM(v.vin), '')
           ORDER BY (SELECT COUNT(*) FROM public.vehicle_images vi WHERE vi.vehicle_id = v.id) DESC,
                    v.created_at DESC
         ) AS rn
  FROM public.vehicles v
  WHERE NULLIF(TRIM(v.vin), '') IS NOT NULL
)
DELETE FROM public.vehicles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
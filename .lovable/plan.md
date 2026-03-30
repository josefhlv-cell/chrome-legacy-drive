

## Ultimatni Re-build: Prodej vozu V3.0

### Shrnutí problému

Současný systém galerie je postavený na nespolehlivém "proximity matching" - hledá fotky v bucketu podle blízkosti číselného názvu souboru (IMG_xxxx ±120). Toto vede k míchání fotek mezi vozy. Navíc data jsou primárně v mock souboru `src/data/vehicles.ts`, ne v databázi.

### Plán implementace

#### 1. Nová tabulka `vehicle_images` (databázová migrace)

Vytvoříme novou tabulku pro explicitní přiřazení fotek k vozidlům:

```sql
CREATE TABLE public.vehicle_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_main boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Vehicle images are publicly readable"
  ON public.vehicle_images FOR SELECT TO public
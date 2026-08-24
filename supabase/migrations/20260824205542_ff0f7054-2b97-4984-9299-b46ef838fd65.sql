ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS ar_color_hex text;

COMMENT ON COLUMN public.vehicles.ar_color_hex IS 'Hex barva laku pro AR/3D náhled, např. #2f5a8f. NULL = výchozí bílá.';

UPDATE public.vehicles SET ar_color_hex = CASE
  WHEN lower(color) ~ 'bílá|bila|white|perleť' THEN '#e9eaec'
  WHEN lower(color) ~ 'černá|cerna|black' THEN '#1a1c1f'
  WHEN lower(color) ~ 'stříbr|stribr|silver' THEN '#b7bbc0'
  WHEN lower(color) ~ 'antracit|grafit' THEN '#3a3f45'
  WHEN lower(color) ~ 'šedá|seda|grey|gray' THEN '#7c8288'
  WHEN lower(color) ~ 'modrá|modra|blue' THEN '#2f5a8f'
  WHEN lower(color) ~ 'červená|cervena|red|vínová|vinova' THEN '#8c1f24'
  WHEN lower(color) ~ 'zelená|zelena|green' THEN '#2f4f3a'
  WHEN lower(color) ~ 'hnědá|hneda|brown' THEN '#4b3a2c'
  WHEN lower(color) ~ 'béžová|bezova|beige|champagne' THEN '#c8b89a'
  WHEN lower(color) ~ 'zlatá|zlata|gold' THEN '#a98b४3'
  WHEN lower(color) ~ 'žlutá|zluta|yellow' THEN '#d8b32a'
  WHEN lower(color) ~ 'oranž|oranz|orange' THEN '#c8641e'
  ELSE NULL
END
WHERE ar_color_hex IS NULL AND coalesce(color, '') <> '';
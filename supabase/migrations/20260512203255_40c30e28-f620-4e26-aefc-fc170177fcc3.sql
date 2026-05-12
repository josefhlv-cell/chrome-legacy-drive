UPDATE public.vehicles SET
  tipcars_znacka_kod = sub.zk,
  tipcars_model_kod  = sub.mk
FROM (
  SELECT id,
    CASE
      WHEN name ILIKE '%lancia%' AND name ILIKE '%voyager%' THEN 'AW'
      WHEN name ILIKE '%lancia%' OR name ILIKE '%flavia%' OR name ILIKE '%thema%' OR name ILIKE '%delta%' THEN 'AW'
      WHEN name ILIKE '%dodge%' OR name ILIKE '%challenger%' OR name ILIKE '%charger%' OR name ILIKE '%durango%' OR name ILIKE '%grand caravan%' THEN 'CR'
      ELSE 'AS'
    END AS zk,
    CASE
      WHEN name ILIKE '%lancia%' AND name ILIKE '%voyager%' THEN 'AWL'
      WHEN name ILIKE '%flavia%' THEN 'AWM'
      WHEN name ILIKE '%thema%'  THEN 'AWE'
      WHEN name ILIKE '%delta%'  THEN 'AWB'
      WHEN name ILIKE '%challenger%'    THEN 'CRT'
      WHEN name ILIKE '%charger%'       THEN 'CRU'
      WHEN name ILIKE '%durango%'       THEN 'CRG'
      WHEN name ILIKE '%grand caravan%' THEN 'CRL'
      WHEN name ILIKE '%ram 1500%'      THEN 'CR0'
      WHEN name ILIKE '%dodge%' AND name ILIKE '%ram%'     THEN 'CRF'
      WHEN name ILIKE '%dodge%' AND name ILIKE '%caravan%' THEN 'CRE'
      WHEN name ILIKE '%pacifica%'       THEN 'AST'
      WHEN name ILIKE '%grand voyager%'  THEN 'ASG'
      WHEN name ILIKE '%town%'           THEN 'ASP'
      WHEN name ILIKE '%300c%' OR name ILIKE '%300 c%' THEN 'ASU'
      WHEN name ILIKE '%300m%'           THEN 'ASJ'
      WHEN name ILIKE '%voyager%'        THEN 'ASF'
      WHEN name ILIKE '%sebring%'        THEN 'ASO'
      WHEN name ILIKE '%crossfire%'      THEN 'ASV'
      WHEN name ILIKE '%pt cruiser%'     THEN 'ASS'
      WHEN name ILIKE '%dodge%'          THEN 'CRZ'
      WHEN name ILIKE '%lancia%'         THEN 'AWZ'
      ELSE 'ASZ'
    END AS mk
  FROM public.vehicles
) AS sub
WHERE public.vehicles.id = sub.id;

ALTER TABLE public.vehicles ALTER COLUMN tipcars_znacka_kod SET DEFAULT 'AS';
ALTER TABLE public.vehicles ALTER COLUMN tipcars_model_kod  SET DEFAULT 'AST';
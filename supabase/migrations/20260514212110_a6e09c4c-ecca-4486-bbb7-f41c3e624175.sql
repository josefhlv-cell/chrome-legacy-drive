-- Oprava TipCars karoserie kódů podle oficiálního CiselnikyXmlImport.xml
-- Předchozí mapování bylo zcela špatně (M=tahač, U=válec, S=skupina "Pracovní stroje" atd.)
-- Skupina A "Osobní" používá:
--   a=hatchback, w=liftback, b=sedan, A=limuzína, C=kabriolet, D=kupé, B=kombi,
--   G=VAN, c=MPV, d=SUV, A1=CUV, }=pick up, [=terénní, A2=minibus

UPDATE public.vehicles SET
  tipcars_karoserie_kod = CASE tipcars_karoserie_kod
    WHEN 'M' THEN 'c'   -- (špatně) tahač → MPV
    WHEN 'U' THEN 'd'   -- (špatně) válec → SUV
    WHEN 'S' THEN 'b'   -- (špatně) skupina prac. strojů → sedan
    WHEN 'L' THEN 'w'   -- (špatně) dálkový autobus → liftback
    WHEN 'H' THEN 'a'   -- (špatně) městský autobus → hatchback
    WHEN 'K' THEN 'B'   -- (špatně) příměstský autobus → kombi
    WHEN 'C' THEN 'D'   -- (špatně) skupina užitkové → kupé
    WHEN 'B' THEN 'C'   -- (špatně) kombi(orig) → kabriolet
    WHEN 'V' THEN 'G'   -- (špatně) přívěs valník → VAN
    WHEN 'P' THEN '}'   -- (špatně) skříň → pick up
    WHEN 'T' THEN '['   -- (špatně) sanitka → terénní
    WHEN 'O' THEN 'O'   -- ponechat (sklápěč)
    WHEN 'X' THEN NULL  -- "Ostatní" v původním seznamu neexistuje
    ELSE tipcars_karoserie_kod
  END,
  tipcars_karoserie_popis = CASE tipcars_karoserie_kod
    WHEN 'M' THEN 'MPV'
    WHEN 'U' THEN 'SUV'
    WHEN 'S' THEN 'Sedan'
    WHEN 'L' THEN 'Liftback'
    WHEN 'H' THEN 'Hatchback'
    WHEN 'K' THEN 'Kombi'
    WHEN 'C' THEN 'Kupé'
    WHEN 'B' THEN 'Kabriolet'
    WHEN 'V' THEN 'VAN'
    WHEN 'P' THEN 'Pick up'
    WHEN 'T' THEN 'Terénní'
    WHEN 'X' THEN NULL
    ELSE tipcars_karoserie_popis
  END
WHERE tipcars_karoserie_kod IN ('M','U','S','L','H','K','C','B','V','P','T','X');

-- Změna defaultu pro nově vkládaná vozidla (M → c = MPV)
ALTER TABLE public.vehicles ALTER COLUMN tipcars_karoserie_kod SET DEFAULT 'c';
ALTER TABLE public.vehicles ALTER COLUMN tipcars_karoserie_popis SET DEFAULT 'MPV';
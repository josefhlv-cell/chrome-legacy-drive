# Vehicle 3D Model Generator — návrh (proposal, bez implementace)

## 1. Executive summary

Skutečná 3D rekonstrukce (photogrammetry) ze 16 fotek pořízených mobilem u auta na parkovišti nedá použitelný model — lesklý lak a sklo NeRF/SfM algoritmy rozbíjí a výpočet potřebuje GPU a desítky minut. Realistická cesta ke tvému cíli ("zákazník vidí PŘESNĚ ten svůj vůz") je **Appearance Transfer**: geometrie zůstává základní Pacifica GLB, z fotek se automaticky vytáhne a na model aplikuje *vzhled konkrétního vozu* — přesná barva laku (včetně metalízy), typ a stav kol, tmavost skel, chrom vs. black paket a viditelná poškození jako dekaly na správném místě.

Výsledek: 70–80 % vizuální věrnosti, ~3–5 min na vůz, žádná externí platená služba, GLB 6–9 MB, plná integrace s AR tlačítkem.

## 2. Architektura

```text
[16 fotek]  →  Storage bucket vehicle-photos (privátní)
      │
      ▼
[Edge Function: vehicle-appearance-analyze]
   Lovable AI (Gemini vision) + barevná analýza pixelů
   výstup → JSON "appearance profil"
      │
      ▼
[Browser: Three.js generator (admin stránka)]
   base pacifica.glb + profil → materiály, kola, sklo, decal
   preview + ruční doladění → GLTFExporter (Draco)
      │
      ▼
[Storage bucket vehicle-models]  →  vehicles.ar_model_url
      │
      ▼
[VehicleARButton] model-viewer (Android/desktop) · USDZ (iOS)
```

Proč generovat GLB v prohlížeči: Three.js + GLTFExporter tam už máme, edge funkce nemají GPU ani binárky pro mesh/texturové operace a nesmí běžet minuty. Analýza fotek jde na backend, protože musí sáhnout na privátní storage a AI Gateway.

**Stack:** React + @react-three/fiber (už v projektu), three GLTFExporter + DRACOLoader, canvas 2D pro texturové atlasy, Lovable AI Gateway (`google/gemini-3.7-flash`, vision) pro popis fotek, Supabase Storage + tabulka `vehicle_appearance_profiles`.

## 3. Co se z fotek reálně dá vytáhnout

| Vlastnost | Metoda | Věrnost |
|---|---|---|
| Barva laku | medián HSV z plochy karoserie + korekce bílého balance z fotek | vysoká |
| Metalíza / perleť | variance jasu v plochách → sheen + clearcoat | dobrá |
| Tmavost skel | průměrná luminance oken vs. karoserie → opacita | dobrá |
| Kola (design + stav) | AI klasifikace do sady 6–8 předpřipravených disků + obrys z detailní fotky | střední (výběr z knihovny) |
| Chrom vs. black paket | AI detekce lišt/mřížky → přepnutí materiálu | vysoká |
| Poškození | AI vrátí typ + umístění (dveře L/P, nárazník…) → decal na UV | orientační, ale poctivá |
| Interiér | barva kůže/textilu → materiály sedaček; fotky zůstávají v galerii | střední |

Co to **neumí**: skutečnou geometrii jiného modelu než Pacifica, přesnou křivku promáčklin, jiný typ karoserie. Pro ostatní modely zůstává tlačítko AR skryté, dokud nepřidáme jejich base GLB.

## 4. Photo capture guide (vejde se do UI jako checklist)

- 8× exteriér po 45° z výšky pasu, celé auto v záběru s odstupem ~5 % na okrajích
- 4× detail: kolo (celý disk zpředu), poškození (30 cm od plochy), okno (bez odlesku slunce), maska/mřížka
- 4× interiér: přední sedadla + palubka, druhá řada, volant s přístroji, zavazadlový prostor
- Souvislé zataženo nebo hala, nikdy tvrdé slunce zpoza auta; auto čisté a suché
- min. 4 MP, JPG s EXIF, ≤ 10 MB / foto; nefotit na výšku
- Špatné: mokrý lak, ostré stíny, odlesky sloupů, výřezy auta, HDR filtr

Validace při uploadu: rozlišení, počet fotek na slot, detekce rozmazání (Laplacian), varování při přepalu.

## 5. UX flow (nová admin stránka `/admin/3d-generator`)

1. **Výběr vozu** — dropdown z `vehicles` (VIN, název, cena) + stav "profil existuje / neexistuje"
2. **Upload** — 16 pojmenovaných slotů v mřížce, drag & drop celé dávky, auto-přiřazení podle EXIF času a AI úhlu, ruční přetažení
3. **Analýza** — progress po krocích ("Barva laku ✓ · Kola ✓ · Skla…"), 40–90 s
4. **Ladění** — vedle sebe 3D preview a panel: color picker, slider tmavosti skel, výběr disku, přepínač chrom/black, umístění poškození kliknutím na model
5. **Export** — GLB (Draco) + volitelně USDZ konverze, upload do storage, zápis `ar_model_url`
6. **Test v AR** — QR kód na mobil, ověření před publikací; `ar_model_ready` flag zvedne AR tlačítko na detailu vozu

Chyby: chybějící sloty blokují jen dotčenou vlastnost (fallback na generický vzhled), selhání AI → ruční ladění, timeout → retry jednoho kroku, ne celé dávky.

## 6. Časy, kapacita, náklady

- Upload 16 fotek: 1–3 min (podle sítě)
- Analýza: 40–90 s (5–6 AI volání à ~0,01–0,03 kreditu)
- Export GLB v prohlížeči: 20–60 s
- **Celkem 4–8 min na vůz**, tedy pod tvou toleranci 15–20 min
- Storage: fotky ~40 MB + model ~8 MB na vůz → 100 vozů ≈ 5 GB
- 100 vozů ≈ 100 × pár set AI volání, náklad v řádu jednotek dolarů kreditů; žádná externí placená služba
- Batch: fotky lze nahrát pro víc vozů dopředu, analýzy běží ve frontě sekvenčně (rate limit AI), export je vždy per vůz kvůli preview. ZIP hromadného stažení GLB doplníme ve fázi 3.
- Bez GPU, ale export vyžaduje desktop/moderní notebook (WebGL2, ~2 GB RAM volné)

## 7. Fáze implementace

- **MVP (fáze A)** — bucket + tabulka profilů, upload UI se slotmi, analýza barvy/skel/chromu, preview, GLB export, napojení na AR tlačítko
- **Fáze B** — knihovna disků, klasifikace kol, decaly poškození, klikací umístění
- **Fáze C** — interiérové materiály, USDZ pipeline pro iOS, dávkové zpracování a ZIP export, kontrola kvality (skóre věrnosti)

## 8. Rizika

| Riziko | Řešení |
|---|---|
| Očekávání "skutečné 3D skenování" | Jasně komunikovat: přesný vzhled na přesné geometrii Pacifiky |
| Špatné fotky | Validace při uploadu + checklist + ruční doladění |
| iOS neumí měnit barvu v USDZ | Generovat USDZ per vůz ve fázi C; do té doby disclaimer (už v kódu) |
| Jiné modely než Pacifica | AR tlačítko zůstává skryté; base GLB přidávat postupně |
| Velikost modelu | Draco + KTX2 textury, cíl 6–9 MB |

## 9. Co potřebuju od tebe

1. Schválení směru "appearance transfer" místo photogrammetry.
2. Jednu testovací sadu 16 fotek reálného vozu — na ní odladím analýzu.
3. Rozhodnutí, jestli MVP (fáze A) stačí ke spuštění, nebo chceš rovnou i kola a poškození (fáze B).

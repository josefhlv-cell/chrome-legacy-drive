# Prohlídka Pacifica — zvuk pryč, lepší obraz, plynulejší běh

Tři věci, nic víc. Návrh ke schválení, zatím jsem nic neměnil.

## 1. Odstranit zvuk (kompletně)

- Smazat `src/features/pacifica-tour/lib/tourSound.ts`.
- Odstranit všechna volání zvuku: `PacificaShowroom.tsx` (ambient, `sfx.tap/swoosh/unlock/paint/shutter/lock/chime`, `primeAudio`, `startAmbient/stopAmbient`), `InteriorTour.tsx` (`sfx.step`, `sfx.chime`), `LeadCapture.tsx` (`sfx.chime`).
- Odstranit stav `soundOn`, funkci `toggleSound` a tlačítko zvuku z ovládacího panelu (`TourNav`) — v UI po změně nezůstane žádná ikona mute.
- Zrušit `localStorage` klíč `pacifica_tour_muted`.

Dopad: žádný AudioContext, žádné přehrávání na pozadí, o pár kB méně JS. Zbytek prohlídky (kroky, videa, snapshot) funguje beze změny.

## 2. Kvalita obrazu modelu

Bez výměny GLB, jen renderer a materiály:

- Vyšší reálné rozlišení renderu: `dpr` desktop až 2.0 (dnes 1.65 výchozí), mobil 1.5 (dnes 1.15) — s tím, že adaptivní snižování při poklesu FPS zůstává (viz bod 3), takže slabý telefon si samo ubere.
- Antialiasing: zapnout `samples` na MSAA cestě u desktopu; na mobilu ponechat nativní `antialias: true`.
- Textury: zvýšit anisotropy ze současných 4 na 8 (desktop) — ostřejší mřížka masky, disky a nápisy pod ostrým úhlem.
- Lak: mírně čistší clearcoat (`clearcoatRoughness` 0.055 → 0.04) a `envMapIntensity` 1.15 → 1.3, aby odlesk na karoserii nebyl matný.
- Environment: rozlišení 256 → 512 na desktopu (mobil zůstává 128), tím zmizí pásování v odrazech na kapotě.
- Stíny: `shadow-mapSize` 1024 → 2048 na desktopu, měkčí okraj kontaktního stínu.
- Tone mapping expozice mírně nahoru na desktopu (1.08 → 1.12), aby vůz nebyl v tmavém showroomu „ušpiněný“.

Dopad pro zákazníka: viditelně ostřejší hrany a čistší lesk laku na desktopu, na mobilu ostřejší obraz bez ztráty plynulosti.

## 3. Plynulost (aby to nesekalo)

- Adaptivní kvalita: ponechat `PerformanceMonitor`, ale reagovat rychleji a s většími kroky dolů (aby se propad FPS srovnal do ~1 s, ne po několika sekundách), a nastavit dolní hranici tak, aby to na starším telefonu drželo 30+ FPS.
- Přestat renderovat, když se nic nemění: přepnout exteriér na `frameloop="demand"` a invalidovat jen při pohybu kamery, animaci hotspotu nebo změně barvy. Dnes scéna renderuje 60× za sekundu i při nečinnosti — to vytápí telefon a po chvíli způsobuje thermal throttling (typická příčina „sekání po 30 sekundách“).
- Vypnout `preserveDrawingBuffer` a pro snapshot renderovat cíleně jeden frame před čtením canvasu. Trvale zapnutý buffer brání optimalizacím prohlížeče a stojí výkon v každém framu; snapshot bude fungovat stejně.
- Stíny přepočítávat jen při změně (`shadowMap.autoUpdate = false` + ruční `needsUpdate`) místo každý frame.
- Kontaktní stín na desktopu držet na `frames={1}` (už je) a `ContactShadows` na mobilu nechat statickou texturou (už je).
- Hotspoty: pulsování řešit jednou sdílenou hodnotou místo per-hotspot výpočtu ve `useFrame`.
- Při vstupu do interiéru už teď stojí smyčka (`frameloop: never`) — ponecháme, plus uvolníme stínové cíle.

## Technická poznámka

Body 2 a 3 jdou částečně proti sobě (víc pixelů vs. plynulost). Řeším to tak, že vyšší kvalita je strop, nikoli fixní hodnota — adaptivní monitor ji na slabém zařízení sám sníží. Změny se dotknou pouze: `PacificaShowroom.tsx`, `scene/Showroom.tsx`, `model/PacificaModel.tsx`, `ui/Hotspot3D.tsx`, `ui/TourNav.tsx`, `interior/InteriorTour.tsx`, `ui/LeadCapture.tsx` a smazání `lib/tourSound.ts`.

## Co NEBUDU dělat

Nesahám na GLB/USDZ, hotspoty, obsah textů, fotky, videa, analytiku, lead formulář ani na nic mimo prohlídku.

## Konzultace — jedna otázka

Výměna GLB za kvalitnější verzi by dala největší skok v kvalitě obrazu, ale znamená větší soubor a delší načítání. Do tohoto zadání jsem to nezařadil. Chceš to zvážit zvlášť, nebo zůstáváme u současného 3,3 MB modelu?

# Reálný 3D model Chrysler Pacifica

Sem nahrajte soubor `pacifica.glb` (GLB/GLTF, ideálně Draco nebo Meshopt komprimovaný).
Showroom ho detekuje automaticky (HEAD /models/pacifica.glb) a použije místo náhledového modelu — bez úpravy kódu.

## Pojmenování uzlů (aby fungovaly skutečné animace částí)

- posuvné dveře: `door_left`, `door_right`
- páté dveře: `liftgate`
- kapota: `hood`
- 2. řada: `seat_row2`
- 3. řada: `seat_row3`
- světla: materiály obsahující `headlight` / `taillight`

Pokud model obsahuje GLTF animace pojmenované `door_left_open`, `liftgate_open`, `hood_open`, `row2_fold`, `row3_fold`, použije se AnimationMixer místo přímých transformací.

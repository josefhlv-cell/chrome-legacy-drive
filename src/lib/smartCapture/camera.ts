/**
 * Smart Capture — kamera (widest lens, žádný digitální zoom).
 *
 * Cíl: obraz v hledáčku i výsledná fotka musí odpovídat plnému zornému poli
 * zadního objektivu. Proto:
 *  • zoom = 1 (žádné digitální přiblížení)
 *  • preferujeme NEJŠIRŠÍ dostupný zadní objektiv (iPhone: „Zadní ultra…“ / 0.5×)
 *  • aspectRatio 4:3 (plný senzor, ne 16:9 výřez)
 *  • resizeMode "none" — prohlížeč nesmí obraz dokropovat
 *  • kaskáda fallbacků: pokud daná kombinace není podporovaná, jde se na volnější
 */

export type Facing = "environment" | "user";

let cachedWideDeviceId: string | null | undefined;

/** Skóre „šířky“ objektivu podle názvu zařízení (heuristika, funguje na iOS i Androidu). */
const lensScore = (label: string): number => {
  const l = label.toLowerCase();
  if (/ultra|ultrawide|ultra wide|ultra-wide|0[.,]5/.test(l)) return 3;
  if (/wide|širok|sirok/.test(l) && !/tele/.test(l)) return 2;
  if (/tele|zoom|2x|3x|5x/.test(l)) return 0;
  return 1;
};

/**
 * Najde deviceId nejširšího zadního objektivu. Vrací null, pokud nelze určit
 * (např. bez oprávnění nejsou labely dostupné) — pak se použije jen facingMode.
 */
export const findWidestRearCamera = async (): Promise<string | null> => {
  if (cachedWideDeviceId !== undefined) return cachedWideDeviceId;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput" && d.label);
    const rear = cams.filter((d) => /back|rear|zadní|zadni|environment/i.test(d.label));
    const pool = rear.length ? rear : [];
    if (!pool.length) { cachedWideDeviceId = null; return null; }
    pool.sort((a, b) => lensScore(b.label) - lensScore(a.label));
    cachedWideDeviceId = pool[0].deviceId || null;
  } catch {
    cachedWideDeviceId = null;
  }
  return cachedWideDeviceId;
};

/** Po přidělení oprávnění se labely zpřístupní — cache se musí zneplatnit. */
export const resetCameraCache = () => { cachedWideDeviceId = undefined; };

const czechError = (err: unknown): Error => {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return new Error("Přístup ke kameře byl zamítnut. Povolte kameru v nastavení prohlížeče.");
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return new Error("Nebyla nalezena žádná kamera.");
  if (name === "NotReadableError")
    return new Error("Kamera je obsazena jinou aplikací.");
  return new Error("Nepodařilo se aktivovat kameru.");
};

/**
 * Otevře MediaStream s plným zorným polem. Nikdy nepoužívá digitální zoom.
 * Kaskáda: nejširší objektiv (4:3) → facingMode 4:3 → facingMode → cokoliv.
 */
export const openCamera = async (
  facing: Facing = "environment",
  deviceId?: string | null,
): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Tento prohlížeč nepodporuje přístup ke kameře.");
  }

  // Plný senzor 4:3, bez dokropování, zoom 1×.
  const base: MediaTrackConstraints = {
    width: { ideal: 2048 },
    height: { ideal: 1536 },
    aspectRatio: { ideal: 4 / 3 },
    // @ts-expect-error — resizeMode/zoom nejsou v lib.dom typech všech verzí
    resizeMode: "none",
    zoom: 1,
  };

  const attempts: MediaTrackConstraints[] = [];
  if (facing === "environment" && deviceId) {
    attempts.push({ ...base, deviceId: { exact: deviceId } });
  }
  attempts.push({ ...base, facingMode: { ideal: facing } });
  attempts.push({ facingMode: { ideal: facing }, aspectRatio: { ideal: 4 / 3 } });
  attempts.push({ facingMode: { ideal: facing } });
  attempts.push({});

  let lastErr: unknown;
  for (const video of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      await ensureNoZoom(stream);
      return stream;
    } catch (e) {
      lastErr = e;
      const name = (e as { name?: string })?.name ?? "";
      // Zamítnuté oprávnění nemá smysl zkoušet dál.
      if (name === "NotAllowedError" || name === "SecurityError") break;
    }
  }
  throw czechError(lastErr);
};

/** Pokud track hlásí zoom, srazí ho na minimum (1×) — nikdy digitálně nepřibližujeme. */
export const ensureNoZoom = async (stream: MediaStream): Promise<void> => {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    const caps = track.getCapabilities?.() as { zoom?: { min?: number } } | undefined;
    if (caps?.zoom && typeof caps.zoom.min === "number") {
      await track.applyConstraints({
        // @ts-expect-error — zoom není ve všech verzích typů
        advanced: [{ zoom: caps.zoom.min }],
      });
    }
  } catch { /* zoom není podporován — v pořádku */ }
};

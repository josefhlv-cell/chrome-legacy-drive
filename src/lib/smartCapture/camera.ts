/**
 * Smart Capture — kamera.
 *
 * Cíl:
 *  • preferovat HLAVNÍ zadní kameru 1×
 *  • nikdy záměrně nepoužívat ultra-wide / 0,5× objektiv
 *  • nikdy nepoužívat teleobjektiv / 2× / 3× / 5×
 *  • žádný digitální zoom
 *  • preferovat poměr 4:3
 *  • resizeMode "none" — bez umělého dokropování
 *  • kaskáda fallbacků pro zařízení, která nepodporují všechny constraints
 */

export type Facing = "environment" | "user";

let cachedMainDeviceId: string | null | undefined;

/**
 * Skóre objektivu podle názvu zařízení.
 *
 * Priorita:
 *  4 = hlavní zadní 1× kamera
 *  2 = neznámá kamera
 *  1 = ultra-wide / 0,5×
 *  0 = teleobjektiv / zoom
 *
 * Důležité:
 * Ultra-wide záměrně NEpreferujeme, protože způsobuje
 * výraznou perspektivní deformaci a "rybí oko".
 */
const lensScore = (label: string): number => {
  const l = label.toLowerCase();

  // Teleobjektiv / optický zoom nechceme.
  if (/tele|telephoto|zoom|2x|3x|5x/.test(l)) {
    return 0;
  }

  // Ultra-wide / 0,5× nechceme.
  if (
    /ultra|ultrawide|ultra wide|ultra-wide|0[.,]5|0\.5/.test(l)
  ) {
    return 1;
  }

  // Preferujeme hlavní / standardní zadní kameru 1×.
  if (
    /main|primary|standard|wide|hlavn|hlavní|sirok|širok/.test(l)
  ) {
    return 4;
  }

  // Neznámý objektiv — lepší než ultra-wide, ale horší než hlavní kamera.
  return 2;
};

/**
 * Najde hlavní zadní kameru 1×.
 *
 * Pokud prohlížeč poskytuje názvy objektivů, vybere standardní
 * hlavní zadní kameru místo ultra-wide.
 */
export const findMainRearCamera = async (): Promise<string | null> => {
  if (cachedMainDeviceId !== undefined) {
    return cachedMainDeviceId;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const cams = devices.filter(
      (d) => d.kind === "videoinput" && d.label
    );

    const rear = cams.filter((d) =>
      /back|rear|zadní|zadni|environment/i.test(d.label)
    );

    if (!rear.length) {
      cachedMainDeviceId = null;
      return null;
    }

    rear.sort(
      (a, b) => lensScore(b.label) - lensScore(a.label)
    );

    cachedMainDeviceId = rear[0]?.deviceId || null;
  } catch {
    cachedMainDeviceId = null;
  }

  return cachedMainDeviceId;
};

/**
 * Zpětná kompatibilita pro případ, že některá část aplikace
 * ještě používá původní název funkce.
 *
 * Původní funkce už ale NEHLEDÁ nejširší objektiv.
 * Vrací hlavní zadní 1× kameru.
 */
export const findWidestRearCamera = async (): Promise<string | null> => {
  return findMainRearCamera();
};

/**
 * Po udělení oprávnění mohou být dostupné názvy kamer.
 * Proto je potřeba cache zneplatnit.
 */
export const resetCameraCache = () => {
  cachedMainDeviceId = undefined;
};

const czechError = (err: unknown): Error => {
  const name = (err as { name?: string })?.name ?? "";

  if (
    name === "NotAllowedError" ||
    name === "SecurityError"
  ) {
    return new Error(
      "Přístup ke kameře byl zamítnut. Povolte kameru v nastavení prohlížeče."
    );
  }

  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError"
  ) {
    return new Error("Nebyla nalezena žádná kamera.");
  }

  if (name === "NotReadableError") {
    return new Error(
      "Kamera je obsazena jinou aplikací."
    );
  }

  return new Error("Nepodařilo se aktivovat kameru.");
};

/**
 * Otevře MediaStream.
 *
 * Priorita:
 *  1. hlavní zadní kamera 1× + 4:3
 *  2. zadní kamera přes facingMode + 4:3
 *  3. zadní kamera
 *  4. libovolná kamera jako poslední fallback
 *
 * Digitální zoom se nepoužívá.
 */
export const openCamera = async (
  facing: Facing = "environment",
  deviceId?: string | null,
): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Tento prohlížeč nepodporuje přístup ke kameře."
    );
  }

  /**
   * Základní nastavení:
   * - 4:3 odpovídá přirozenému poměru senzoru telefonu
   * - vysoké rozlišení
   * - žádný digitální zoom
   * - žádné úmyslné cropování
   */
  const base: MediaTrackConstraints = {
    width: {
      ideal: 4032,
    },

    height: {
      ideal: 3024,
    },

    aspectRatio: {
      ideal: 4 / 3,
    },

    // @ts-expect-error — resizeMode není dostupný
    // ve všech verzích lib.dom typů.
    resizeMode: "none",

    // @ts-expect-error — zoom není dostupný
    // ve všech verzích lib.dom typů.
    zoom: 1,
  };

  const attempts: MediaTrackConstraints[] = [];

  /**
   * 1. Konkrétní hlavní zadní kamera.
   *
   * Toto je nejdůležitější pokus.
   */
  if (facing === "environment" && deviceId) {
    attempts.push({
      ...base,
      deviceId: {
        exact: deviceId,
      },
    });
  }

  /**
   * 2. Zadní kamera s preferencí 4:3.
   *
   * Pokud browser neumí vybrat konkrétní objektiv,
   * použije standardní environment kameru.
   */
  attempts.push({
    ...base,
    facingMode: {
      ideal: "environment",
    },
  });

  /**
   * 3. Jednodušší 4:3 zadní kamera.
   */
  attempts.push({
    facingMode: {
      ideal: facing,
    },

    aspectRatio: {
      ideal: 4 / 3,
    },
  });

  /**
   * 4. Jednoduchý fallback.
   */
  attempts.push({
    facingMode: {
      ideal: facing,
    },
  });

  /**
   * 5. Poslední fallback — necháme browser vybrat kameru.
   */
  attempts.push({});

  let lastErr: unknown;

  for (const video of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      });

      await ensureNoZoom(stream);

      return stream;
    } catch (e) {
      lastErr = e;

      const name = (e as { name?: string })?.name ?? "";

      // Zamítnuté oprávnění nemá smysl zkoušet dál.
      if (
        name === "NotAllowedError" ||
        name === "SecurityError"
      ) {
        break;
      }
    }
  }

  throw czechError(lastErr);
};

/**
 * Zajistí, že kamera nepoužívá digitální zoom.
 *
 * Pokud zařízení podporuje zoom constraint,
 * nastavíme jeho nejnižší dostupnou hodnotu.
 *
 * Tím zabráníme tomu, aby Smart Capture digitálně
 * přibližoval obraz.
 */
export const ensureNoZoom = async (
  stream: MediaStream
): Promise<void> => {
  const track = stream.getVideoTracks()[0];

  if (!track) {
    return;
  }

  try {
    const caps = track.getCapabilities?.() as
      | {
          zoom?: {
            min?: number;
          };
        }
      | undefined;

    if (
      caps?.zoom &&
      typeof caps.zoom.min === "number"
    ) {
      await track.applyConstraints({
        // @ts-expect-error — zoom není ve všech verzích typů.
        advanced: [
          {
            zoom: caps.zoom.min,
          },
        ],
      });
    }
  } catch {
    // Zařízení zoom nepodporuje nebo constraint odmítlo.
    // To nevadí — pokračujeme bez zoomu.
  }
};

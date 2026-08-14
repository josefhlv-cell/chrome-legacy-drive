/**
 * Smart Capture — kamera.
 *
 * Cíl:
 *  • preferovat HLAVNÍ zadní kameru 1×
 *  • nikdy záměrně nepoužívat ultra-wide / 0,5× objektiv
 *  • nikdy záměrně nepoužívat teleobjektiv / 2× / 3× / 5×
 *  • preferovat skutečný zoom 1×, pokud jej kamera podporuje
 *  • žádný digitální zoom nad 1×
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
 *  4 = hlavní / standardní zadní 1× kamera
 *  2 = neznámá kamera
 *  1 = ultra-wide / 0,5×
 *  0 = teleobjektiv / zoom
 *
 * Důležité:
 * Ultra-wide záměrně NEpreferujeme.
 * Teleobjektiv záměrně NEpreferujeme.
 */
const lensScore = (label: string): number => {
  const l = label.toLowerCase();

  // Teleobjektiv / optický zoom nechceme.
  if (
    /telephoto|tele|zoom|2x|3x|5x|2×|3×|5×/.test(l)
  ) {
    return 0;
  }

  // Ultra-wide / 0,5× nechceme.
  if (
    /ultra[\s-]?wide|ultrawide|0[.,]5|0\.5|0,5|0×|0x/.test(l)
  ) {
    return 1;
  }

  // Preferujeme hlavní / standardní zadní kameru.
  if (
    /main|primary|standard|wide|hlavn|sirok|širok/.test(l)
  ) {
    return 4;
  }

  // Neznámý objektiv.
  return 2;
};

/**
 * Najde hlavní zadní kameru 1×.
 *
 * Pokud prohlížeč poskytuje názvy kamer,
 * vybere nejvhodnější standardní zadní kameru.
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
 * Zpětná kompatibilita.
 *
 * Původní název funkce může být používán
 * jinými částmi aplikace.
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

/**
 * Převod browser chyby na českou chybu.
 */
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
 *  1. konkrétní hlavní zadní kamera + 4:3 + zoom 1×
 *  2. zadní kamera přes facingMode + 4:3 + zoom 1×
 *  3. zadní kamera + 4:3
 *  4. zadní kamera
 *  5. poslední fallback
 *
 * Digitální zoom nad 1× se nepoužívá.
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
   * Základní nastavení.
   *
   * 4:3 odpovídá přirozenému poměru hlavního senzoru
   * u mnoha telefonů.
   *
   * zoom: 1 znamená požadovanou výchozí hodnotu 1×.
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
   */
  attempts.push({
    ...base,

    facingMode: {
      ideal: "environment",
    },
  });

  /**
   * 3. Jednodušší 4:3 kamera.
   */
  attempts.push({
    facingMode: {
      ideal: facing,
    },

    aspectRatio: {
      ideal: 4 / 3,
    },

    // @ts-expect-error — resizeMode není dostupný
    // ve všech verzích lib.dom typů.
    resizeMode: "none",

    zoom: 1,
  });

  /**
   * 4. Jednoduchý fallback.
   */
  attempts.push({
    facingMode: {
      ideal: facing,
    },
    // `zoom` není v TS typech MediaTrackConstraints, prohlížeče ho ale podporují.
    ...({ zoom: 1 } as MediaTrackConstraints),
  });


  /**
   * 5. Poslední fallback.
   *
   * Tady už zoom constraint nepoužíváme,
   * protože browser může vybrat kameru,
   * která zoom constraint vůbec nepodporuje.
   */
  attempts.push({});

  let lastErr: unknown;

  for (const video of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      });

      /**
       * DŮLEŽITÉ:
       *
       * Dříve zde bylo ensureNoZoom(), které nastavovalo
       * zoom na caps.zoom.min.
       *
       * Pokud měl telefon:
       *
       * caps.zoom.min === 0.5
       *
       * aplikace sama nastavila kameru na 0.5×.
       *
       * Nyní vždy preferujeme 1×.
       */
      await ensureZoomOne(stream);

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
 * Nastaví kameru na skutečné 1×,
 * pokud zařízení podporuje zoom constraint.
 *
 * POZOR:
 *
 * Nepoužíváme caps.zoom.min.
 *
 * caps.zoom.min může být například 0.5.
 * Nastavit min tedy NEZNAMENÁ "bez zoomu".
 * Naopak by to mohlo znamenat 0.5× ultra-wide pohled.
 *
 * Chceme explicitně zoom = 1.
 */
export const ensureZoomOne = async (
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
            max?: number;
            step?: number;
          };
        }
      | undefined;

    /**
     * Pokud kamera zoom vůbec nepodporuje,
     * není co nastavovat.
     */
    if (!caps?.zoom) {
      return;
    }

    const min =
      typeof caps.zoom.min === "number"
        ? caps.zoom.min
        : 1;

    const max =
      typeof caps.zoom.max === "number"
        ? caps.zoom.max
        : 1;

    /**
     * 1× musí být v podporovaném rozsahu.
     */
    if (min <= 1 && max >= 1) {
      await track.applyConstraints({
        advanced: [
          {
            zoom: 1,
          } as unknown as MediaTrackConstraintSet,
        ],
      } as MediaTrackConstraints);
    }
  } catch {
    /**
     * Některá zařízení/browser zoom constraint
     * nepodporují nebo jeho změnu odmítnou.
     *
     * Stream ale může dál normálně fungovat.
     */
  }
};

/**
 * Zpětná kompatibilita.
 *
 * Pokud někde v aplikaci stále existuje import:
 *
 *   ensureNoZoom(...)
 *
 * nechceme rozbít build.
 *
 * Funkce nyní nastavuje 1× místo caps.zoom.min.
 */
export const ensureNoZoom = async (
  stream: MediaStream
): Promise<void> => {
  await ensureZoomOne(stream);
};

import { fitJpeg, type QuarterTurn } from "./deviceTurn";

/** Only the old camera queue's landscape JPEG + portrait EXIF combination is repaired.
 * Genuine portrait files and already-normalized captures are never guessed sideways. */
export function legacyUploadTurn(bytes: ArrayBuffer): QuarterTurn {
  const view = new DataView(bytes);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 0;
  let width = 0, height = 0, orientation = 1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > view.byteLength) break;
    const start = offset + 4;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) {
      height = view.getUint16(start + 1); width = view.getUint16(start + 3);
    }
    if (marker === 0xe1 && start + 14 <= end && view.getUint32(start) === 0x45786966 && view.getUint16(start + 4) === 0) {
      const tiff = start + 6;
      const order = view.getUint16(tiff);
      const little = order === 0x4949;
      if ((little || order === 0x4d4d) && view.getUint16(tiff + 2, little) === 42) {
        const directory = tiff + view.getUint32(tiff + 4, little);
        if (directory >= tiff + 8 && directory + 2 <= end) {
          const count = view.getUint16(directory, little);
          for (let i = 0; i < count; i++) {
            const entry = directory + 2 + i * 12;
            if (entry + 12 > end) break;
            if (view.getUint16(entry, little) === 0x0112 && view.getUint16(entry + 2, little) === 3 && view.getUint32(entry + 4, little) === 1) {
              orientation = view.getUint16(entry + 8, little);
              break;
            }
          }
        }
      }
    }
    offset = end;
  }
  if (width <= height) return 0;
  return orientation === 6 ? -1 : orientation === 8 ? 1 : 0;
}

export async function normalizeUploadImage(blob: Blob, options: { legacy: boolean; pendingTurn?: QuarterTurn }) {
  const legacyTurn = options.legacy && options.pendingTurn === undefined
    ? legacyUploadTurn(await blob.arrayBuffer()) : 0;
  // createImageBitmap applies EXIF. Undo only the known legacy camera defect,
  // and only if the decoder actually made the stored landscape frame portrait.
  return fitJpeg(blob, bitmap => options.pendingTurn ?? (bitmap.height > bitmap.width ? legacyTurn : 0));
}
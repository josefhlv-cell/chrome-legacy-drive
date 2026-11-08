/**
 * Placement used by composeSmartCaptureShowroom
 * (src/lib/smartCapture/showroomReplacement.ts).
 * The master plate stays at its native pixel size. These limits are ceilings:
 * a shorter crop is not scaled past 72% of the width, and a taller crop is
 * not scaled past 53% of the height. The bottom of the trimmed cutout sits
 * on the wheel line at 89.5% of the canvas height.
 */
export const SHOWROOM_GEOMETRY = {
  maxWidthRatio: 0.72,
  maxHeightRatio: 0.53,
  wheelLineRatio: 0.895,
  shadowCenterRatio: 0.897,
  shadowBlurPx: 18,
  shadowAlpha: 0.2,
  shadowRadiusXRatio: 0.34,
  shadowRadiusYRatio: 0.035,
  shadowMinRadiusY: 7,
  alphaThreshold: 24,
  jpegQuality: 92,
};

export function placeVehicle(canvasW, canvasH, cropW, cropH) {
  if (!(canvasW > 0) || !(canvasH > 0)) throw new Error("Neplatné plátno.");
  if (!(cropW > 0) || !(cropH > 0)) throw new Error("Prázdný výřez vozidla.");
  const maxW = canvasW * SHOWROOM_GEOMETRY.maxWidthRatio;
  const maxH = canvasH * SHOWROOM_GEOMETRY.maxHeightRatio;
  const scale = Math.min(maxW / cropW, maxH / cropH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const x = (canvasW - drawW) / 2;
  const y = canvasH * SHOWROOM_GEOMETRY.wheelLineRatio - drawH;
  return {
    scale,
    drawW,
    drawH,
    x,
    y,
    maxW,
    maxH,
    widthRatio: drawW / canvasW,
    heightRatio: drawH / canvasH,
    bottomRatio: (y + drawH) / canvasH,
  };
}

/** Integer pixels for the encoder. Stays inside the same ceilings. */
export function integerPlacement(canvasW, canvasH, cropW, cropH) {
  const placed = placeVehicle(canvasW, canvasH, cropW, cropH);
  let drawW = Math.max(1, Math.round(placed.drawW));
  let drawH = Math.max(1, Math.round(placed.drawH));
  if (drawW > placed.maxW) drawW = Math.floor(placed.maxW);
  if (drawH > placed.maxH) drawH = Math.floor(placed.maxH);
  const x = Math.round((canvasW - drawW) / 2);
  const wheelLine = canvasH * SHOWROOM_GEOMETRY.wheelLineRatio;
  const y = Math.round(wheelLine - drawH);
  const rx = drawW * SHOWROOM_GEOMETRY.shadowRadiusXRatio;
  const ry = Math.max(SHOWROOM_GEOMETRY.shadowMinRadiusY, drawH * SHOWROOM_GEOMETRY.shadowRadiusYRatio);
  return {
    scale: placed.scale,
    drawW,
    drawH,
    x,
    y,
    wheelLine,
    widthRatio: drawW / canvasW,
    heightRatio: drawH / canvasH,
    bottomRatio: (y + drawH) / canvasH,
    shadow: {
      cx: canvasW / 2,
      cy: canvasH * SHOWROOM_GEOMETRY.shadowCenterRatio,
      rx,
      ry,
      blurPx: SHOWROOM_GEOMETRY.shadowBlurPx,
      alpha: SHOWROOM_GEOMETRY.shadowAlpha,
    },
  };
}

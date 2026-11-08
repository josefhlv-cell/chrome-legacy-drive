export const SMART_CAPTURE_SHOWROOM_BACKGROUND = "/assets/showroom/master_showroom_background.jpg";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nepodařilo se načíst showroom pozadí."));
    image.src = src;
  });

const blobImage = (blob: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Nepodařilo se zpracovat fotografii.")); };
    image.src = url;
  });
};

/**
 * Experimental still-photo replacement for Smart Capture.
 * The original camera blob is not modified by this function.
 * Returns a separate JPEG with the vehicle cut out over the CHDP showroom.
 */
export async function composeSmartCaptureShowroom(photo: Blob): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");

  const cutout = await removeBackground(photo, {
    model: "isnet_fp16",
    device: "cpu",
    proxyToWorker: false,
    output: { format: "image/png", quality: 0.95 },
  });
  const vehicle = await blobImage(cutout);
  const background = await loadImage(SMART_CAPTURE_SHOWROOM_BACKGROUND);

  const width = background.naturalWidth || 1600;
  const height = background.naturalHeight || 900;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Nepodařilo se připravit showroom fotografii.");

  ctx.drawImage(background, 0, 0, width, height);

  // Trim transparent margins so the actual vehicle, not the source frame,
  // determines its showroom scale.
  const scan = document.createElement("canvas");
  const scanWidth = Math.min(900, vehicle.naturalWidth);
  const scanHeight = Math.max(1, Math.round(vehicle.naturalHeight * scanWidth / vehicle.naturalWidth));
  scan.width = scanWidth;
  scan.height = scanHeight;
  const scanCtx = scan.getContext("2d", { willReadFrequently: true });
  if (!scanCtx) throw new Error("Nepodařilo se analyzovat obrys vozidla.");
  scanCtx.drawImage(vehicle, 0, 0, scanWidth, scanHeight);
  const pixels = scanCtx.getImageData(0, 0, scanWidth, scanHeight).data;
  let minX = scanWidth, minY = scanHeight, maxX = -1, maxY = -1;
  for (let y = 0; y < scanHeight; y++) {
    for (let x = 0; x < scanWidth; x++) {
      if (pixels[(y * scanWidth + x) * 4 + 3] > 24) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("AI nedokázala rozpoznat vozidlo.");

  const scaleX = vehicle.naturalWidth / scanWidth;
  const scaleY = vehicle.naturalHeight / scanHeight;
  const cropX = minX * scaleX;
  const cropY = minY * scaleY;
  const cropW = (maxX - minX + 1) * scaleX;
  const cropH = (maxY - minY + 1) * scaleY;

  const maxW = width * 0.72;
  const maxH = height * 0.53;
  const scale = Math.min(maxW / cropW, maxH / cropH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const x = (width - drawW) / 2;
  const y = height * 0.895 - drawH;

  // A subtle grounded shadow, deliberately restrained.
  ctx.save();
  ctx.filter = "blur(18px)";
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.897, drawW * 0.34, Math.max(7, drawH * 0.035), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(vehicle, cropX, cropY, cropW, cropH, x, y, drawW, drawH);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Showroom fotografii se nepodařilo uložit.")), "image/jpeg", 0.92);
  });
}

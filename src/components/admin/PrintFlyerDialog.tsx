import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Loader2, ImageIcon, Upload, EyeOff, Images, Sparkles, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { formatPrice, priceWithVatFromNet } from "@/data/vehicles";
import type { DbVehicle } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import logoPardubice from "@/assets/logo-pardubice.webp";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vehicle: DbVehicle | null;
  siteUrl: string;
}

interface FlyerData {
  title: string;
  subtitle: string;
  priceMain: string;
  priceVatLine: string;
  vyrobeno: string;
  najeto: string;
  palivo: string;
  prevodovka: string;
  vykon: string;
  objem: string;
  stkDo: string;
  barva: string;
  vybava: string;
  popis: string;
}

// Limity — A4 portrait s velkou fotkou
const MAX_VYBAVA_ITEMS = 7;
const MAX_VYBAVA_CHARS = 240;
const MAX_POPIS_CHARS = 380;
// Bez fotky → víc místa
const MAX_VYBAVA_ITEMS_NOPHOTO = 12;
const MAX_VYBAVA_CHARS_NOPHOTO = 480;
const MAX_POPIS_CHARS_NOPHOTO = 700;
const A4_PREVIEW_WIDTH_PX = 1123;
const A4_PREVIEW_HEIGHT_PX = 794;
const A4_WIDTH_MM = 297;
const A4_HEIGHT_MM = 210;
const EXPORT_SCALE = 2;
const ALPHA_THRESHOLD = 180;
const EDGE_MARGIN_RATIO = 0.05;

const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const sanitizeFilename = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "flyer";
const limitVybava = (raw: string, maxItems: number, maxChars: number): string => {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, maxItems);
  const out: string[] = [];
  let total = 0;
  for (const l of lines) {
    if (total + l.length + 1 > maxChars) break;
    out.push(l);
    total += l.length + 1;
  }
  return out.join("\n");
};
const limitPopis = (raw: string, maxChars: number) => truncate(raw.trim(), maxChars);

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error("Nepodařilo se převést obrázek."));
  reader.readAsDataURL(blob);
});

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("Nepodařilo se načíst obrázek pro ořez."));
  img.src = src;
});

const waitForImages = async (container: HTMLElement) => {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));

  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
      window.setTimeout(() => resolve(), 5000);
    });
  }));
};

const waitForFonts = async () => {
  if ("fonts" in document) {
    await document.fonts.ready;
  }
};


const normalizeStudioCutout = async (blob: Blob) => {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(objectUrl);
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;

    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Nepodařilo se připravit editor obrázku.");

    sourceContext.drawImage(image, 0, 0);
    const frame = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const pixels = frame.data;

    const clearPixel = (pixelIndex: number) => {
      pixels[pixelIndex + 3] = 0;
    };

    const totalPixels = sourceCanvas.width * sourceCanvas.height;
    const visited = new Uint8Array(totalPixels);
    const edgeQueue = new Uint32Array(totalPixels);
    let queueStart = 0;
    let queueEnd = 0;

    const enqueueEdgePixel = (x: number, y: number) => {
      const flatIndex = y * sourceCanvas.width + x;
      if (visited[flatIndex]) return;

      const pixelIndex = flatIndex * 4;
      if (pixels[pixelIndex + 3] < ALPHA_THRESHOLD) return;

      visited[flatIndex] = 1;
      edgeQueue[queueEnd] = flatIndex;
      queueEnd += 1;
    };

    for (let x = 0; x < sourceCanvas.width; x += 1) {
      enqueueEdgePixel(x, 0);
      enqueueEdgePixel(x, sourceCanvas.height - 1);
    }

    for (let y = 0; y < sourceCanvas.height; y += 1) {
      enqueueEdgePixel(0, y);
      enqueueEdgePixel(sourceCanvas.width - 1, y);
    }

    while (queueStart < queueEnd) {
      const flatIndex = edgeQueue[queueStart];
      queueStart += 1;

      const x = flatIndex % sourceCanvas.width;
      const y = Math.floor(flatIndex / sourceCanvas.width);
      clearPixel(flatIndex * 4);

      if (x > 0) enqueueEdgePixel(x - 1, y);
      if (x < sourceCanvas.width - 1) enqueueEdgePixel(x + 1, y);
      if (y > 0) enqueueEdgePixel(x, y - 1);
      if (y < sourceCanvas.height - 1) enqueueEdgePixel(x, y + 1);
    }

    const rowCounts = new Uint32Array(sourceCanvas.height);
    const colCounts = new Uint32Array(sourceCanvas.width);

    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sourceCanvas.height; y += 1) {
      for (let x = 0; x < sourceCanvas.width; x += 1) {
        const index = (y * sourceCanvas.width + x) * 4;
        const alpha = pixels[index + 3];

        if (alpha < ALPHA_THRESHOLD) {
          clearPixel(index);
          continue;
        }

        pixels[index + 3] = 255;

        rowCounts[y] += 1;
        colCounts[x] += 1;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    sourceContext.putImageData(frame, 0, 0);

    if (maxX <= minX || maxY <= minY) {
      return blobToDataUrl(blob);
    }

    const minRowPixels = Math.max(8, Math.floor(sourceCanvas.width * 0.0035));
    const minColPixels = Math.max(8, Math.floor(sourceCanvas.height * 0.0035));

    while (minY < maxY && rowCounts[minY] < minRowPixels) minY += 1;
    while (maxY > minY && rowCounts[maxY] < minRowPixels) maxY -= 1;
    while (minX < maxX && colCounts[minX] < minColPixels) minX += 1;
    while (maxX > minX && colCounts[maxX] < minColPixels) maxX -= 1;

    const edgeMarginX = Math.max(2, Math.floor((maxX - minX + 1) * EDGE_MARGIN_RATIO));
    const edgeMarginY = Math.max(2, Math.floor((maxY - minY + 1) * EDGE_MARGIN_RATIO));

    minX = Math.max(0, minX - Math.min(edgeMarginX, 18));
    maxX = Math.min(sourceCanvas.width - 1, maxX + Math.min(edgeMarginX, 18));
    minY = Math.max(0, minY - Math.min(edgeMarginY, 18));
    maxY = Math.min(sourceCanvas.height - 1, maxY + Math.min(edgeMarginY, 18));

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = 1800;
    outputCanvas.height = 1000;

    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) throw new Error("Nepodařilo se vytvořit výstupní obrázek.");

    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";

    const maxDrawWidth = outputCanvas.width * 0.82;
    const maxDrawHeight = outputCanvas.height * 0.58;
    const scale = Math.min(maxDrawWidth / cropWidth, maxDrawHeight / cropHeight);
    const drawWidth = cropWidth * scale;
    const drawHeight = cropHeight * scale;
    const drawX = (outputCanvas.width - drawWidth) / 2;
    const baselineY = outputCanvas.height * 0.82;
    const drawY = Math.max(outputCanvas.height * 0.14, baselineY - drawHeight);

    outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputContext.drawImage(sourceCanvas, minX, minY, cropWidth, cropHeight, drawX, drawY, drawWidth, drawHeight);

    return outputCanvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const PrintFlyerDialog = ({ open, onOpenChange, vehicle, siteUrl }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewShellRef = useRef<HTMLDivElement>(null);
  const printFlyerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<FlyerData | null>(null);
  const [generatingEquipment, setGeneratingEquipment] = useState(false);
  const [allPhotos, setAllPhotos] = useState<{ url: string; isMain: boolean }[]>([]);
  const [heroPhoto, setHeroPhoto] = useState<string>("");
  const [photoMode, setPhotoMode] = useState<"main" | "other" | "custom" | "hidden">("main");
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [compactLayout, setCompactLayout] = useState(false);
  const [pdfAction, setPdfAction] = useState<"print" | "download" | null>(null);
  const [textScale, setTextScale] = useState(1);

  const noPhoto = photoMode === "hidden" || !heroPhoto;
  const maxVybavaItems = noPhoto ? MAX_VYBAVA_ITEMS_NOPHOTO : MAX_VYBAVA_ITEMS;
  const maxVybavaChars = noPhoto ? MAX_VYBAVA_CHARS_NOPHOTO : MAX_VYBAVA_CHARS;
  const maxPopisChars = noPhoto ? MAX_POPIS_CHARS_NOPHOTO : MAX_POPIS_CHARS;
  const previewWidth = Math.round(A4_PREVIEW_WIDTH_PX * previewScale);
  const previewHeight = Math.round(A4_PREVIEW_HEIGHT_PX * previewScale);

  const qrUrl = vehicle ? `${siteUrl}/vozidla/${vehicle.id}` : "";

  useEffect(() => {
    if (!open) return;

    const updatePreviewScale = () => {
      if (window.innerWidth <= 768) {
        setPreviewScale(0.45);
        return;
      }

      const shell = previewShellRef.current;
      const availableWidth = Math.max((shell?.clientWidth ?? window.innerWidth) - 24, 240);
      const availableHeight = Math.max((shell?.clientHeight ?? window.innerHeight - 220) - 24, 320);
      const widthScale = availableWidth / A4_PREVIEW_WIDTH_PX;
      const heightScale = availableHeight / A4_PREVIEW_HEIGHT_PX;

      setPreviewScale(clampNumber(Math.min(widthScale, heightScale, 1), 0.45, 1));
    };

    updatePreviewScale();
    const resizeObserver = typeof ResizeObserver !== "undefined" && previewShellRef.current
      ? new ResizeObserver(updatePreviewScale)
      : null;

    if (resizeObserver && previewShellRef.current) resizeObserver.observe(previewShellRef.current);
    window.addEventListener("resize", updatePreviewScale);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePreviewScale);
    };
  }, [open]);

  // Re-truncate when photo mode toggles
  useEffect(() => {
    setData((d) => d ? {
      ...d,
      vybava: limitVybava(d.vybava, maxVybavaItems, maxVybavaChars),
      popis: limitPopis(d.popis, maxPopisChars),
    } : d);
  }, [noPhoto, maxVybavaItems, maxVybavaChars, maxPopisChars]);

  useEffect(() => {
    if (!open) return;

    const measureOverflow = () => {
      const node = printFlyerRef.current;
      if (!node) return;

      const guardedNodes = Array.from(node.querySelectorAll<HTMLElement>("[data-flyer-clamp]"));
      const hasOverflow =
        node.scrollHeight > node.clientHeight + 1 ||
        node.scrollWidth > node.clientWidth + 1 ||
        guardedNodes.some((element) => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);

      setCompactLayout(hasOverflow);
    };

    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(measureOverflow));
    window.addEventListener("resize", measureOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureOverflow);
    };
  }, [open, data, heroPhoto, bgRemoved, noPhoto, textScale]);

  // Fetch all photos for picker + set main
  useEffect(() => {
    if (!vehicle || !open) { setAllPhotos([]); setHeroPhoto(""); return; }
    (async () => {
      const { data: imgs } = await supabase
        .from("vehicle_images")
        .select("image_url, is_main, sort_order")
        .eq("vehicle_id", vehicle.id)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true });
      const list = (imgs || []).map((i) => ({ url: i.image_url, isMain: i.is_main }));
      setAllPhotos(list);
      const main = list.find((i) => i.isMain)?.url || list[0]?.url || vehicle.image_url || "";
      setHeroPhoto(main);
      setPhotoMode("main");
      setBgRemoved(false);
    })();
  }, [vehicle, open]);

  const processHeroPhoto = async (showSuccessToast = true) => {
    if (!heroPhoto) return true;

    setRemovingBg(true);

    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const res = await fetch(heroPhoto);
      const inputBlob = await res.blob();
      const outBlob = await removeBackground(inputBlob, {
        output: { format: "image/png", quality: 0.9 },
      });

      const normalized = await normalizeStudioCutout(outBlob);
      setHeroPhoto(normalized);
      setBgRemoved(true);

      if (showSuccessToast) {
        toast({ title: "Pozadí odstraněno", description: "Studio řez i centrování jsou hotové." });
      }

      return true;
    } catch (error: unknown) {
      toast({ title: "Chyba odstranění pozadí", description: getErrorMessage(error), variant: "destructive" });
      return false;
    } finally {
      setRemovingBg(false);
    }
  };

  const handleRemoveBg = async () => {
    await processHeroPhoto(true);
  };

  // Build initial flyer data
  useEffect(() => {
    if (!vehicle || !open) return;
    const priceFormatted = formatPrice(vehicle.price_with_vat);
    const priceMain = priceFormatted;
    let priceVatLine = "";
    if (vehicle.show_vat) {
      const withVat = priceWithVatFromNet(vehicle.price_with_vat);
      priceVatLine = `S DPH / ${formatPrice(withVat)}`;
    }
    setData({
      title: vehicle.name?.toUpperCase() || "",
      subtitle: [vehicle.year, vehicle.fuel, vehicle.engine].filter(Boolean).join(" • "),
      priceMain,
      priceVatLine,
      vyrobeno: String(vehicle.year || ""),
      najeto: vehicle.mileage ? `${vehicle.mileage.toLocaleString("cs-CZ")} km` : "",
      palivo: vehicle.fuel || "",
      prevodovka: vehicle.transmission || "",
      vykon: vehicle.power || "",
      objem: "",
      stkDo: "",
      barva: vehicle.color || "",
      vybava: "",
      popis: limitPopis(vehicle.description || "", MAX_POPIS_CHARS),
    });
  }, [vehicle, open]);

  const generateEquipment = async () => {
    if (!vehicle?.vin) {
      toast({ title: "Vozidlo nemá VIN", description: "Vyplňte VIN v editaci vozu.", variant: "destructive" });
      return;
    }
    setGeneratingEquipment(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("vin-decode", { body: { vin: vehicle.vin } });
      if (error) throw error;
      const equipment = result?.typicalEquipment || result?.decoded?.typicalEquipment || "";
      if (!equipment) {
        toast({ title: "AI nevrátila výbavu", variant: "destructive" });
        return;
      }
      const lines = equipment.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
      setData((d) => (d ? { ...d, vybava: limitVybava(lines.join("\n"), maxVybavaItems, maxVybavaChars) } : d));
      toast({ title: "Výbava vygenerována" });
    } catch (error: unknown) {
      toast({ title: "Chyba", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setGeneratingEquipment(false);
    }
  };

  const handleUploadCustom = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pouze obrázky", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHeroPhoto(reader.result as string);
      setPhotoMode("custom");
      setBgRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  const prepareFlyerForPrint = async () => {
    const flyerNode = printFlyerRef.current;
    if (!flyerNode) throw new Error("Náhled letáku ještě není připraven.");

    if (!noPhoto && !bgRemoved) {
      const processed = await processHeroPhoto(false);
      if (!processed) throw new Error("Nepodařilo se připravit studio fotku pro tisk.");
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await waitForImages(flyerNode);
    await waitForFonts();
  };

  const createExportCanvas = async () => {
    const flyerNode = printFlyerRef.current;
    if (!flyerNode) throw new Error("Leták není připraven k exportu.");

    await prepareFlyerForPrint();

    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-10000px";
    exportHost.style.top = "0";
    exportHost.style.width = `${A4_WIDTH_MM}mm`;
    exportHost.style.height = `${A4_HEIGHT_MM}mm`;
    exportHost.style.background = "#ffffff";
    exportHost.style.overflow = "hidden";
    exportHost.style.pointerEvents = "none";
    exportHost.style.zIndex = "-1";

    const clone = flyerNode.cloneNode(true) as HTMLDivElement;
    clone.classList.remove("shadow-2xl", "print:shadow-none");
    clone.style.margin = "0";
    clone.style.transform = "none";

    exportHost.appendChild(clone);
    document.body.appendChild(exportHost);

    try {
      await waitForImages(clone);
      await waitForFonts();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      return await html2canvas(clone, {
        backgroundColor: "#ffffff",
        useCORS: true,
        scale: EXPORT_SCALE,
        logging: false,
        width: clone.offsetWidth,
        height: clone.offsetHeight,
        windowWidth: A4_PREVIEW_WIDTH_PX,
        windowHeight: A4_PREVIEW_HEIGHT_PX,
      });
    } finally {
      document.body.removeChild(exportHost);
    }
  };

  const openPrintWindow = async (imageDataUrl: string) => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1400,height=900");
    if (!printWindow) {
      throw new Error("Pro tisk povolte v prohlížeči vyskakovací okna.");
    }

    printWindow.document.write(`<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <title>${data.title || "Leták"}</title>
    <style>
      @page { size: A4 landscape; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { width: ${A4_WIDTH_MM}mm; height: ${A4_HEIGHT_MM}mm; overflow: hidden; }
      .sheet { width: ${A4_WIDTH_MM}mm; height: ${A4_HEIGHT_MM}mm; overflow: hidden; }
      img { display: block; width: ${A4_WIDTH_MM}mm; height: ${A4_HEIGHT_MM}mm; object-fit: fill; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <img src="${imageDataUrl}" alt="${data.title || "Leták"}" />
    </div>
    <script>
      const triggerPrint = () => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 150);
      };

      window.addEventListener('afterprint', () => window.close());
      if (document.images[0]?.complete) triggerPrint();
      else document.images[0]?.addEventListener('load', triggerPrint, { once: true });
    </script>
  </body>
</html>`);
    printWindow.document.close();
  };

  const exportFlyer = async (mode: "print" | "download") => {
    setPdfAction(mode);

    try {
      const canvas = await createExportCanvas();
      const imageDataUrl = canvas.toDataURL("image/png", 1);

      if (mode === "download") {
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        pdf.addImage(imageDataUrl, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, "FAST");
        pdf.save(`${sanitizeFilename(data.title)}-a4-landscape.pdf`);
      } else {
        await openPrintWindow(imageDataUrl);
      }

      toast({
        title: mode === "download" ? "PDF vytvořeno" : "Tisk připraven",
        description: mode === "download"
          ? "Leták byl uložen jako přesný A4 landscape bez ořezu."
          : "Otevřel se tisk z přesného A4 náhledu bez ořezu.",
      });
    } catch (error: unknown) {
      toast({ title: "Tisk se nepodařil", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setPdfAction(null);
    }
  };

  const handlePrint = () => exportFlyer("print");
  const handleDownloadPdf = () => exportFlyer("download");

  if (!vehicle || !data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" /> Premium leták A4 — {vehicle.name}
          </DialogTitle>
          <DialogDescription>
            Showroom monochrome leták. Fotku můžete kdykoliv změnit nebo vypnout.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 print:block">
          {/* === EDITOR === */}
          <div className="space-y-3 print:hidden">
            {/* PHOTO CONTROL */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <Label className="text-xs font-bold uppercase tracking-wide mb-2 block">Fotka vozidla</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button size="sm" variant={photoMode === "main" ? "default" : "outline"} onClick={() => {
                  const main = allPhotos.find((p) => p.isMain)?.url || allPhotos[0]?.url || vehicle.image_url || "";
                  setHeroPhoto(main); setPhotoMode("main"); setBgRemoved(false);
                }} className="text-xs h-8">
                  <ImageIcon className="w-3 h-3 mr-1" /> Hlavní
                </Button>
                <Button size="sm" variant={photoMode === "other" ? "default" : "outline"} onClick={() => setShowPhotoPicker((s) => !s)} disabled={allPhotos.length < 2} className="text-xs h-8">
                  <Images className="w-3 h-3 mr-1" /> Jiná
                </Button>
                <Button size="sm" variant={photoMode === "custom" ? "default" : "outline"} onClick={() => fileInputRef.current?.click()} className="text-xs h-8">
                  <Upload className="w-3 h-3 mr-1" /> Nahrát
                </Button>
                <Button size="sm" variant={photoMode === "hidden" ? "default" : "outline"} onClick={() => { setPhotoMode("hidden"); setBgRemoved(false); }} className="text-xs h-8">
                  <EyeOff className="w-3 h-3 mr-1" /> Skrýt
                </Button>
              </div>

              {!noPhoto && (
                <Button size="sm" variant={bgRemoved ? "default" : "secondary"} onClick={handleRemoveBg} disabled={removingBg} className="w-full mt-2 h-8 text-xs">
                  {removingBg ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  {removingBg ? "Zpracovávám… (může trvat 10–30s)" : bgRemoved ? "✓ Studio styl aktivní — kliknout znovu" : "Odstranit pozadí (FREE / studio styl)"}
                </Button>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadCustom(e.target.files[0])} />

              {showPhotoPicker && allPhotos.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {allPhotos.map((p, i) => (
                    <button key={i} type="button" onClick={() => { setHeroPhoto(p.url); setPhotoMode("other"); setBgRemoved(false); setShowPhotoPicker(false); }} className={`aspect-video rounded overflow-hidden border-2 ${heroPhoto === p.url ? "border-primary" : "border-transparent"}`}>
                      <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Název</Label><Input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></div>
              <div><Label className="text-xs">Podnadpis</Label><Input value={data.subtitle} onChange={(e) => setData({ ...data, subtitle: e.target.value })} /></div>
              <div><Label className="text-xs">Cena</Label><Input value={data.priceMain} onChange={(e) => setData({ ...data, priceMain: e.target.value })} /></div>
              <div><Label className="text-xs">S DPH řádek</Label><Input value={data.priceVatLine} onChange={(e) => setData({ ...data, priceVatLine: e.target.value })} placeholder="prázdné = nezobrazí se" /></div>
              <div><Label className="text-xs">Rok</Label><Input value={data.vyrobeno} onChange={(e) => setData({ ...data, vyrobeno: e.target.value })} /></div>
              <div><Label className="text-xs">Najeto</Label><Input value={data.najeto} onChange={(e) => setData({ ...data, najeto: e.target.value })} /></div>
              <div><Label className="text-xs">Palivo</Label><Input value={data.palivo} onChange={(e) => setData({ ...data, palivo: e.target.value })} /></div>
              <div><Label className="text-xs">Převodovka</Label><Input value={data.prevodovka} onChange={(e) => setData({ ...data, prevodovka: e.target.value })} /></div>
              <div><Label className="text-xs">Výkon</Label><Input value={data.vykon} onChange={(e) => setData({ ...data, vykon: e.target.value })} /></div>
              <div><Label className="text-xs">Objem</Label><Input value={data.objem} onChange={(e) => setData({ ...data, objem: e.target.value })} placeholder="3604 ccm" /></div>
              <div><Label className="text-xs">STK do</Label><Input value={data.stkDo} onChange={(e) => setData({ ...data, stkDo: e.target.value })} placeholder="12/2026" /></div>
              <div><Label className="text-xs">Barva</Label><Input value={data.barva} onChange={(e) => setData({ ...data, barva: e.target.value })} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Výbava ({data.vybava.length}/{maxVybavaChars} znaků, max {maxVybavaItems} řádků)</Label>
                <Button size="sm" variant="outline" onClick={generateEquipment} disabled={generatingEquipment} className="h-7 text-xs">
                  {generatingEquipment && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  AI z VIN
                </Button>
              </div>
              <Textarea rows={5} value={data.vybava} onChange={(e) => setData({ ...data, vybava: limitVybava(e.target.value, maxVybavaItems, maxVybavaChars) })} placeholder="Adaptivní tempomat&#10;Kožená sedadla&#10;..." />
            </div>

            <div>
              <Label className="text-xs">Popis ({data.popis.length}/{maxPopisChars})</Label>
              <Textarea rows={5} value={data.popis} onChange={(e) => setData({ ...data, popis: e.target.value.slice(0, maxPopisChars) })} placeholder="Vůz ve výborném stavu..." />
            </div>

            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase tracking-wide">
                  Velikost písma (Výbava + Popis)
                </Label>
                <span className="text-xs font-mono tabular-nums">{Math.round(textScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.5}
                step={0.05}
                value={textScale}
                onChange={(e) => setTextScale(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>80%</span>
                <button type="button" onClick={() => setTextScale(1)} className="underline hover:text-foreground">reset 100%</button>
                <span>150%</span>
              </div>
            </div>
          </div>

          {/* === FLYER === */}
          <div ref={previewShellRef} className="flyer-preview-shell print:bg-transparent">
            <div className="flyer-preview-stage" style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}>
              <div className="flyer-preview-canvas" style={{ "--flyer-preview-scale": previewScale } as CSSProperties}>
                <div
                  id="print-flyer-area"
                  ref={printFlyerRef}
                  className={`flyer-a4 print-page ${noPhoto ? "no-photo" : ""} ${compactLayout ? "compact" : ""} shadow-2xl print:shadow-none grayscale`}
                  style={{ "--flyer-text-scale": textScale } as CSSProperties}
                >
                  {/* ROW 1: Shield • Title (big box) • Year box */}
                  <div className="flyer-row flyer-row-top">
                    <div className="flyer-shield">
                      <img src={logoPardubice} alt="Chrysler Dodge Pardubice" />
                    </div>
                    <div className="flyer-box flyer-box-title">
                      <h1 className="flyer-title" data-flyer-clamp>{data.title}</h1>
                    </div>
                    <div className="flyer-box flyer-box-stat">
                      <div className="fb-label">Rok výroby:</div>
                      <div className="fb-value">{data.vyrobeno || "—"}</div>
                    </div>
                  </div>

                  {/* ROW 2: Photo (spans 2 rows) • Mileage • STK */}
                  <div className="flyer-row flyer-row-mid">
                    {!noPhoto ? (
                      <div className={`flyer-hero ${bgRemoved ? "studio" : ""}`}>
                        <img src={heroPhoto} alt={data.title} crossOrigin="anonymous" />
                      </div>
                    ) : (
                      <div className="flyer-hero flyer-hero-empty" />
                    )}
                    <div className="flyer-stack">
                      <div className="flyer-box flyer-box-stat">
                        <div className="fb-label">Stav tachometru:</div>
                        <div className="fb-value">{data.najeto || "—"}</div>
                      </div>
                      <div className="flyer-box flyer-box-stat flyer-box-engine">
                        <div className="fb-label">Motor:</div>
                        <div className="fb-value-md">
                          {[data.objem, data.vykon].filter(Boolean).join(" / ") || "—"}
                        </div>
                        {data.palivo && (
                          <div className="fb-label fb-label-inline">palivo: <span>{data.palivo}</span></div>
                        )}
                      </div>
                    </div>
                    <div className="flyer-stack">
                      <div className="flyer-box flyer-box-stat">
                        <div className="fb-label">Platnost STK do:</div>
                        <div className="fb-value">{data.stkDo || "—"}</div>
                      </div>
                      <div className="flyer-box flyer-box-info">
                        <div className="fb-info-line">servisní knížka</div>
                        <div className="fb-info-line">1. majitel</div>
                        <div className="fb-info-line">koupeno v: ČR</div>
                        <div className="fb-info-line">stav: perfektní</div>
                      </div>
                    </div>
                  </div>

                  {/* ROW 3: Equipment + Description (left) • QR (right) */}
                  <div className="flyer-row flyer-row-content">
                    <div className="flyer-box flyer-box-content">
                      <div className="fb-section">
                        <div className="fb-section-title">Výbava:</div>
                        <div className="fb-section-text" data-flyer-clamp>
                          {data.vybava
                            .split("\n")
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </div>
                      {data.popis && (
                        <div className="fb-section fb-section-popis">
                          <div className="fb-section-title">Popis:</div>
                          <div className="fb-section-text" data-flyer-clamp>{data.popis}</div>
                        </div>
                      )}
                    </div>
                    <div className="flyer-box flyer-box-qr">
                      <QRCodeSVG value={qrUrl} size={256} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={false} />
                    </div>
                  </div>

                  {/* ROW 4: Price box */}
                  <div className="flyer-row flyer-row-price">
                    <div className="flyer-box flyer-box-price">
                      <div className="fb-price-left">
                        <div className="fb-price-title">Cena</div>
                        <div className="fb-price-sub">{data.priceVatLine ? "s DPH:" : "bez DPH:"}</div>
                        <div className="fb-price-finance">Možnosti financování: leasing, spotřebitelský úvěr</div>
                      </div>
                      <div className="fb-price-right">{data.priceMain}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={pdfAction !== null}>
            {pdfAction === "download" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Uložit PDF
          </Button>
          <Button onClick={handlePrint} disabled={pdfAction !== null}>
            {pdfAction === "print" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />} Tisk / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintFlyerDialog;

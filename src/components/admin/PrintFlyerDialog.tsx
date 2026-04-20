import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Loader2, ImageIcon, Upload, EyeOff, Images, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatPrice, priceWithVatFromNet } from "@/data/vehicles";
import type { DbVehicle } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import logoShield from "@/assets/logo-shield.webp";
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

const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const limitVybava = (raw: string, maxItems: number, maxChars: number): string => {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, maxItems);
  let out: string[] = [];
  let total = 0;
  for (const l of lines) {
    if (total + l.length + 1 > maxChars) break;
    out.push(l);
    total += l.length + 1;
  }
  return out.join("\n");
};
const limitPopis = (raw: string, maxChars: number) => truncate(raw.trim(), maxChars);

const PrintFlyerDialog = ({ open, onOpenChange, vehicle, siteUrl }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<FlyerData | null>(null);
  const [generatingEquipment, setGeneratingEquipment] = useState(false);
  const [allPhotos, setAllPhotos] = useState<{ url: string; isMain: boolean }[]>([]);
  const [heroPhoto, setHeroPhoto] = useState<string>("");
  const [photoMode, setPhotoMode] = useState<"main" | "other" | "custom" | "hidden">("main");
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [bgRemoved, setBgRemoved] = useState(false);

  const noPhoto = photoMode === "hidden" || !heroPhoto;
  const maxVybavaItems = noPhoto ? MAX_VYBAVA_ITEMS_NOPHOTO : MAX_VYBAVA_ITEMS;
  const maxVybavaChars = noPhoto ? MAX_VYBAVA_CHARS_NOPHOTO : MAX_VYBAVA_CHARS;
  const maxPopisChars = noPhoto ? MAX_POPIS_CHARS_NOPHOTO : MAX_POPIS_CHARS;

  const qrUrl = vehicle ? `${siteUrl}/vozidla/${vehicle.id}` : "";

  // Re-truncate when photo mode toggles
  useEffect(() => {
    setData((d) => d ? {
      ...d,
      vybava: limitVybava(d.vybava, maxVybavaItems, maxVybavaChars),
      popis: limitPopis(d.popis, maxPopisChars),
    } : d);
  }, [noPhoto, maxVybavaItems, maxVybavaChars, maxPopisChars]);

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

  const handleRemoveBg = async () => {
    if (!heroPhoto) return;
    setRemovingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      // Fetch as blob (handles both http URLs and data URIs)
      const res = await fetch(heroPhoto);
      const inputBlob = await res.blob();
      const outBlob = await removeBackground(inputBlob, {
        output: { format: "image/png", quality: 0.9 },
      });
      const reader = new FileReader();
      reader.onload = () => {
        setHeroPhoto(reader.result as string);
        setBgRemoved(true);
        toast({ title: "Pozadí odstraněno", description: "Studio styl aplikován." });
      };
      reader.readAsDataURL(outBlob);
    } catch (e: any) {
      toast({ title: "Chyba odstranění pozadí", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRemovingBg(false);
    }
  };

  // Build initial flyer data
  useEffect(() => {
    if (!vehicle || !open) return;
    const priceFormatted = formatPrice(vehicle.price_with_vat);
    let priceMain = priceFormatted;
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
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? String(e), variant: "destructive" });
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
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = () => {
    window.print();
  };

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
                  setHeroPhoto(main); setPhotoMode("main");
                }} className="text-xs h-8">
                  <ImageIcon className="w-3 h-3 mr-1" /> Hlavní
                </Button>
                <Button size="sm" variant={photoMode === "other" ? "default" : "outline"} onClick={() => setShowPhotoPicker((s) => !s)} disabled={allPhotos.length < 2} className="text-xs h-8">
                  <Images className="w-3 h-3 mr-1" /> Jiná
                </Button>
                <Button size="sm" variant={photoMode === "custom" ? "default" : "outline"} onClick={() => fileInputRef.current?.click()} className="text-xs h-8">
                  <Upload className="w-3 h-3 mr-1" /> Nahrát
                </Button>
                <Button size="sm" variant={photoMode === "hidden" ? "default" : "outline"} onClick={() => setPhotoMode("hidden")} className="text-xs h-8">
                  <EyeOff className="w-3 h-3 mr-1" /> Skrýt
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUploadCustom(e.target.files[0])} />

              {showPhotoPicker && allPhotos.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {allPhotos.map((p, i) => (
                    <button key={i} type="button" onClick={() => { setHeroPhoto(p.url); setPhotoMode("other"); setShowPhotoPicker(false); }} className={`aspect-video rounded overflow-hidden border-2 ${heroPhoto === p.url ? "border-primary" : "border-transparent"}`}>
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
          </div>

          {/* === FLYER === */}
          <div id="print-flyer-area" className={`flyer-a4 ${noPhoto ? "no-photo" : ""} mx-auto shadow-2xl print:shadow-none`}>
            {/* Header */}
            <div className="flyer-header">
              <div className="flyer-shield">
                <img src={logoShield} alt="Chrysler Dodge Pardubice" />
              </div>
              <div className="flyer-contact">
                <div className="fc-bold">CHRYSLER PARDUBICE</div>
                <div>+420 603 559 767</div>
                <div>WWW.CHRYSLERPARDUBICE.SITE</div>
              </div>
            </div>

            {/* Title + subtitle */}
            <h1 className="flyer-title">{data.title}</h1>
            <div className="flyer-subtitle">{data.subtitle}</div>

            {/* Hero photo */}
            {!noPhoto && (
              <div className="flyer-hero">
                <img src={heroPhoto} alt={data.title} crossOrigin="anonymous" />
              </div>
            )}

            {/* Price bar */}
            <div className="flyer-price-bar">
              <div className="fp-label">Cena</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div className="fp-main">{data.priceMain}</div>
                {data.priceVatLine && <div className="fp-sub">{data.priceVatLine}</div>}
              </div>
            </div>

            {/* Specs + QR */}
            <div className="flyer-mid">
              <div className="flyer-specs">
                {data.vyrobeno && <div className="fs-row"><span className="fs-key">Rok</span><span className="fs-val">{data.vyrobeno}</span></div>}
                {data.najeto && <div className="fs-row"><span className="fs-key">Najeto</span><span className="fs-val">{data.najeto}</span></div>}
                {data.palivo && <div className="fs-row"><span className="fs-key">Palivo</span><span className="fs-val">{data.palivo}</span></div>}
                {data.prevodovka && <div className="fs-row"><span className="fs-key">Převodovka</span><span className="fs-val">{data.prevodovka}</span></div>}
                {data.vykon && <div className="fs-row"><span className="fs-key">Výkon</span><span className="fs-val">{data.vykon}</span></div>}
                {data.objem && <div className="fs-row"><span className="fs-key">Objem</span><span className="fs-val">{data.objem}</span></div>}
                {data.stkDo && <div className="fs-row"><span className="fs-key">STK do</span><span className="fs-val">{data.stkDo}</span></div>}
                {data.barva && <div className="fs-row"><span className="fs-key">Barva</span><span className="fs-val">{data.barva}</span></div>}
              </div>
              <div className="flyer-qr">
                <QRCodeSVG value={qrUrl} size={256} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={false} />
                <div className="flyer-qr-caption">Naskenujte pro detail vozu</div>
              </div>
            </div>

            {/* Bottom: description + equipment */}
            <div className="flyer-bottom">
              <div>
                <div className="fb-heading">Popis vozidla</div>
                <div className="fb-text fb-popis">{data.popis}</div>
              </div>
              <div>
                <div className="fb-heading">Hlavní výbava</div>
                <div className="fb-text">
                  {data.vybava.split("\n").filter(Boolean).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Tisk / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintFlyerDialog;

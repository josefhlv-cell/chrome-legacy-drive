import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Loader2, RotateCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

// Limity aby se vše vešlo na 1 stránku A4 a nepřekrývalo QR kód
const MAX_VYBAVA_ITEMS_PORTRAIT = 8;
const MAX_VYBAVA_CHARS_PORTRAIT = 220;
const MAX_POPIS_CHARS_PORTRAIT = 420;

const MAX_VYBAVA_ITEMS_LANDSCAPE = 10;
const MAX_VYBAVA_CHARS_LANDSCAPE = 320;
const MAX_POPIS_CHARS_LANDSCAPE = 520;

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

const limitPopis = (raw: string, maxChars: number): string => truncate(raw.trim(), maxChars);

const PrintFlyerDialog = ({ open, onOpenChange, vehicle, siteUrl }: Props) => {
  const { toast } = useToast();
  const [data, setData] = useState<FlyerData | null>(null);
  const [generatingEquipment, setGeneratingEquipment] = useState(false);
  const [mainPhoto, setMainPhoto] = useState<string>("");
  const [landscape, setLandscape] = useState(false);

  const maxVybavaItems = landscape ? MAX_VYBAVA_ITEMS_LANDSCAPE : MAX_VYBAVA_ITEMS_PORTRAIT;
  const maxVybavaChars = landscape ? MAX_VYBAVA_CHARS_LANDSCAPE : MAX_VYBAVA_CHARS_PORTRAIT;
  const maxPopisChars = landscape ? MAX_POPIS_CHARS_LANDSCAPE : MAX_POPIS_CHARS_PORTRAIT;

  const qrUrl = vehicle ? `${siteUrl}/vozidla/${vehicle.id}` : "";

  // Fetch main photo for watermark
  useEffect(() => {
    if (!vehicle || !open) { setMainPhoto(""); return; }
    (async () => {
      const { data: imgs } = await supabase
        .from("vehicle_images")
        .select("image_url, is_main, sort_order")
        .eq("vehicle_id", vehicle.id)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(1);
      setMainPhoto(imgs?.[0]?.image_url || vehicle.image_url || "");
    })();
  }, [vehicle, open]);

  // Re-truncate when orientation toggles
  useEffect(() => {
    setData((d) => d ? {
      ...d,
      vybava: limitVybava(d.vybava, maxVybavaItems, maxVybavaChars),
      popis: limitPopis(d.popis, maxPopisChars),
    } : d);
  }, [landscape, maxVybavaItems, maxVybavaChars, maxPopisChars]);

  // Build initial flyer data from vehicle
  useEffect(() => {
    if (!vehicle || !open) return;

    const priceFormatted = formatPrice(vehicle.price_with_vat);
    let priceMain = priceFormatted;
    let priceVatLine = "";
    if (vehicle.show_vat) {
      priceMain = priceFormatted;
      const withVat = priceWithVatFromNet(vehicle.price_with_vat);
      priceVatLine = `S DPH / ${formatPrice(withVat)}`;
    }

    setData({
      title: vehicle.name?.toUpperCase() || "",
      subtitle: vehicle.engine?.toUpperCase() || "",
      priceMain,
      priceVatLine,
      vyrobeno: String(vehicle.year || ""),
      najeto: vehicle.mileage ? `${vehicle.mileage.toLocaleString("cs-CZ")} KM` : "",
      palivo: (vehicle.fuel || "").toUpperCase(),
      prevodovka: (vehicle.transmission || "").toUpperCase(),
      vykon: (vehicle.power || "").toUpperCase(),
      objem: "",
      stkDo: "",
      barva: (vehicle.color || "").toUpperCase(),
      vybava: "",
      popis: limitPopis(vehicle.description || "", maxPopisChars),
    });
  }, [vehicle, open]);

  // Generate equipment from VIN via AI
  const generateEquipment = async () => {
    if (!vehicle?.vin) {
      toast({ title: "Vozidlo nemá VIN", description: "Vyplňte VIN v editaci vozu.", variant: "destructive" });
      return;
    }
    setGeneratingEquipment(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("vin-decode", {
        body: { vin: vehicle.vin },
      });
      if (error) throw error;
      const equipment = result?.typicalEquipment || result?.decoded?.typicalEquipment || "";
      if (!equipment) {
        toast({ title: "AI nevrátila výbavu", description: "Zkuste znovu nebo vyplňte ručně.", variant: "destructive" });
        return;
      }
      // Convert comma/semicolon list to line-per-item, omez na limit znaků/položek
      const lines = equipment
        .split(/[,;\n]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      const limited = limitVybava(lines.join("\n"), maxVybavaItems, maxVybavaChars);
      setData((d) => (d ? { ...d, vybava: limited } : d));
      toast({ title: "Výbava vygenerována" });
    } catch (e: any) {
      toast({ title: "Chyba generování", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setGeneratingEquipment(false);
    }
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
            <Printer className="w-5 h-5" /> Tisk letáku A4 — {vehicle.name}
          </DialogTitle>
          <DialogDescription>
            Vyplňte / upravte údaje. Popis vozidla zadejte ručně. Tlačítkem "Generovat výbavu z VIN" necháte AI navrhnout výbavu.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 print:block">
          {/* === EDITOR (hidden in print) === */}
          <div className="space-y-3 print:hidden">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Název (velký nadpis)</Label>
                <Input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Podnadpis (motor)</Label>
                <Input value={data.subtitle} onChange={(e) => setData({ ...data, subtitle: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Cena (hlavní)</Label>
                <Input value={data.priceMain} onChange={(e) => setData({ ...data, priceMain: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Pod cenou (S DPH řádek)</Label>
                <Input value={data.priceVatLine} onChange={(e) => setData({ ...data, priceVatLine: e.target.value })} placeholder="prázdné = nezobrazí se" />
              </div>
              <div>
                <Label className="text-xs">Vyrobeno</Label>
                <Input value={data.vyrobeno} onChange={(e) => setData({ ...data, vyrobeno: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Najeto</Label>
                <Input value={data.najeto} onChange={(e) => setData({ ...data, najeto: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Palivo</Label>
                <Input value={data.palivo} onChange={(e) => setData({ ...data, palivo: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Převodovka</Label>
                <Input value={data.prevodovka} onChange={(e) => setData({ ...data, prevodovka: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Výkon</Label>
                <Input value={data.vykon} onChange={(e) => setData({ ...data, vykon: e.target.value })} placeholder="218 KW (296 K)" />
              </div>
              <div>
                <Label className="text-xs">Objem</Label>
                <Input value={data.objem} onChange={(e) => setData({ ...data, objem: e.target.value })} placeholder="3604 CCM" />
              </div>
              <div>
                <Label className="text-xs">STK do</Label>
                <Input value={data.stkDo} onChange={(e) => setData({ ...data, stkDo: e.target.value })} placeholder="12/2026" />
              </div>
              <div>
                <Label className="text-xs">Barva</Label>
                <Input value={data.barva} onChange={(e) => setData({ ...data, barva: e.target.value })} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">
                  Hlavní výbava ({data.vybava.length}/{maxVybavaChars} znaků, max {maxVybavaItems} řádků)
                </Label>
                <Button size="sm" variant="outline" onClick={generateEquipment} disabled={generatingEquipment} className="h-7 text-xs">
                  {generatingEquipment ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Generovat výbavu z VIN (AI)
                </Button>
              </div>
              <Textarea
                rows={6}
                value={data.vybava}
                onChange={(e) => setData({ ...data, vybava: limitVybava(e.target.value, maxVybavaItems, maxVybavaChars) })}
                placeholder="Dvouzónová klimatizace&#10;Kůže, vyhřívaná a odvětrávaná&#10;..."
              />
            </div>

            <div>
              <Label className="text-xs">
                Popis vozidla — vyplňte ručně ({data.popis.length}/{maxPopisChars} znaků)
              </Label>
              <Textarea
                rows={6}
                value={data.popis}
                onChange={(e) => setData({ ...data, popis: e.target.value.slice(0, maxPopisChars) })}
                placeholder="Automobil ve výborném stavu, po prvním majiteli v ČR..."
              />
            </div>
          </div>

          {/* === FLYER PREVIEW & PRINT === */}
          <div id="print-flyer-area" className={`flyer-a4 ${landscape ? "landscape" : ""} bg-white text-black mx-auto shadow-2xl print:shadow-none`}>
            {/* Watermark — main vehicle photo behind content, opacity 10% */}
            {mainPhoto && (
              <div
                className="flyer-watermark"
                style={{ backgroundImage: `url(${mainPhoto})` }}
                aria-hidden="true"
              />
            )}

            {/* Header */}
            <div className="flyer-header">
              <div className="flyer-shield">
                <img src={logoShield} alt="Chrysler Dodge Pardubice" />
              </div>
              <div className="flyer-contact">
                <div className="fc-line fc-bold">CHRYSLER PARDUBICE</div>
                <div className="fc-line">LUKOVNA 11, 533 04</div>
                <div className="fc-line">TEL: +420 603 559 767</div>
                <div className="fc-line">WWW.CHRYSLERPARDUBICE.SITE</div>
              </div>
            </div>

            {/* Title */}
            <h1 className="flyer-title">{data.title}</h1>

            {/* Subtitle + price box */}
            <div className="flyer-sub-row">
              <div className="flyer-subtitle">{data.subtitle}</div>
              <div className="flyer-price-box">
                <div className="fp-main">{data.priceMain}</div>
                {data.priceVatLine && <div className="fp-sub">{data.priceVatLine}</div>}
              </div>
            </div>

            {/* Specs box */}
            <div className="flyer-specs">
              <div className="fs-col">
                <div className="fs-row"><span className="fs-key">VYROBENO:</span> <span className="fs-val">{data.vyrobeno}</span></div>
                <div className="fs-row"><span className="fs-key">NAJETO:</span> <span className="fs-val">{data.najeto}</span></div>
                <div className="fs-row"><span className="fs-key">PALIVO:</span> <span className="fs-val">{data.palivo}</span></div>
                <div className="fs-row"><span className="fs-key">PŘEVODOVKA:</span> <span className="fs-val">{data.prevodovka}</span></div>
              </div>
              <div className="fs-col">
                <div className="fs-row"><span className="fs-key">VÝKON:</span> <span className="fs-val">{data.vykon}</span></div>
                <div className="fs-row"><span className="fs-key">OBJEM:</span> <span className="fs-val">{data.objem}</span></div>
                <div className="fs-row"><span className="fs-key">STK DO:</span> <span className="fs-val">{data.stkDo}</span></div>
                <div className="fs-row"><span className="fs-key">BARVA:</span> <span className="fs-val">{data.barva}</span></div>
              </div>
            </div>

            {/* Equipment + description */}
            <div className="flyer-bottom">
              <div className="fb-col">
                <div className="fb-heading">HLAVNÍ VÝBAVA:</div>
                <div className="fb-text">
                  {data.vybava.split("\n").filter(Boolean).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
              <div className="fb-col">
                <div className="fb-heading">POPIS VOZIDLA:</div>
                <div className="fb-text fb-popis">{data.popis}</div>
              </div>
            </div>

            {/* QR — fixed at bottom (size scaled by CSS to 36mm portrait / 30mm landscape) */}
            <div className="flyer-qr">
              <QRCodeSVG id={`flyer-qr-${vehicle.id}`} value={qrUrl} size={256} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={false} />
              <div className="flyer-qr-caption">Naskenujte kód pro detailní nabídku</div>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavřít</Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Tisk / Uložit jako PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintFlyerDialog;

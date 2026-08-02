import { useState } from "react";
import JSZip from "jszip";
import { Share2, Loader2, Copy, Check, ExternalLink, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { DbVehicle } from "@/hooks/useVehicles";
import { formatPrice } from "@/data/vehicles";

type Portal = "sbazar" | "bazos" | "hyperinzerce";

const PORTAL_META: Record<Portal, { label: string; color: string; newAdUrl: string }> = {
  sbazar: {
    label: "Sbazar",
    color: "text-sky-400",
    newAdUrl: "https://www.sbazar.cz/pridat-inzerat",
  },
  bazos: {
    label: "Bazoš",
    color: "text-emerald-400",
    newAdUrl: "https://auto.bazos.cz/pridat-inzerat.php",
  },
  hyperinzerce: {
    label: "Hyperinzerce",
    color: "text-amber-400",
    newAdUrl: "https://auto.hyperinzerce.cz/vlozit-inzerat/",
  },
};

function buildTitle(v: DbVehicle): string {
  // Sbazar/Bazoš title length ~ 60 chars
  return `${v.name}${v.year ? `, ${v.year}` : ""}${v.mileage ? `, ${v.mileage.toLocaleString("cs-CZ")} km` : ""}`.slice(0, 60);
}

function buildDescription(v: DbVehicle, portal: Portal): string {
  const lines: string[] = [];
  lines.push(`${v.name}`);
  lines.push("");
  lines.push("📋 ZÁKLADNÍ ÚDAJE:");
  if (v.year) lines.push(`• Rok: ${v.year}`);
  if (v.mileage) lines.push(`• Nájezd: ${v.mileage.toLocaleString("cs-CZ")} km`);
  if (v.fuel) lines.push(`• Palivo: ${v.fuel}`);
  if (v.transmission) lines.push(`• Převodovka: ${v.transmission}`);
  if (v.engine) lines.push(`• Motor: ${v.engine}`);
  if (v.power) lines.push(`• Výkon: ${v.power}`);
  if (v.color) lines.push(`• Barva: ${v.color}`);
  if (v.vin) lines.push(`• VIN: ${v.vin}`);
  lines.push("");
  lines.push(`💰 CENA: ${formatPrice(v.price_with_vat)}${v.show_vat ? " s DPH" : ""}`);
  lines.push("");

  if (v.description) {
    lines.push("📝 POPIS:");
    lines.push(v.description);
    lines.push("");
  }

  const features: string[] = [];
  if (v.lpg_enabled) features.push("✅ LPG přestavba s plnou zárukou");
  if (v.warranty_enabled) features.push("✅ Záruka na vozidlo");
  if (v.carfax_enabled) features.push("✅ Carfax k dispozici");
  if (v.video_enabled) features.push("✅ Video k vozidlu");
  if (features.length > 0) {
    lines.push("⭐ VÝHODY:");
    lines.push(...features);
    lines.push("");
  }

  lines.push("🏢 PRODEJCE: Chrysler – Dodge Pardubice");
  lines.push("📞 Prodej: +420 603 559 767");
  lines.push("🌐 www.chryslerpardubice.site");
  lines.push("");
  lines.push("Specializovaný autobazar amerických vozů. Profesionální servis, výkup a dovoz.");

  if (portal === "bazos") {
    // Bazoš nepodporuje emoji dobře — necháme, ale je to ok
  }

  return lines.join("\n");
}

interface Props {
  vehicle: DbVehicle;
}

export default function QuickExportButton({ vehicle }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Portal | null>(null);
  const [copied, setCopied] = useState<Portal | null>(null);

  async function fetchImages(): Promise<{ name: string; blob: Blob }[]> {
    const { data: images, error } = await supabase
      .from("vehicle_images")
      .select("image_url, sort_order, is_main")
      .eq("vehicle_id", vehicle.id)
      .order("sort_order").order("id");
    if (error) throw error;
    if (!images || images.length === 0) return [];

    // main first
    const sorted = [...images].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    const results: { name: string; blob: Blob }[] = [];
    for (let i = 0; i < sorted.length; i++) {
      try {
        const resp = await fetch(sorted[i].image_url);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const ext = blob.type.includes("png") ? "png" : "jpg";
        const name = `${String(i + 1).padStart(2, "0")}.${ext}`;
        results.push({ name, blob });
      } catch (e) {
        console.warn("Image download failed", e);
      }
    }
    return results;
  }

  async function handleExport(portal: Portal) {
    setBusy(portal);
    try {
      const title = buildTitle(vehicle);
      const description = buildDescription(vehicle, portal);
      const fullText = `${title}\n\n${description}`;

      // 1) copy to clipboard
      await navigator.clipboard.writeText(fullText);
      setCopied(portal);
      setTimeout(() => setCopied(null), 2500);

      // 2) build ZIP with photos
      toast({ title: `Připravuji fotky pro ${PORTAL_META[portal].label}...`, description: "Stahuji fotografie" });
      const images = await fetchImages();
      if (images.length > 0) {
        const zip = new JSZip();
        const safeName = vehicle.name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40);
        const folder = zip.folder(safeName) ?? zip;
        folder.file("popis-inzeratu.txt", fullText);
        for (const img of images) folder.file(img.name, img.blob);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${PORTAL_META[portal].label}-${safeName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // 3) open the portal in new tab
      window.open(PORTAL_META[portal].newAdUrl, "_blank", "noopener,noreferrer");

      toast({
        title: `✅ Připraveno pro ${PORTAL_META[portal].label}`,
        description: `Text je ve schránce, fotky v ZIPu (${images.length}) staženy. Portál otevřen v novém okně.`,
      });
    } catch (err: any) {
      toast({
        title: "Chyba přípravy exportu",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 text-muted-foreground hover:text-sky-400 transition-colors"
        title="Rychlý export na bazary (Sbazar, Bazoš, Hyperinzerce)"
      >
        <Share2 className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-4 rounded-lg bg-secondary/50 border border-border"
          >
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-sky-400" />
              <h4 className="text-sm font-bold text-foreground">Rychlý export na bazary</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Klikněte na portál — text se zkopíruje do schránky, fotky se stáhnou jako ZIP a portál se otevře v novém okně.
              Stačí pak vložit text (Ctrl+V) a nahrát fotky ze ZIPu.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(PORTAL_META) as Portal[]).map((p) => {
                const meta = PORTAL_META[p];
                const isBusy = busy === p;
                const isCopied = copied === p;
                return (
                  <button
                    key={p}
                    onClick={() => handleExport(p)}
                    disabled={isBusy}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-md bg-background border border-border hover:border-primary/50 transition-colors text-sm disabled:opacity-50"
                  >
                    <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <><Copy className="w-3.5 h-3.5" /><Download className="w-3.5 h-3.5" /><ExternalLink className="w-3.5 h-3.5" /></>}
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setOpen(false)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">
              Zavřít
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

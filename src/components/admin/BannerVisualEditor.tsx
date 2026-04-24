import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { X, Save, Maximize2, Smartphone, Tablet, Monitor } from "lucide-react";
import type { Banner, BannerInsert } from "@/hooks/useBanners";

interface PositionMatrix {
  x_percent?: number;
  y_percent?: number;
  width_percent?: number;
  height_percent?: number;
  z_index?: number;
}

interface Props {
  banner: Banner | BannerInsert;
  onChange: (next: Banner | BannerInsert) => void;
  onClose: () => void;
  onSave: () => void;
}

const VIEWPORTS = {
  desktop: { w: 1280, h: 800, label: "Desktop", icon: Monitor },
  tablet: { w: 1024, h: 768, label: "Tablet", icon: Tablet },
  mobile: { w: 390, h: 800, label: "Mobil", icon: Smartphone },
} as const;
type ViewportKey = keyof typeof VIEWPORTS;

const SNAP_PCT = 2; // snap each 2%
const snap = (n: number, step = SNAP_PCT) => Math.round(n / step) * step;

/**
 * Visual Placement Engine: live iframe of the target page with a draggable/resizable
 * preview of the banner. Position is stored as % of viewport for responsiveness.
 */
const BannerVisualEditor = ({ banner, onChange, onClose, onSave }: Props) => {
  const [vp, setVp] = useState<ViewportKey>("desktop");
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });

  const matrix = (banner.position_matrix as PositionMatrix) || {};
  const vpDef = VIEWPORTS[vp];

  // Track stage size (the area where the iframe is rendered)
  useEffect(() => {
    const update = () => {
      if (!frameRef.current) return;
      const r = frameRef.current.getBoundingClientRect();
      setFrameSize({ w: r.width, h: r.height });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [vp]);

  // Convert % → px in the displayed frame
  const pxFromPct = (pct: number, total: number) => (pct / 100) * total;

  const x_pct = typeof matrix.x_percent === "number" ? matrix.x_percent : 10;
  const y_pct = typeof matrix.y_percent === "number" ? matrix.y_percent : 10;
  const w_pct = typeof matrix.width_percent === "number" ? matrix.width_percent : 50;
  const h_pct = typeof matrix.height_percent === "number" ? matrix.height_percent : 30;

  const x = pxFromPct(x_pct, frameSize.w);
  const y = pxFromPct(y_pct, frameSize.h);
  const w = pxFromPct(w_pct, frameSize.w);
  const h = pxFromPct(h_pct, frameSize.h);

  const persist = (next: PositionMatrix) => {
    onChange({ ...banner, position_matrix: { ...matrix, ...next, z_index: matrix.z_index ?? 10 } as any });
  };

  // Map admin slugs → real Czech routes
  const PAGE_ROUTES: Record<string, string> = {
    home: "/",
    vehicles: "/vozidla",
    service: "/servis",
    "spare-parts": "/nahradni-dily",
  };
  const previewUrl = PAGE_ROUTES[banner.target_page || "home"] || "/";
  const styles = (banner.styles as any) || {};
  const content = (banner.content_data as any) || {};

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 flex flex-col">
      {/* Toolbar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Maximize2 className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">Visual Placement Editor</span>
          <span className="text-xs text-muted-foreground">·  {previewUrl || "/"}</span>
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(VIEWPORTS) as ViewportKey[]).map((k) => {
            const Icon = VIEWPORTS[k].icon;
            return (
              <button key={k} onClick={() => setVp(k)}
                      className={`px-3 py-1.5 rounded inline-flex items-center gap-1.5 text-xs uppercase tracking-wider ${vp === k ? "bg-primary text-primary-foreground" : "outline-button"}`}>
                <Icon className="w-3.5 h-3.5" /> {VIEWPORTS[k].label}
              </button>
            );
          })}
          <div className="w-px h-6 bg-border mx-1" />
          <button onClick={onSave} className="chrome-button inline-flex items-center gap-2"><Save className="w-4 h-4" /> Uložit</button>
          <button onClick={onClose} className="outline-button p-2"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Stage */}
      <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
        <div className="relative shadow-2xl bg-background" style={{ width: vpDef.w, height: vpDef.h }} ref={frameRef}>
          <iframe
            src={previewUrl || "/"}
            title="preview"
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          />
          {frameSize.w > 0 && (
            <Rnd
              bounds="parent"
              size={{ width: w, height: h }}
              position={{ x, y }}
              dragGrid={[Math.max(1, frameSize.w * (SNAP_PCT / 100)), Math.max(1, frameSize.h * (SNAP_PCT / 100))]}
              resizeGrid={[Math.max(1, frameSize.w * (SNAP_PCT / 100)), Math.max(1, frameSize.h * (SNAP_PCT / 100))]}
              onDragStop={(_, d) => {
                persist({
                  x_percent: snap((d.x / frameSize.w) * 100),
                  y_percent: snap((d.y / frameSize.h) * 100),
                });
              }}
              onResizeStop={(_, __, ref, ____, pos) => {
                persist({
                  x_percent: snap((pos.x / frameSize.w) * 100),
                  y_percent: snap((pos.y / frameSize.h) * 100),
                  width_percent: snap((ref.offsetWidth / frameSize.w) * 100),
                  height_percent: snap((ref.offsetHeight / frameSize.h) * 100),
                });
              }}
              className="border-2 border-primary"
              style={{ zIndex: matrix.z_index ?? 10 }}
            >
              <div className="w-full h-full relative overflow-hidden flex items-center justify-center"
                   style={{
                     background: banner.media_url ? "transparent" : (styles.bgColor || "hsl(var(--primary) / 0.7)"),
                     color: styles.textColor || "#ffffff",
                   }}>
                {banner.media_url && banner.content_type === "video" ? (
                  <video src={banner.media_url} muted autoPlay loop className="absolute inset-0 w-full h-full object-cover" />
                ) : banner.media_url ? (
                  <img src={banner.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-black/30" />
                <div className="relative text-center p-3">
                  <div className="font-bold text-sm md:text-base drop-shadow">{content.title || banner.headline || banner.name}</div>
                  {(content.body || banner.subheadline) && (
                    <div className="text-xs opacity-90 mt-1 drop-shadow">{content.body || banner.subheadline}</div>
                  )}
                </div>
              </div>
            </Rnd>
          )}
        </div>
      </div>

      {/* Footer with current matrix readout */}
      <div className="bg-card border-t border-border px-4 py-2 text-xs text-muted-foreground font-mono">
        x: {x_pct}% · y: {y_pct}% · w: {w_pct}% · h: {h_pct}% · z: {matrix.z_index ?? 10} · snap: {SNAP_PCT}%
      </div>
    </div>
  );
};

export default BannerVisualEditor;

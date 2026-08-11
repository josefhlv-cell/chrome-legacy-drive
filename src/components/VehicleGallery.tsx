import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import logoPardubice from "@/assets/logo-pardubice.webp";

interface VehicleGalleryProps {
  images: string[];
  vehicleName: string;
  initialIndex?: number;
  inventoryNumber?: string;
}

const SWIPE_THRESHOLD = 50;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

const VehicleGallery = ({ images, vehicleName, initialIndex = 0, inventoryNumber }: VehicleGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hiResLoaded, setHiResLoaded] = useState(false);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  // Reset zoom when image changes or lightbox opens/closes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHiResLoaded(false);
  }, [selectedIndex, lightboxOpen]);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  if (images.length === 0) return null;

  const goTo = (index: number) => {
    setSelectedIndex((index + images.length) % images.length);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) goTo(selectedIndex + 1);
    else if (info.offset.x > SWIPE_THRESHOLD) goTo(selectedIndex - 1);
  };

  return (
    <>
      {/* Main image with touch swipe */}
      <div className="relative group cursor-pointer overflow-hidden rounded-lg bg-background w-full aspect-[3/2] max-h-[70vh]" onClick={() => setLightboxOpen(true)}>
        <AnimatePresence mode="wait">
          <motion.img
            key={selectedIndex}
            src={images[selectedIndex]}
            alt={`${vehicleName} - foto ${selectedIndex + 1}`}
            className="absolute inset-0 h-full w-full object-cover object-center touch-pan-y bg-muted/30"
            decoding="async"
            loading={selectedIndex === 0 ? "eager" : "lazy"}
            fetchPriority={selectedIndex === 0 ? "high" : "auto"}
            width={1280}
            height={800}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              // Don't open lightbox if user was swiping
              if (Math.abs(e.clientX) < 5) e.stopPropagation();
            }}
          />
        </AnimatePresence>
        {/* Watermark */}
        <div className="absolute bottom-4 right-4 pointer-events-none opacity-30">
          <img src={logoPardubice} alt="" className="h-14 w-auto" />
        </div>
        {/* Zoom hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg pointer-events-none">
          <ZoomIn className="w-8 h-8 text-white" />
        </div>
        {/* Nav arrows on main image */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(selectedIndex - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(selectedIndex + 1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full z-10">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                i === selectedIndex ? "border-primary ring-1 ring-primary" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={img}
                alt={`${vehicleName} thumbnail ${i + 1}`}
                className="h-12 w-16 bg-muted/40 object-cover object-center"
                loading="lazy"
                decoding="async"
                width={64}
                height={48}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
            >
              <X className="w-8 h-8" />
            </button>

            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(selectedIndex - 1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(selectedIndex + 1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Zoom controls */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(MAX_ZOOM, z + 0.5)); }}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                aria-label="Přiblížit"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoom((z) => { const n = Math.max(MIN_ZOOM, z - 0.5); if (n <= 1) setPan({ x: 0, y: 0 }); return n; }); }}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                aria-label="Oddálit"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              {zoom > 1 && (
                <span className="bg-white/10 text-white text-xs px-3 py-2 rounded-full font-montserrat">
                  {zoom.toFixed(1)}×
                </span>
              )}
            </div>

            {/* Loading spinner for hi-res */}
            {!hiResLoaded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 className="w-10 h-10 text-white/70 animate-spin" />
              </div>
            )}

            <div
              className="relative max-w-[95vw] max-h-[90vh] overflow-hidden flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => {
                const delta = e.deltaY > 0 ? -0.25 : 0.25;
                setZoom((z) => {
                  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta));
                  if (next <= 1) setPan({ x: 0, y: 0 });
                  return next;
                });
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  pinchRef.current = { dist: Math.hypot(dx, dy), zoom };
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2 && pinchRef.current) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  const dist = Math.hypot(dx, dy);
                  const ratio = dist / pinchRef.current.dist;
                  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * ratio));
                  setZoom(next);
                  if (next <= 1) setPan({ x: 0, y: 0 });
                }
              }}
              onTouchEnd={(e) => {
                if (e.touches.length < 2) pinchRef.current = null;
              }}
            >
              {/* Intermediate placeholder: 1280px WebP shows instantly while 7.5MB original loads behind it */}
              {!hiResLoaded && (
                <img
                  src={images[selectedIndex]}
                  alt=""
                  aria-hidden="true"
                  className="absolute max-w-[95vw] max-h-[90vh] object-contain rounded-lg select-none pointer-events-none"
                  style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                  decoding="async"
                  draggable={false}
                />
              )}
              <motion.img
                key={selectedIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: hiResLoaded ? 1 : 0 }}
                exit={{ opacity: 0 }}
                src={images[selectedIndex]}
                alt={`${vehicleName} - foto ${selectedIndex + 1}`}
                className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg select-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  cursor: zoom > 1 ? "grab" : "zoom-in",
                  transition: pinchRef.current ? "none" : "transform 0.15s ease-out",
                }}
                onLoad={() => setHiResLoaded(true)}
                onClick={() => {
                  if (zoom === 1) setZoom(2);
                  else { setZoom(1); setPan({ x: 0, y: 0 }); }
                }}
                drag={zoom > 1 ? true : "x"}
                dragConstraints={zoom > 1 ? undefined : { left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (zoom > 1) {
                    setPan((p) => ({ x: p.x + info.offset.x / zoom, y: p.y + info.offset.y / zoom }));
                  } else {
                    handleDragEnd(_, info);
                  }
                }}
                draggable={false}
              />
            </div>

            {/* Caption */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none px-4">
              <p className="text-white text-sm font-semibold font-serif">{vehicleName}</p>
              <p className="text-white/60 text-xs font-montserrat mt-0.5">
                {inventoryNumber ? `Ev.č. ${inventoryNumber} · ` : ""}
                {selectedIndex + 1} / {images.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VehicleGallery;

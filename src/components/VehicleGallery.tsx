import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import logoPardubice from "@/assets/logo-pardubice.png";

interface VehicleGalleryProps {
  images: string[];
  vehicleName: string;
}

const VehicleGallery = ({ images, vehicleName }: VehicleGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) return null;

  const goTo = (index: number) => {
    setSelectedIndex((index + images.length) % images.length);
  };

  return (
    <>
      {/* Main image */}
      <div className="relative group cursor-pointer" onClick={() => setLightboxOpen(true)}>
        <img
          src={images[selectedIndex]}
          alt={`${vehicleName} - foto ${selectedIndex + 1}`}
          className="w-full rounded-lg object-cover aspect-[4/3]"
          width={800}
          height={600}
        />
        {/* Watermark */}
        <div className="absolute bottom-4 right-4 pointer-events-none opacity-30">
          <img src={logoPardubice} alt="" className="h-14 w-auto" />
        </div>
        {/* Zoom hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
          <ZoomIn className="w-8 h-8 text-white" />
        </div>
        {/* Nav arrows on main image */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(selectedIndex - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(selectedIndex + 1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
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
                className="w-16 h-12 object-cover"
                loading="lazy"
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

            <motion.img
              key={selectedIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              src={images[selectedIndex]}
              alt={`${vehicleName} - foto ${selectedIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm">
              {selectedIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VehicleGallery;

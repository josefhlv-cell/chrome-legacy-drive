export const LoadingOverlay = ({ progress }: { progress: number }) => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05070b]">
    <p className="text-[10px] uppercase tracking-[0.4em] text-primary">Chrysler</p>
    <h2 className="mt-2 font-serif italic text-2xl md:text-3xl text-white">Chrysler Pacifica</h2>
    <p className="mt-3 text-xs text-white/60">Načítám digitální showroom…</p>
    <div className="mt-6 h-[3px] w-52 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${Math.max(8, Math.min(100, progress))}%` }}
      />
    </div>
  </div>
);

export default LoadingOverlay;

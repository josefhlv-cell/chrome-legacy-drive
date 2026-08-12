import { Undo2 } from "lucide-react";

export type ActionChip = {
  key: string;
  label: string;
  onRevert: () => void;
};

/**
 * Plovoucí ovládání aktivních animací — po otevření dveří nebo sklopení
 * sedadel lze stav vrátit jedním dotykem, bez hledání hotspotu.
 */
export const ActionDock = ({ items, offset }: { items: ActionChip[]; offset: boolean }) => {
  if (items.length === 0) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-30 justify-center px-3 transition-[bottom] duration-400 ${
        offset
          ? "hidden md:flex md:bottom-[5.4rem]"
          : "flex bottom-[calc(env(safe-area-inset-bottom)+4.6rem)]"
      }`}
    >
      <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto no-scrollbar rounded-full border border-white/10 bg-black/45 p-1.5 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={i.onRevert}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[11px] font-medium text-white/90 transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
          >
            <Undo2 className="h-3.5 w-3.5 text-primary" />
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActionDock;

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "compare-vehicle-ids";
export const MAX_COMPARE = 4;

interface CompareContextValue {
  ids: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

const readStored = (): string[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};

export const CompareProvider = ({ children }: { children: React.ReactNode }) => {
  const [ids, setIds] = useState<string[]>(readStored);

  // Persist to sessionStorage so the selection survives route changes and reloads
  // within the same tab, but never leaks into a new browsing session.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* private mode — selection simply stays in memory */
    }
  }, [ids]);

  const add = useCallback((id: string) => {
    setIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= MAX_COMPARE) {
        toast({
          title: "Maximálně 4 vozy",
          description: "Pro porovnání odeberte některý z už vybraných vozů.",
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const remove = useCallback((id: string) => setIds((prev) => prev.filter((x) => x !== id)), []);
  const clear = useCallback(() => setIds([]), []);
  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= MAX_COMPARE) {
          toast({
            title: "Maximálně 4 vozy",
            description: "Pro porovnání odeberte některý z už vybraných vozů.",
            variant: "destructive",
          });
          return prev;
        }
        return [...prev, id];
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ ids, isSelected: (id: string) => ids.includes(id), toggle, add, remove, clear }),
    [ids, toggle, add, remove, clear],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
};

export const useCompare = () => {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    // Rendered outside the provider (e.g. isolated tests) — behave as a no-op.
    return {
      ids: [] as string[],
      isSelected: () => false,
      toggle: () => {},
      add: () => {},
      remove: () => {},
      clear: () => {},
    } satisfies CompareContextValue;
  }
  return ctx;
};

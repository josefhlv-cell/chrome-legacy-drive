/**
 * AutoModelPrepare — automatická příprava 3D/AR modelů pro vozy v nabídce.
 *
 * PROČ TO EXISTUJE
 * ----------------
 * Zákazník uvidí AR jen u vozu, který má vlastní publikovaný model. Dřív to
 * znamenalo, že obsluha musela každý vůz ručně proklikat generátorem — a než
 * to udělala, návštěvník na detailu vozu narazil na hlášku, že model není
 * připravený. Tady se modely připraví samy: z barvy a výbavy uložené v kartě
 * vozu, bez fotek a bez AI. Admin může kdykoli přegenerovat s vlastním
 * doladěním — ruční publikace vždy přepíše tu automatickou.
 *
 * BEZPEČNOSTNÍ ZÁBRANY
 *  - běží pouze pro vozy značky Pacifica (jediná karoserie, kterou máme ve 3D),
 *  - jeden vůz v jednu chvíli (paměť prohlížeče), s pevným limitem na dávku,
 *  - vozy s hotovým modelem se přeskočí, takže opakované otevření adminu
 *    neplýtvá výkonem ani úložištěm.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Play, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  profileFromVehicle,
  publishVehicleModel,
  type VehicleSeed,
} from "@/features/model-generator/publishModel";

/** Kolik vozů maximálně zpracujeme v jedné dávce (ochrana paměti prohlížeče). */
const BATCH_LIMIT = 6;

/** Jediná karoserie dostupná ve 3D — jiný model by zákazníkovi ukázal cizí vůz. */
const SUPPORTED = /pacifica/i;

type PendingVehicle = VehicleSeed & { name: string };

/** Zabrání dvojímu rozjezdu (React StrictMode, dva otevřené panely). */
let runningGlobally = false;

export const AutoModelPrepare = ({ autoStart = true }: { autoStart?: boolean }) => {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingVehicle[] | null>(null);
  /** Hotové vozy se starým, těžkým souborem pro iPhone (přebalení na kliknutí). */
  const [stale, setStale] = useState<PendingVehicle[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<{ name: string; label: string; percent: number } | null>(
    null,
  );
  const [done, setDone] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const startedRef = useRef(false);

  const loadPending = useCallback(async () => {
    const { data, error } = await supabase
      .from("vehicles")
      .select(
        "id, name, color, ar_color_hex, ar_model_ready, ar_model_usdz_url, ar_model_config, status",
      )
      .neq("status", "prodano")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Seznam vozů pro přípravu modelů se nepodařilo načíst:", error);
      setPending([]);
      setStale([]);
      return [] as PendingVehicle[];
    }

    const supported = (data ?? []).filter((v) => SUPPORTED.test(v.name ?? ""));
    const seed = (v: (typeof supported)[number]): PendingVehicle => ({
      id: v.id,
      name: v.name ?? "Vozidlo",
      color: v.color,
      ar_color_hex: v.ar_color_hex,
    });

    const list = supported
      // Chybí GLB (Android/desktop) NEBO USDZ (iPhone) → model není hotový.
      .filter((v) => !v.ar_model_ready || !v.ar_model_usdz_url)
      .map(seed);

    /*
     * Hotové vozy, které vznikly ještě starým (těžkým) exportem pro iPhone.
     * Nepřepisujeme je automaticky — jen je nabídneme obsluze k přebalení.
     */
    const staleList = supported
      .filter((v) => v.ar_model_ready && v.ar_model_usdz_url)
      .filter((v) => {
        const config = (v.ar_model_config ?? null) as
          | { usdz_profile?: string; glb_size?: number }
          | null;
        // Starý profil NEBO soubor, u kterého se nepovedla komprese geometrie.
        return config?.usdz_profile !== "light" || (config?.glb_size ?? Infinity) > 12_000_000;
      })
      .map(seed);

    setPending(list);
    setStale(staleList);
    return list;
  }, []);

  const run = useCallback(
    async (list?: PendingVehicle[]) => {
      if (runningGlobally) return;
      const queue = (list ?? (await loadPending())).slice(0, BATCH_LIMIT);
      if (queue.length === 0) return;

      runningGlobally = true;
      setRunning(true);
      setDone([]);
      setFailed([]);

      for (const vehicle of queue) {
        try {
          await publishVehicleModel({
            profile: profileFromVehicle(vehicle),
            publish: true,
            onProgress: (p) => setCurrent({ name: vehicle.name, ...p }),
          });
          setDone((prev) => [...prev, vehicle.name]);
        } catch (e) {
          console.error("Automatická příprava modelu selhala:", vehicle.name, e);
          setFailed((prev) => [...prev, vehicle.name]);
        }
        // Krátká pauza mezi vozy uvolní paměť po exportu (GC okno).
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      setCurrent(null);
      setRunning(false);
      runningGlobally = false;
      await loadPending();
      toast({
        title: "Automatická příprava modelů dokončena",
        description: `Připraveno: ${queue.length} · zákazníci vidí AR u těchto vozů.`,
      });
    },
    [loadPending, toast],
  );

  /* Start po načtení: nové vozy v nabídce se připraví bez zásahu obsluhy. */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const list = await loadPending();
      if (autoStart && list.length > 0) await run(list);
    })();
  }, [autoStart, loadPending, run]);

  const count = pending?.length ?? 0;

  return (
    <section className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-montserrat text-sm font-semibold uppercase tracking-wider text-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Automatická příprava AR modelů
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Vozy v nabídce dostanou model automaticky (barva a kola z karty vozu). Ruční
            vygenerování níže má vždy přednost.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="outline-button inline-flex items-center gap-1.5 text-xs"
            onClick={() => void run()}
            disabled={running || count === 0}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : count === 0 ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {running ? "Připravuji…" : count === 0 ? "Vše připraveno" : `Připravit (${count})`}
          </button>

          {/*
            Přebalení jen na výslovné kliknutí — hotové modely se nikdy
            nepřepisují samy.
          */}
          {stale.length > 0 && (
            <button
              type="button"
              className="outline-button inline-flex items-center gap-1.5 text-xs"
              onClick={() => void run(stale)}
              disabled={running}
              title="Znovu vytvoří soubor pro iPhone v úsporném formátu (vzhled vozu zůstane)"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Zmenšit pro iPhone ({stale.length})
            </button>
          )}
        </div>
      </div>

      {current && (
        <div className="mt-3" role="status" aria-live="polite">
          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">
              {current.name} · {current.label}
            </span>
            <span>{current.percent} %</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${current.percent}%` }}
            />
          </div>
        </div>
      )}

      {(done.length > 0 || failed.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs">
          {done.map((name) => (
            <li key={name} className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {name} — model připraven
            </li>
          ))}
          {failed.map((name) => (
            <li key={name} className="flex items-center gap-1.5 text-destructive">
              <RefreshCw className="h-3.5 w-3.5" /> {name} — nepodařilo se, zkuste ručně
            </li>
          ))}
        </ul>
      )}

      {pending !== null && count > BATCH_LIMIT && !running && (
        <p className="mt-3 text-xs text-muted-foreground">
          Ve frontě je {count} vozů — jedna dávka připraví {BATCH_LIMIT}, pak stačí spustit znovu.
        </p>
      )}
    </section>
  );
};

export default AutoModelPrepare;

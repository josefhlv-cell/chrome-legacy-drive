import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Globe, Search, Database, Sparkles, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface SyncState {
  status: "running" | "completed" | "failed";
  phase: "queued" | "scraping" | "extracting" | "saving" | "done" | "error";
  progress: number;
  message: string;
  vehicles: number;
  updated: number;
  created: number;
}

const STEPS = [
  { phase: "queued", label: "Spuštění synchronizace", icon: Clock },
  { phase: "scraping", label: "Stahování dat z webu", icon: Globe },
  { phase: "extracting", label: "Extrakce vozů", icon: Search },
  { phase: "saving", label: "Ukládání do databáze", icon: Database },
  { phase: "done", label: "Dokončeno", icon: Sparkles },
] as const;

const phaseOrder = ["queued", "scraping", "extracting", "saving", "done", "error"];

interface Props {
  jobId: string | null;
  onComplete: () => void;
  onClose: () => void;
}

export const SyncProgressOverlay = ({ jobId, onComplete, onClose }: Props) => {
  const [state, setState] = useState<SyncState | null>(null);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data, error } = await supabase.functions.invoke("scrape-vehicles", {
        body: { jobId },
      });
      if (error) return;
      if (data?.success !== false) {
        setState(data as SyncState);
        if (data?.status === "completed" || data?.status === "failed") {
          if (data?.status === "completed") onComplete();
        }
      }
    } catch { /* ignore */ }
  }, [jobId, onComplete]);

  useEffect(() => {
    if (!jobId) return;
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [jobId, poll]);

  if (!jobId) return null;

  const currentPhaseIdx = state ? phaseOrder.indexOf(state.phase) : 0;
  const isError = state?.status === "failed";
  const isDone = state?.status === "completed";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="deep-card p-6 sm:p-8 w-full max-w-md"
        >
          <h3 className="text-lg font-bold text-foreground uppercase tracking-wider mb-6 text-center">
            Synchronizace vozidel
          </h3>

          {/* Steps */}
          <div className="space-y-3 mb-6">
            {STEPS.map((step, idx) => {
              const stepIdx = phaseOrder.indexOf(step.phase);
              const isActive = currentPhaseIdx === stepIdx && !isDone && !isError;
              const isCompleted = isDone ? true : currentPhaseIdx > stepIdx;
              const isFailed = isError && currentPhaseIdx === stepIdx;
              const Icon = step.icon;

              return (
                <div
                  key={step.phase}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    isActive ? "bg-primary/10 border border-primary/30" :
                    isCompleted ? "bg-emerald-500/10" :
                    isFailed ? "bg-destructive/10 border border-destructive/30" :
                    "opacity-40"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : isFailed ? (
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                  ) : (
                    <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${
                    isActive ? "text-primary" :
                    isCompleted ? "text-emerald-400" :
                    isFailed ? "text-destructive" :
                    "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <Progress value={state?.progress || 0} className="h-2 mb-3" />
          <p className="text-xs text-muted-foreground text-center mb-4">
            {state?.message || "Čekám na odpověď..."}
          </p>

          {/* Result stats */}
          {isDone && state && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 rounded-lg p-4 mb-4 text-center"
            >
              <p className="text-emerald-400 font-bold text-sm">
                {state.vehicles} vozidel nalezeno · {state.updated} aktualizováno · {state.created} nových
              </p>
            </motion.div>
          )}

          {isError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 rounded-lg p-4 mb-4 text-center"
            >
              <p className="text-destructive text-sm">{state?.message}</p>
            </motion.div>
          )}

          {/* Close button */}
          {(isDone || isError) && (
            <button onClick={onClose} className="chrome-button w-full mt-2">
              Zavřít
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

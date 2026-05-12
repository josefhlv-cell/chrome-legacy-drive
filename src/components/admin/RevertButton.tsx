import { useEffect, useState } from "react";
import { Undo2, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LOVABLE_PROJECT_URL =
  "https://lovable.dev/projects/c84aefff-909b-427b-9038-4e6708c93b3b";

const THINK_SECONDS = 60;

export default function RevertButton() {
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(THINK_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(THINK_SECONDS);
      return;
    }
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [open]);

  const ready = secondsLeft === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 px-5 py-3 text-base font-semibold text-destructive-foreground shadow-lg shadow-destructive/30 ring-1 ring-destructive/40 transition-all hover:scale-[1.02] hover:shadow-destructive/50 active:scale-95"
        title="Vrátit poslední změnu / obnovit předchozí verzi"
      >
        <Undo2 className="h-5 w-5" />
        Vrátit akci zpět
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">
              Jsi si jistý že chceš změny vrátit?!
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <span className="block">
                Tato akce otevře historii verzí, kde můžeš jedním klikem obnovit
                předchozí podobu stránky. Dej si v klidu minutu na rozmyšlenou —
                cesta zpět v čase by neměla být ukvapená.
              </span>
              <span className="mt-3 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4" />
                {ready
                  ? "Můžeš pokračovat."
                  : `Rozmyšlení: ${secondsLeft} s`}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zůstanu v přítomnosti</AlertDialogCancel>
            <AlertDialogAction
              disabled={!ready}
              onClick={(e) => {
                if (!ready) {
                  e.preventDefault();
                  return;
                }
                window.open(LOVABLE_PROJECT_URL, "_blank", "noopener,noreferrer");
                setOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Návrat do minulosti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

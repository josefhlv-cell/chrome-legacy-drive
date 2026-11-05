/**
 * DOČASNÝ STUB — plný SmartCapture byl přepsán PLACEHOLDERem při pushi.
 * Obnov z commitu 3cad31f09e1abfc4ede0206374c003af07314d26:
 *
 *   git checkout 3cad31f09e1abfc4ede0206374c003af07314d26 -- src/pages/SmartCapture.tsx
 *   git add src/pages/SmartCapture.tsx && git commit -m "Obnovení SmartCapture" && git push
 *
 * Hlasové ovládání je už v src/lib/smartCapture/voiceControl.ts na main.
 */
import { Camera } from "lucide-react";

export default function SmartCapture() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Camera className="text-cyan-300" />
          <h1 className="text-lg font-semibold">Smart Capture — obnovení souboru</h1>
        </div>
        <p className="text-sm text-white/70">
          Stránka focení byla omylem přepsána. Obnov původní soubor z Gitu a pushni na main.
        </p>
        <pre className="text-[11px] leading-relaxed bg-black/40 rounded-lg p-3 overflow-x-auto text-emerald-200/90">{
`git pull
git checkout 3cad31f09e1abfc4ede0206374c003af07314d26 -- src/pages/SmartCapture.tsx
git add src/pages/SmartCapture.tsx
git commit -m "Obnovení SmartCapture.tsx"
git push`
        }</pre>
        <p className="text-xs text-white/50">
          Modul hlasu (voiceControl.ts) je na main aktuální. Po obnově SmartCapture dopojíme mobilní mikrofon.
        </p>
      </div>
    </div>
  );
}

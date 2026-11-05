/**
 * DOČASNÝ STUB — plný SmartCapture (~75 KB) nejde pushnout přes MCP konektor.
 *
 * OBNOVA (počítač / Codespaces):
 *
 *   git pull
 *   git checkout 3cad31f09e1abfc4ede0206374c003af07314d26 -- src/pages/SmartCapture.tsx
 *   git add src/pages/SmartCapture.tsx
 *   git commit -m "Obnovení SmartCapture.tsx"
 *   git push
 *
 * Pak do souboru doplň hlasové úpravy (nebo použij soubor SmartCapture.tsx
 * stažený z chatu — už obsahuje hlas pro mobil).
 *
 * voiceControl.ts na main je aktuální.
 */
import { Camera } from "lucide-react";

export default function SmartCapture() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Camera className="text-cyan-300" size={22} />
          <h1 className="text-lg font-semibold">Smart Capture — obnov soubor</h1>
        </div>
        <p className="text-sm text-white/70">
          Stránka focení musí být obnovena z Gitu (soubor je příliš velký pro automatický push).
        </p>
        <pre className="text-[11px] leading-relaxed bg-black/50 rounded-lg p-3 overflow-x-auto text-emerald-200/90 whitespace-pre-wrap">{`git pull
git checkout 3cad31f09e1abfc4ede0206374c003af07314d26 -- src/pages/SmartCapture.tsx
git add src/pages/SmartCapture.tsx
git commit -m "Obnovení SmartCapture.tsx"
git push`}</pre>
        <p className="text-xs text-white/50">
          Nebo na GitHubu: Edit souboru → vlož obsah ze staženého SmartCapture.tsx z chatu → Commit.
        </p>
      </div>
    </div>
  );
}

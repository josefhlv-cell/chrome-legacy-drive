import { useEffect } from "react";

/**
 * Dočasný stub po omylném přepsání souboru při úpravě pozadí.
 * Propis showroom pozadí do snímků je hotový v stillCapture.ts + thumbnail.ts.
 * Obnovte tento soubor:
 *   git checkout 67e3c2e981fd8b505df8880e054cce3abe40745d -- src/pages/SmartCapture.tsx
 *   git commit -m "Obnovení SmartCapture.tsx"
 *   git push
 */
export default function SmartCapture() {
  useEffect(() => {
    console.warn(
      "[SmartCapture] Obnovte src/pages/SmartCapture.tsx z commitu 67e3c2e981fd8b505df8880e054cce3abe40745d",
    );
  }, []);
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      <h1 className="text-xl font-semibold">Smart Capture — obnova souboru</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Stránka byla při úpravě pozadí omylem zkrácena. Propis showroom pozadí do fotek
        je už v <code>stillCapture.ts</code>. Obnovte prosím{" "}
        <code>src/pages/SmartCapture.tsx</code> z commitu <code>67e3c2e</code>.
      </p>
      <pre className="max-w-full overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs">
{`git checkout 67e3c2e981fd8b505df8880e054cce3abe40745d -- src/pages/SmartCapture.tsx
git commit -m "Obnovení SmartCapture.tsx"
git push`}
      </pre>
    </div>
  );
}

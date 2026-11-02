@@
-          {showBackground && stream && !pending && (
+          {showBackground && !pending && (
             <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-label="Průhledná showroom vodicí vrstva">
               <img src={bgSrc} alt="" className="h-full w-full object-contain" style={{ opacity: 0.32 }}
+                loading="eager"
+                decoding="async"
                 onError={() => { if (bgSrc !== SHOWROOM_BG) setBgSrc(SHOWROOM_BG); }} />
               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white">
                 Showroom vodítko · zarovnejte vozidlo
               </div>
             </div>
           )}
@@
             <img
               src={bgSrc}
               alt="Pozadí showroomu"
               className="w-full rounded-lg object-cover max-h-52"
+              loading="eager"
+              decoding="async"
               onError={() => { if (bgSrc !== SHOWROOM_BG) setBgSrc(SHOWROOM_BG); }}
             />
@@
                 <>
-                  <img src={bgSrc} alt="Pozadí showroomu" className="w-full aspect-video object-cover rounded-xl ring-1 ring-white/15" onError={() => { if (bgSrc !== SHOWROOM_BG) setBgSrc(SHOWROOM_BG); }} />
+                  <img src={bgSrc} alt="Pozadí showroomu" className="w-full aspect-video object-cover rounded-xl ring-1 ring-white/15" loading="eager" decoding="async" onError={() => { if (bgSrc !== SHOWROOM_BG) setBgSrc(SHOWROOM_BG); }} />
                   <p className="text-[11px] text-white/50 mt-2">AI showroom se vytvoří po vyfocení. Původní živý obraz kamery zůstává beze změny.</p>
                 </>

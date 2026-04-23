// QA pro PrintFlyerDialog: vykreslí klon letáku v Chromiu @ 1123×794 px,
// vyexportuje PNG, vloží jako jediný obraz do PDF (A4 landscape),
// a uloží PDF + screenshoty pro vizuální kontrolu.

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/flyer-qa';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Přesné CSS z projektu (zkopírováno z src/index.css, zjednodušeno o nepoužité bloky)
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap');
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ddd; font-family: 'Montserrat', system-ui, sans-serif; }

.flyer-a4 {
  width: 297mm; height: 210mm;
  min-width: 297mm; min-height: 210mm;
  max-width: 297mm; max-height: 210mm;
  padding: 7mm 8mm;
  box-sizing: border-box;
  font-family: 'Montserrat', system-ui, sans-serif;
  color: #000; background: #fff;
  position: relative; overflow: hidden;
  display: grid;
  grid-template-rows: 26mm 56mm 1fr 28mm;
  gap: 3mm;
}
.flyer-row { display: grid; gap: 4mm; min-width: 0; }
.flyer-row-top     { grid-template-columns: 30mm minmax(0, 1fr) 56mm; align-items: stretch; }
.flyer-row-mid     { grid-template-columns: 100mm minmax(0, 1fr) 56mm; align-items: stretch; }
.flyer-row-content { grid-template-columns: minmax(0, 1fr) 60mm; align-items: stretch; min-height: 0; }
.flyer-row-price   { grid-template-columns: 1fr; }
.flyer-stack { display: grid; grid-template-rows: 1fr 1fr; gap: 3mm; min-width: 0; }
.flyer-box {
  border: 0.6mm solid #000; border-radius: 4mm;
  padding: 3mm 4mm; background: #fff;
  display: flex; flex-direction: column; justify-content: center;
  min-width: 0; overflow: hidden;
}
.flyer-box-title { justify-content: center; }
.flyer-title {
  font-weight: 800; font-size: 22pt; line-height: 1.05; margin: 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.flyer-box-stat .fb-label { font-size: 10.5pt; font-weight: 600; margin-bottom: 1mm; }
.flyer-box-stat .fb-value { font-size: 22pt; font-weight: 800; line-height: 1; }
.flyer-box-stat .fb-value-md { font-size: 14pt; font-weight: 800; line-height: 1.1; }
.flyer-box-stat .fb-label-inline { margin-top: 1mm; font-size: 10pt; font-weight: 600; }
.flyer-box-info { text-align: center; align-items: center; font-size: 11pt; font-weight: 600; line-height: 1.4; }
.flyer-shield { display: flex; align-items: center; justify-content: center; }
.flyer-shield > div {
  width: 28mm; height: 28mm; border: 0.6mm solid #000; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 7pt; font-weight: 800; text-align: center; padding: 2mm;
}
.flyer-hero {
  width: 100%; height: 100%; background: #fff; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  border: 0.6mm solid #000; border-radius: 4mm;
}
.flyer-hero > div {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #888, #444);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: 18pt;
}
.flyer-box-content { padding: 4mm 5mm; gap: 3mm; justify-content: flex-start; }
.fb-section { min-width: 0; }
.fb-section + .fb-section { margin-top: 3mm; }
.fb-section-title { font-size: 14pt; font-weight: 800; margin-bottom: 1.5mm; }
.fb-section-text {
  font-size: 12pt; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 9; -webkit-box-orient: vertical; overflow: hidden;
}
.fb-section-popis .fb-section-text { -webkit-line-clamp: 5; }
.flyer-box-qr { align-items: center; justify-content: center; padding: 3mm; }
.flyer-box-qr > div {
  width: 52mm; height: 52mm;
  background: repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 6mm 6mm;
  border: 1mm solid #000;
}
.flyer-box-price { flex-direction: row; align-items: center; justify-content: space-between; padding: 4mm 7mm; gap: 4mm; }
.fb-price-left { display: flex; flex-direction: column; gap: 0.5mm; min-width: 0; }
.fb-price-title { font-size: 18pt; font-weight: 800; line-height: 1; }
.fb-price-sub { font-size: 11pt; font-weight: 600; }
.fb-price-finance { font-size: 10pt; font-weight: 500; margin-top: 1mm; }
.fb-price-right { font-size: 36pt; font-weight: 900; letter-spacing: -0.01em; white-space: nowrap; }
`;

const HTML = `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"/><style>${CSS}</style></head>
<body>
  <div id="flyer" class="flyer-a4" style="margin:20px;box-shadow:0 4px 30px rgba(0,0,0,.2)">
    <div class="flyer-row flyer-row-top">
      <div class="flyer-shield"><div>CHRYSLER<br>DODGE<br>PARDUBICE</div></div>
      <div class="flyer-box flyer-box-title">
        <h1 class="flyer-title">CHRYSLER PACIFICA 3,6 PENTASTAR S RADAR 360 2019</h1>
      </div>
      <div class="flyer-box flyer-box-stat">
        <div class="fb-label">Rok výroby:</div>
        <div class="fb-value">2019</div>
      </div>
    </div>
    <div class="flyer-row flyer-row-mid">
      <div class="flyer-hero"><div>FOTO VOZIDLA</div></div>
      <div class="flyer-stack">
        <div class="flyer-box flyer-box-stat">
          <div class="fb-label">Stav tachometru:</div>
          <div class="fb-value">94 789 km</div>
        </div>
        <div class="flyer-box flyer-box-stat">
          <div class="fb-label">Motor:</div>
          <div class="fb-value-md">3604 ccm / 212 kW</div>
          <div class="fb-label-inline">palivo: <span>Benzín</span></div>
        </div>
      </div>
      <div class="flyer-stack">
        <div class="flyer-box flyer-box-stat">
          <div class="fb-label">Platnost STK do:</div>
          <div class="fb-value">12/2027</div>
        </div>
        <div class="flyer-box flyer-box-info">
          <div>servisní knížka</div><div>1. majitel</div>
          <div>koupeno v: ČR</div><div>stav: perfektní</div>
        </div>
      </div>
    </div>
    <div class="flyer-row flyer-row-content">
      <div class="flyer-box flyer-box-content">
        <div class="fb-section">
          <div class="fb-section-title">Výbava:</div>
          <div class="fb-section-text">Adaptivní tempomat, Kožená sedadla vyhřívaná, LED světlomety, Parkovací kamera 360°, Bezklíčové startování, Apple CarPlay / Android Auto, Třízónová klimatizace, 8× airbag, Hlídání mrtvého úhlu, Asistent rozjezdu do kopce</div>
        </div>
        <div class="fb-section fb-section-popis">
          <div class="fb-section-title">Popis:</div>
          <div class="fb-section-text">7 míst, nájezd 94.789 KM, moderní rodinné MPV s benzínovým motorem a 9stupňovou automatickou převodovkou. Vůz nabízí vysoký komfort i bezpečnost díky bohaté výbavě. Nabízíme pohodlné a velmi prostorné rodinné či firemní vozidlo dovezené z USA, připravené k provozu v ČR.</div>
        </div>
      </div>
      <div class="flyer-box flyer-box-qr"><div></div></div>
    </div>
    <div class="flyer-row flyer-row-price">
      <div class="flyer-box flyer-box-price">
        <div class="fb-price-left">
          <div class="fb-price-title">Cena</div>
          <div class="fb-price-sub">s DPH:</div>
          <div class="fb-price-finance">Možnosti financování: leasing, spotřebitelský úvěr</div>
        </div>
        <div class="fb-price-right">700 590 Kč</div>
      </div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: '/bin/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.setContent(HTML, { waitUntil: 'networkidle' });
await page.waitForTimeout(500); // fonts settle

// Změř, zda mm × 96/25.4 dává očekávaných ~1123 × 794 px
const dims = await page.$eval('#flyer', (el) => {
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
console.log('Naměřené px rozměry .flyer-a4:', dims, '(očekáváno ~1123 × 794)');

// 1) Snímek HTML letáku jak ho vidíme v adminu
await page.locator('#flyer').screenshot({ path: path.join(OUT_DIR, '01-html-preview.png') });

// 2) Generování PDF přes Chromium (totéž co window.print s @page A4 landscape)
//    abychom otestovali vlastní tiskovou cestu
const pdfBuffer = await page.pdf({
  format: 'A4',
  landscape: true,
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  preferCSSPageSize: true,
  pageRanges: '1',
});
fs.writeFileSync(path.join(OUT_DIR, '02-direct-print.pdf'), pdfBuffer);

// 3) Simulace našeho exportu: html2canvas-like → JPEG → jsPDF
//    Tady místo html2canvas vyrobíme přímo screenshot v 200 DPI ekvivalentu
//    a uložíme jako .jpg, pak vytvoříme PDF přes pypdf.
const exportPng = await page.locator('#flyer').screenshot({
  path: path.join(OUT_DIR, '03-export-bitmap.png'),
  scale: 'device', // device-pixel
  omitBackground: false,
});

await browser.close();
console.log('QA assets ready in', OUT_DIR);

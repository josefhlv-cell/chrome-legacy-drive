import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT = '/tmp/flyer-qa';

const CSS = fs.readFileSync('/tmp/flyer-qa-css.css', 'utf-8');

const makeHtml = (opts) => `<!doctype html><html><head><meta charset="utf-8"/><style>${CSS}</style></head>
<body><div id="flyer" class="flyer-a4 ${opts.noPhoto ? 'no-photo' : ''}" style="--flyer-text-scale:${opts.scale}">
  <div class="flyer-row flyer-row-top">
    <div class="flyer-shield"><div>CDP</div></div>
    <div class="flyer-box flyer-box-title"><h1 class="flyer-title">${opts.title}</h1></div>
    <div class="flyer-box flyer-box-stat"><div class="fb-label">Rok výroby:</div><div class="fb-value">2019</div></div>
  </div>
  <div class="flyer-row flyer-row-mid">
    ${opts.noPhoto ? '' : '<div class="flyer-hero"><div>FOTO</div></div>'}
    <div class="flyer-stack">
      <div class="flyer-box flyer-box-stat"><div class="fb-label">Stav tachometru:</div><div class="fb-value">94 789 km</div></div>
      <div class="flyer-box flyer-box-stat"><div class="fb-label">Motor:</div><div class="fb-value-md">3604 ccm / 212 kW</div><div class="fb-label-inline">palivo: <span>Benzín</span></div></div>
    </div>
    <div class="flyer-stack">
      <div class="flyer-box flyer-box-stat"><div class="fb-label">Platnost STK do:</div><div class="fb-value">12/2027</div></div>
      <div class="flyer-box flyer-box-info"><div>servisní knížka</div><div>1. majitel</div><div>koupeno v: ČR</div><div>stav: perfektní</div></div>
    </div>
  </div>
  <div class="flyer-row flyer-row-content">
    <div class="flyer-box flyer-box-content">
      <div class="fb-section"><div class="fb-section-title">Výbava:</div><div class="fb-section-text">${opts.vybava}</div></div>
      <div class="fb-section fb-section-popis"><div class="fb-section-title">Popis:</div><div class="fb-section-text">${opts.popis}</div></div>
    </div>
    <div class="flyer-box flyer-box-qr"><div></div></div>
  </div>
  <div class="flyer-row flyer-row-price">
    <div class="flyer-box flyer-box-price">
      <div class="fb-price-left"><div class="fb-price-title">Cena</div><div class="fb-price-sub">s DPH:</div><div class="fb-price-finance">Možnosti financování: leasing, spotřebitelský úvěr</div></div>
      <div class="fb-price-right">${opts.price}</div>
    </div>
  </div>
</div></body></html>`;

const SCENARIOS = [
  { name: 'normal', title: 'CHRYSLER PACIFICA 3,6 PENTASTAR S RADAR 360 2019', scale: 1, noPhoto: false,
    vybava: 'Adaptivní tempomat, Kožená sedadla, LED, Parkovací kamera, Bezklíčové startování, Apple CarPlay, Třízónová klima, 8× airbag',
    popis: 'Moderní rodinné MPV s benzínovým motorem. Vysoký komfort i bezpečnost.',
    price: '700 590 Kč' },
  { name: 'big-text', title: 'CHRYSLER PACIFICA 3,6 PENTASTAR S RADAR 360 2019', scale: 1.5, noPhoto: false,
    vybava: 'Adaptivní tempomat, Kožená sedadla vyhřívaná, LED světlomety, Parkovací kamera 360°',
    popis: 'Moderní rodinné MPV s benzínovým motorem.',
    price: '700 590 Kč' },
  { name: 'no-photo-long', title: 'DODGE CHALLENGER 3,6 GT PLUS AWD 2019 SPORTOVNÍ KUPÉ', scale: 1, noPhoto: true,
    vybava: 'Adaptivní tempomat, Kožená sedadla vyhřívaná elektricky nastavitelná, Sportovní podvozek, LED světlomety, Xenony, Parkovací kamera, Bezklíčové startování, Apple CarPlay, Android Auto, Třízónová klima, 8× airbag, Hlídání mrtvého úhlu, BlindSpot, Asistent rozjezdu do kopce, Tempomat',
    popis: '5 míst, nájezd 75.563 KM, sportovní kupé s pohonem 4x4, benzínovým motorem a 8stupňovou automatickou převodovkou. Vůz nabízí skvělou dynamiku a jistotu na silnici. Komfort zajišťuje dvouzónová klimatizace, digitální štít, dotykové ovládání, Apple CarPlay.',
    price: '724 790 Kč' },
  { name: 'long-title', title: 'CHRYSLER TOWN COUNTRY 3,6 PENTASTAR 2x DVD LIMITED PLATINUM EDITION 2013 ÚPLNĚ DLOUHÝ NÁZEV', scale: 1, noPhoto: false,
    vybava: 'Kožená sedadla, DVD',
    popis: 'Krátký popis.',
    price: '320 000 Kč' },
];

const browser = await chromium.launch({ executablePath: '/bin/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();

const issues = [];

for (const s of SCENARIOS) {
  await page.setContent(makeHtml(s), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const dims = await page.$eval('#flyer', (el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, sw: el.scrollWidth, sh: el.scrollHeight };
  });
  const overflow = dims.sw > dims.w + 1 || dims.sh > dims.h + 1;
  console.log(`[${s.name}] box=${dims.w.toFixed(1)}×${dims.h.toFixed(1)}px scroll=${dims.sw}×${dims.sh}px overflow=${overflow}`);
  if (overflow) issues.push(`${s.name}: layout overflow ${dims.sw}×${dims.sh} > ${dims.w.toFixed(0)}×${dims.h.toFixed(0)}`);

  const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true,
    margin: { top:'0', right:'0', bottom:'0', left:'0' }, preferCSSPageSize: true, pageRanges: '1' });
  fs.writeFileSync(path.join(OUT, `scenario-${s.name}.pdf`), pdf);
  await page.locator('#flyer').screenshot({ path: path.join(OUT, `scenario-${s.name}.png`) });
}

await browser.close();
console.log('\nIssues:', issues.length === 0 ? 'NONE — všechny scénáře sedí v rámu A4 landscape' : issues);

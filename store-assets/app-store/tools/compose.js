// node compose.js <rawDir> <lang> <outDir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [RAW, lang, OUT] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const CAP = {
  en: { '1-home': 'Guess what your <b>friends</b> picked', '2-word': 'Pick your <b>secret word</b>', '3-questions': 'Ask sharp <b>yes/no</b> questions',
        '4-notebook': 'Every clue in your <b>notebook</b>', '5-lobby': 'Practice anytime against <b>bots</b>', '6-shop': 'Unlock <b>banners</b> &amp; emblems' },
  nl: { '1-home': 'Raad wat je <b>vrienden</b> kozen', '2-word': 'Kies je <b>geheime woord</b>', '3-questions': 'Stel slimme <b>ja/nee</b>-vragen',
        '4-notebook': 'Elke aanwijzing in je <b>notitieboek</b>', '5-lobby': 'Oefen altijd tegen <b>bots</b>', '6-shop': 'Ontgrendel <b>banners</b> en emblemen' },
}[lang];
// Apple's exact pixel sizes per device set
const DEV = { iphone: [1320, 2868], ipad: [2064, 2752], duoOuter: [1398, 2034], duoInner: [2853, 2007] };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const f of fs.readdirSync(RAW).filter(f => f.endsWith('.png')).sort()) {
    const [dev, ...rest] = f.replace('.png', '').split('-'); const key = rest.join('-');
    const [W, H] = DEV[dev]; const land = W > H;
    const capH = Math.round(H * (land ? 0.17 : 0.155));
    const font = Math.round(land ? H * 0.062 : W * (dev === 'ipad' ? 0.052 : 0.074));
    const shotH = Math.round(H - capH - H * (land ? 0.045 : 0.035));
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
      body{background:#07040f;position:relative;font-family:'Inter Display','Inter',sans-serif}
      .glow1{position:absolute;inset:0;background:radial-gradient(ellipse 85% 38% at 50% 0%,rgba(140,90,220,.45),transparent 70%)}
      .glow2{position:absolute;inset:0;background:radial-gradient(ellipse 100% 45% at 50% 100%,rgba(70,32,140,.35),transparent 65%)}
      .cap{position:absolute;left:6%;right:6%;top:0;height:${capH}px;display:flex;align-items:center;justify-content:center;text-align:center;
        color:#fff;font-weight:800;font-size:${font}px;line-height:1.08;letter-spacing:-0.02em;text-shadow:0 ${font * 0.06}px ${font * 0.25}px rgba(0,0,0,.6)}
      .cap b{font-weight:900;background:linear-gradient(180deg,#fff1b8 0%,#ffcb45 45%,#e08e05 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
      .shot{position:absolute;left:50%;top:${capH}px;height:${shotH}px;transform:translateX(-50%);
        border-radius:${Math.round(shotH * (land ? 0.035 : 0.045))}px;box-shadow:0 0 0 ${Math.max(3, Math.round(W * 0.003))}px rgba(167,139,250,.35),0 ${H * 0.02}px ${H * 0.05}px rgba(0,0,0,.7)}
    </style></head><body><div class="glow1"></div><div class="glow2"></div>
      <div class="cap"><span>${CAP[key]}</span></div>
      <img class="shot" src="file://${path.resolve(RAW, f)}"></body></html>`;
    const tmp = path.resolve(OUT, '.tmp.html'); fs.writeFileSync(tmp, html);
    await p.setViewportSize({ width: W, height: H }); await p.goto('file://' + tmp); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, `${dev}-${key}.png`) });
  }
  fs.rmSync(path.resolve(OUT, '.tmp.html'), { force: true });
  await b.close();
})();

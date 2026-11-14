// node capture.js <lang en|nl> <kind iphone|ipad> <outDir>
const { chromium } = require('playwright');
const fs = require('fs');
const [lang, kind, OUT] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5179';
const UA = kind === 'ipad'
  ? 'Mozilla/5.0 (iPad; CPU OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
// logical size × dsf = Apple's exact pixel size
const SIZES = kind === 'ipad'
  ? { ipad: [1032, 1376, { top: 24, bottom: 20, left: 0, right: 0 }] }
  : { iphone: [440, 956, { top: 62, bottom: 34, left: 0, right: 0 }],
      duoOuter: [466, 678, { top: 0, bottom: 20, left: 0, right: 80 }],
      duoInner: [951, 669, { top: 0, bottom: 20, left: 0, right: 80 }] };
const DSF = kind === 'ipad' ? 2 : 3;
const T = lang === 'nl'
  ? { start: 'Spel starten', choose: 'Kies je geheime woord', word: 'Stoel', lock: 'Mijn woord vergrendelen', ready: 'Iedereen klaar', turn: 'Jouw beurt om te vragen!', ask: 'Vraag stellen', answer: 'Beantwoord deze vraag voor JOUW woord', yes: 'Ja', no: 'Nee', asked: /Gevraagd door/g, tabs: ['Vragen', 'Notities'], players: '3 / 12 spelers', close: 'Sluiten', hint: 'Het heeft vier poten', share: 'Delen',
      qs: ['Is het van hout?', 'Staat het in de woonkamer?', 'Kun je erop zitten?', 'Is het elektrisch?'], yesRe: /meubel|zitten|hout|elke dag|verhuiz|woonkamer|set|slaapkamer|keuken/i }
  : { start: 'Start Game', choose: 'Choose Your Secret Word', word: 'Chair', lock: 'Lock In', ready: "ready, Start!", turn: 'Your turn to ask!', ask: 'Ask Question', answer: 'Answer this question for YOUR word', yes: 'Yes', no: 'No', asked: /Asked by/g, tabs: ['Questions', 'Notebook'], players: '3 / 12 players', close: 'Close', hint: 'It has four legs', share: 'Share',
      qs: ['Is it made of wood?', 'Is it found in the living room?', 'Can you sit on it?', 'Is it electronic?'], yesRe: /furniture|sit on|made of wood|every day|moving houses|living room|part of a set|bedroom|kitchen/i };
const POLISH = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
 :root{--font-body:Inter,sans-serif;--font-heading:Inter,sans-serif;--font-display:Inter,sans-serif} body,button,input{font-family:Inter,sans-serif!important}
 .toast-viewport,[role=status]{display:none!important}`;
(async () => {
  const b = await chromium.launch();
  const first = Object.values(SIZES)[0];
  const ctx = await b.newContext({ viewport: { width: first[0], height: first[1] }, userAgent: UA, deviceScaleFactor: DSF, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  await ctx.addInitScript((lang) => {
    window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    localStorage.setItem('mystery_guest_id', 'guest_store01');
    localStorage.setItem('mystery_guest_name', 'Sam');
    localStorage.setItem('app_language', lang);
    localStorage.setItem('wmp_seen_auto_question_hint', '1');
    let s = 7; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  }, lang);
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 100)));
  const setSize = async (name) => { const [w, h, ins] = SIZES[name]; await p.setViewportSize({ width: w, height: h }); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: ins }); await p.waitForTimeout(700); };
  const shotAll = async (label, prepare) => {
    for (const name of Object.keys(SIZES)) {
      await setSize(name); if (prepare) await prepare();
      const tag = await p.addStyleTag({ content: POLISH }); await p.waitForTimeout(500);
      await p.screenshot({ path: `${OUT}/${name}-${label}.png` });
      await tag.evaluate(n => n.remove());
    }
    await setSize(Object.keys(SIZES)[0]);
  };
  const domClick = (l) => p.evaluate((l) => { [...document.querySelectorAll('button')].find(x => x.textContent.includes(l))?.click(); }, l);
  const body = () => p.locator('body').innerText().catch(() => '');

  await setSize(Object.keys(SIZES)[0]);
  await p.goto(BASE + '/'); await p.waitForTimeout(2500); await shotAll('1-home');
  await p.goto(BASE + '/profile?tab=shop'); await p.waitForTimeout(2000); await shotAll('6-shop');
  await p.goto(BASE + '/practice');
  await p.waitForSelector(`text=${T.players}`, { timeout: 20000 }); await p.waitForTimeout(1500);
  await shotAll('5-lobby');
  await domClick(T.start);
  await p.waitForSelector(`text=${T.choose}`, { timeout: 20000 });
  await p.click(`button:has-text("${T.word}")`); await p.waitForTimeout(300);
  await shotAll('2-word');
  await domClick(T.lock);
  await p.waitForSelector(`button:has-text("${T.ready}")`, { timeout: 25000 }); await domClick(T.ready);
  let qi = 0; const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    await p.waitForTimeout(500);
    const txt = await body();
    const asked = (txt.match(T.asked) || []).length;
    if (txt.includes(T.answer)) {
      const q = await p.locator(`div.rounded-2xl:has-text("${T.answer}") p.text-white`).first().innerText().catch(() => '');
      await p.click(`div.rounded-2xl:has-text("${T.answer}") button:has-text("${T.yesRe.test(q) ? T.yes : T.no}")`).catch(() => {});
      continue;
    }
    if (await p.locator('input[maxlength="120"]').count()) { await p.fill('input[maxlength="120"]', T.hint); await domClick(T.share); continue; }
    if (txt.includes(T.close)) { await domClick(T.close); }
    if (txt.includes(T.turn)) {
      if (asked >= 5) break;
      await p.fill('input[maxlength="200"]', T.qs[qi++ % T.qs.length]);
      await p.click(`button:has-text("${T.ask}")`).catch(() => {});
    }
  }
  await p.waitForTimeout(800);
  await shotAll('3-questions', async () => { await p.locator(`button:has-text("${T.tabs[0]}")`).last().click({ force: true }).catch(() => {}); await p.waitForTimeout(400); });
  await shotAll('4-notebook', async () => { await p.locator(`button:has-text("${T.tabs[1]}")`).last().click({ force: true }).catch(() => {}); await p.waitForTimeout(600); });
  console.log(lang, kind, 'done', Math.round((Date.now() - t0) / 1000) + 's of play');
  await b.close();
})();

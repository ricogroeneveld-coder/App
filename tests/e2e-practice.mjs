// End-to-end regression test: plays a FULL practice-vs-bots match through the
// real game screens (lobby → word entry → playing → finished → play again).
// Because practice rooms run against the in-memory backend, this exercises the
// actual LobbyPhase / WordEntryPhase / PlayingPhase / FinishedPhase components
// — the code that has historically regressed — with no Supabase project needed.
//
// Run:  npm run build && npm run test:e2e
//   or: E2E_BASE_URL=http://localhost:5173 node tests/e2e-practice.mjs
//
// Env:
//   E2E_BASE_URL   — use an already-running server instead of spawning preview
//   CHROMIUM_PATH  — explicit Chromium binary (e.g. /opt/pw-browsers/chromium);
//                    otherwise Playwright's managed browser is used
//                    (`npx playwright install chromium` once).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 4199;
const externalBase = process.env.E2E_BASE_URL;
const base = externalBase || `http://localhost:${PORT}`;
let server = null;

async function waitForServer(url, timeoutMs = 20000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { const res = await fetch(url); if (res.ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`server at ${url} did not come up`);
}

async function main() {
  if (!externalBase) {
    if (!existsSync(new URL('../dist/index.html', import.meta.url))) {
      throw new Error('dist/ not found — run `npm run build` first (dummy Supabase env vars are fine).');
    }
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      stdio: 'ignore', detached: false,
    });
    await waitForServer(base);
  }

  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR:', e.message); });

  await page.addInitScript(() => {
    localStorage.setItem('mystery_guest_id', 'guest_e2etest1');
    localStorage.setItem('mystery_guest_name', 'Tester');
    localStorage.setItem('app_language', 'en'); // pin EN so the text selectors match
    localStorage.setItem('wmp_seen_auto_question_hint', '1');
  });

  // Honest answers for the word "Chair" (mirrors the bot matrix's yes/some cells).
  const CHAIR_YES = /furniture|sit on|made of wood|every day|moving houses|living room|part of a set|bedroom|kitchen/i;
  // Buttons with perpetual shimmer animations never satisfy Playwright's
  // stability check — click gold CTAs through the DOM instead.
  const domClick = (label) => page.evaluate(
    (l) => { [...document.querySelectorAll('button')].find(b => b.textContent.includes(l))?.click(); }, label);

  console.log('1. Home → Create Game → Practice vs Bot');
  await page.goto(base + '/');
  await page.waitForSelector('text=Create Game', { timeout: 15000 });
  await page.click('text=Create Game', { force: true });
  await page.waitForSelector('text=Practice vs Bot', { timeout: 5000 });
  await page.click('text=Practice vs Bot');

  console.log('2. Lobby: two bots join, category preset, nobody "away"');
  await page.waitForSelector('text=Start Game', { timeout: 15000 });
  if (!/\/mystery\/BOT/.test(page.url())) throw new Error(`unexpected url ${page.url()}`);
  await page.waitForSelector('text=3 / 12 players', { timeout: 15000 });
  const lobbyText = await page.locator('body').innerText();
  if (!/Household/.test(lobbyText)) throw new Error('category not preset to Household');
  if (!/Change Category/.test(lobbyText)) throw new Error('category picker missing in bot lobby');
  if (!/\(BOT\)/.test(lobbyText)) throw new Error('bot players not visible');

  console.log('3. Start (3-2-1 countdown) → word entry');
  await domClick('Start Game');
  await page.waitForSelector('text=Choose Your Secret Word', { timeout: 15000 });

  console.log('4. Word entry: lock in Chair, bots follow, start');
  await page.click('button:has-text("Chair")');
  await domClick('Lock In');
  await page.waitForSelector('button:has-text("ready — Start!")', { timeout: 20000 });
  await domClick('ready — Start!');

  console.log('5. Playing: ask the first question');
  await page.waitForSelector('text=Your turn to ask!', { timeout: 15000 });
  await page.fill('input[maxlength="200"]', 'Is it electronic?');
  await page.click('button:has-text("Ask Question")');

  console.log('6. Play until the game finishes…');
  const start = Date.now();
  let guessed = false, sawBotQuestion = false, finished = false;
  while (Date.now() - start < 420000) {
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText().catch(() => '');
    if (/Play Again \(Same Players\)|Game Over|You Win!/.test(body)) { finished = true; break; }
    if (await page.locator('text=Wrong guess!').count()) {
      await page.click('button:has-text("Close")').catch(() => {});
      continue;
    }
    if (await page.locator('p:has-text("Correct!")').count()) {
      await page.click('button:has-text("Continue")').catch(() => {});
      continue;
    }
    if (/Answer this question for YOUR word/.test(body)) {
      sawBotQuestion = true;
      const qText = await page.locator('div.rounded-2xl:has-text("Answer this question") p.text-white')
        .first().innerText().catch(() => '');
      const yes = CHAIR_YES.test(qText);
      await page.click(`div.rounded-2xl:has-text("Answer this question") button:has-text("${yes ? 'Yes' : 'No'}")`)
        .catch(() => {});
      continue;
    }
    if (/Hint Round/i.test(body) && await page.locator('input[maxlength="120"]').count()) {
      await page.fill('input[maxlength="120"]', 'It has four legs');
      await page.click('button:has-text("Share")', { force: true }).catch(() => {});
      continue;
    }
    if (/Your turn to ask!/.test(body)) {
      const guessBtn = page.locator('button:has-text("Make a Guess")');
      if (!guessed && await guessBtn.count() && await guessBtn.isEnabled()) {
        guessed = true;
        await guessBtn.click();
        await page.waitForSelector('text=Who do you want to guess?', { timeout: 5000 });
        await page.locator('button.glass-tile').first().click();
        await page.waitForSelector('input[placeholder*="Search or type" i]', { timeout: 5000 });
        await page.locator('div.grid button:has-text("Broom")').first().click();
        await page.click('button:has-text("Submit Guess")');
        await page.waitForSelector('text=Wrong guess!, text=Correct!', { timeout: 8000 }).catch(() => {});
        continue;
      }
      await page.click('button:has-text("Auto")', { force: true }).catch(() => {});
    }
  }
  if (!finished) throw new Error('game did not finish within the time budget');
  if (!sawBotQuestion) throw new Error('bots never asked a question');
  if (!guessed) throw new Error('guess flow never became available');

  console.log('7. Results: practice pays no rewards');
  const endBody = await page.locator('body').innerText();
  if (/\+\d+ XP/.test(endBody)) throw new Error('reward summary rendered on a practice match');

  console.log('8. Play Again → lobby with category still set');
  await domClick('Play Again');
  await page.waitForSelector('text=Start Game', { timeout: 10000 });
  if (!/Household/.test(await page.locator('body').innerText())) {
    throw new Error('category lost after Play Again');
  }

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('E2E PRACTICE MATCH PASSED');
  await browser.close();
}

main().then(
  () => { server?.kill(); process.exit(0); },
  (err) => { console.error(err); server?.kill(); process.exit(1); },
);

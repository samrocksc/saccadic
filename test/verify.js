#!/usr/bin/env node
/**
 * Saccadic verification suite.
 *
 * Drives the real app in a real browser and asserts the behaviour the project
 * brief promises: ORP correctness, the focal indicator, keyboard shortcuts,
 * theming, live transcription, mobile layout, and accessibility.
 *
 * Run:
 *   npm i -D playwright && npx playwright install chromium
 *   node test/verify.js
 *
 * Optional: CHROMIUM_PATH=/usr/bin/chromium node test/verify.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8123);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

const q = `document.querySelector('saccadic-app').shadowRoot`;

(async () => {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('playwright is not installed.\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }

  const server = await serve();
  const base = `http://localhost:${PORT}/index.html`;
  const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launchOpts);

  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass, detail });

  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|google-analytics|googletagmanager|ERR_ABORTED/i.test(m.text())) errs.push(m.text());
  });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // ---- boot ----
  check('app defined + shadow root', await page.evaluate(() =>
    !!customElements.get('saccadic-app') && !!document.querySelector('saccadic-app').shadowRoot));

  // ---- display furniture ----
  const furniture = await page.evaluate(async (qs) => {
    const d = eval(qs).querySelector('orp-display');
    d.word = 'reading'; d.total = 10; await d.updateComplete;
    const s = d.shadowRoot;
    return { top: !!s.querySelector('.focal-tick.top'), bottom: !!s.querySelector('.focal-tick.bottom'),
             lineTop: !!s.querySelector('.line-top'), lineBottom: !!s.querySelector('.line-bottom') };
  }, q);
  check('vertical focal indicator rendered', furniture.top && furniture.bottom, JSON.stringify(furniture));
  check('horizontal guide lines above + below', furniture.lineTop && furniture.lineBottom);

  // ---- ORP correctness ----
  const orp = await page.evaluate(async (qs) => {
    const d = eval(qs).querySelector('orp-display'); const out = {};
    for (const w of ['a', 'the', 'reading', '"Hello', 'comprehension']) {
      d.word = w; await d.updateComplete;
      const ls = [...d.shadowRoot.querySelectorAll('.letter')];
      const i = ls.findIndex(l => l.classList.contains('orp'));
      out[w] = { idx: i, letter: ls[i]?.textContent, count: ls.filter(l => l.classList.contains('orp')).length };
    }
    return out;
  }, q);
  check('ORP "reading" -> a', orp['reading'].idx === 2 && orp['reading'].letter === 'a', JSON.stringify(orp['reading']));
  check('ORP "the" -> h', orp['the'].letter === 'h', JSON.stringify(orp['the']));
  // Regression: the index must address the raw string, not a punctuation-stripped copy.
  check('ORP with leading punctuation stays on the right letter',
    orp['"Hello'].idx === 2 && orp['"Hello'].letter === 'e', JSON.stringify(orp['"Hello']));
  check('exactly one letter highlighted', Object.values(orp).every(c => c.count === 1));

  // ---- the focal point must not move ----
  const pin = await page.evaluate(async (qs) => {
    const d = eval(qs).querySelector('orp-display'); const xs = [];
    for (const w of ['I', 'the', 'reading', 'comprehension', 'extraordinarily']) {
      d.word = w; await d.updateComplete;
      const l = d.shadowRoot.querySelector('.letter.orp').getBoundingClientRect();
      const t = d.shadowRoot.querySelector('.focal-tick.top').getBoundingClientRect();
      xs.push({ letter: l.left + l.width / 2, tick: t.left + t.width / 2 });
    }
    return { drift: Math.max(...xs.map(v => Math.abs(v.letter - v.tick))),
             spread: Math.max(...xs.map(v => v.letter)) - Math.min(...xs.map(v => v.letter)) };
  }, q);
  check('focal letter sits under the indicator', pin.drift <= 2, `drift ${pin.drift.toFixed(1)}px`);
  check('focal point stable across word lengths', pin.spread <= 2, `spread ${pin.spread.toFixed(1)}px`);

  // ---- shortcuts must not fire while typing (shadow-DOM retargeting) ----
  const before = await page.evaluate(qs => eval(qs).querySelector('saccadic-controls').wpm, q);
  const ta = await page.evaluateHandle(qs =>
    eval(qs).querySelector('saccadic-controls').shadowRoot.querySelector('textarea'), q);
  await ta.asElement().click();
  await page.keyboard.type('zebra x ray zap');
  await page.waitForTimeout(200);
  const typed = await page.evaluate(({ t, qs }) => ({
    value: t.value,
    wpm: eval(qs).querySelector('saccadic-controls').wpm,
    playing: eval(qs).host._playing,
  }), { t: ta, qs: q });
  check('textarea keeps typed text including spaces', typed.value === 'zebra x ray zap', JSON.stringify(typed.value));
  check('typing z/x does not change speed', typed.wpm === before, `${before} -> ${typed.wpm}`);
  check('typing space does not start playback', typed.playing === false);

  // ---- shortcuts outside a field must drive the whole UI ----
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('z'); await page.keyboard.press('z'); await page.waitForTimeout(200);
  const up = await page.evaluate(qs => {
    const r = eval(qs), c = r.querySelector('saccadic-controls');
    return { app: r.host._wpm, ctrl: c.wpm, reader: r.host._reader.wpm,
             slider: c.shadowRoot.querySelector('input[type=range]').value,
             readout: c.shadowRoot.querySelector('.wpm-value').textContent.trim() };
  }, q);
  check('z raises speed by 2 steps', up.reader === 200, JSON.stringify(up));
  check('z syncs engine, state, slider and readout',
    up.app === 200 && up.ctrl === 200 && up.slider === '200' && up.readout === '200', JSON.stringify(up));
  await page.keyboard.press('x'); await page.waitForTimeout(150);
  check('x lowers speed one step', await page.evaluate(qs => eval(qs).host._wpm, q) === 175);

  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  const playing = await page.evaluate(qs => {
    const r = eval(qs);
    return r.host._playing && r.host._reader.playing && r.querySelector('saccadic-controls').playing;
  }, q);
  check('Space starts playback and the UI follows', playing);
  await page.keyboard.press('Space'); await page.waitForTimeout(250);
  const pausedOk = await page.evaluate(qs => {
    const r = eval(qs);
    return !r.host._playing && !r.host._reader.playing && !r.querySelector('saccadic-controls').playing;
  }, q);
  check('Space pauses and the UI follows', pausedOk);

  const bounds = await page.evaluate(qs => {
    const rd = eval(qs).host._reader;
    rd.setWpm(9999); const hi = rd.wpm; rd.setWpm(-5); const lo = rd.wpm; rd.setWpm(150);
    return { hi, lo };
  }, q);
  check('WPM clamps to 150..500', bounds.hi === 500 && bounds.lo === 150, JSON.stringify(bounds));

  // ---- themes, driven by real clicks ----
  const clickTheme = async (label) => {
    await page.evaluate(a => [...eval(a.qs).querySelector('saccadic-controls').shadowRoot
      .querySelectorAll('.theme-btn')].find(b => b.textContent.trim() === a.label)?.click(), { qs: q, label });
    await page.waitForTimeout(220);
  };
  await clickTheme('Dark');
  const dark = await page.evaluate(qs => ({
    attr: document.documentElement.getAttribute('data-theme'),
    active: eval(qs).querySelector('saccadic-controls').shadowRoot.querySelector('.theme-btn.active')?.textContent.trim(),
    swatch: eval(qs).querySelector('saccadic-controls').shadowRoot.querySelector('input[type=color]')?.value,
    bg: getComputedStyle(document.documentElement).getPropertyValue('--sacc-bg').trim(),
  }), q);
  check('Dark theme applies and syncs', dark.attr === 'dark' && dark.bg === '#0d1117' && dark.active === 'Dark', JSON.stringify(dark));
  check('highlight swatch follows the theme accent', dark.swatch === '#ff4444', dark.swatch);

  await clickTheme('Light');
  check('Light theme applies', await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme')) === 'light');

  await clickTheme('System');
  await page.emulateMedia({ colorScheme: 'dark' });  await page.waitForTimeout(180);
  const sysDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(180);
  const sysLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('System theme tracks the OS preference live',
    sysDark === 'dark' && sysLight === 'light', `${sysDark} -> ${sysLight}`);

  await clickTheme('Deuteranopia');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  check('theme choice persists across reload',
    await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'deuteranopia');

  check('theme registry is extensible', await page.evaluate(async () => {
    const m = await import('/src/themes/themes.js');
    m.registerTheme({ id: 'solarized', name: 'Solarized', '--sacc-bg': '#002b36' });
    m.themeManager.apply('solarized');
    const ok = getComputedStyle(document.documentElement).getPropertyValue('--sacc-bg').trim() === '#002b36';
    m.themeManager.apply('cowabunga');
    return ok;
  }));

  // ---- first run must follow the OS preference (fresh profile, no storage) ----
  const freshCheck = async (scheme) => {
    const c = await browser.newContext({ viewport: { width: 900, height: 700 }, colorScheme: scheme });
    const p = await c.newPage();
    await p.goto(base, { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    const out = await p.evaluate(() => ({
      choice: document.documentElement.getAttribute('data-theme-choice'),
      resolved: document.documentElement.getAttribute('data-theme'),
    }));
    await c.close();
    return out;
  };
  const fDark = await freshCheck('dark');
  const fLight = await freshCheck('light');
  check('first run follows the OS preference',
    fDark.choice === 'system' && fDark.resolved === 'dark' && fLight.resolved === 'light',
    `dark->${fDark.resolved} light->${fLight.resolved}`);

  // ---- live transcription must not rewind the reader ----
  const append = await page.evaluate(qs => {
    const rd = eval(qs).host._reader;
    rd.loadText('alpha bravo charlie delta echo'); rd.seek(3);
    const total = rd.appendText('foxtrot golf');
    return { idx: rd.currentIndex, word: rd.currentWord, total };
  }, q);
  check('appended transcription grows the list', append.total === 7, JSON.stringify(append));
  check('appended transcription keeps reading position',
    append.idx === 3 && append.word === 'delta', JSON.stringify(append));

  const live = await page.evaluate(async qs => {
    const rd = eval(qs).host._reader;
    rd.loadText('one two three four five six seven eight'); rd.setWpm(500); rd.play();
    await new Promise(r => setTimeout(r, 300));
    const midIdx = rd.currentIndex;
    rd.appendText('nine ten');
    await new Promise(r => setTimeout(r, 120));
    const out = { midIdx, idx: rd.currentIndex, playing: rd.playing, total: rd.totalWords };
    rd.pause(); return out;
  }, q);
  check('appending mid-playback does not stop or rewind',
    live.playing && live.idx >= live.midIdx && live.total === 10, JSON.stringify(live));

  // ---- accessibility ----
  const a11y = await page.evaluate(qs => {
    const r = eval(qs), d = r.querySelector('orp-display'), c = r.querySelector('saccadic-controls');
    const btns = [...c.shadowRoot.querySelectorAll('button')];
    const box = d.shadowRoot.querySelector('.orp-container');
    return { role: box?.getAttribute('role'), label: box?.getAttribute('aria-label'),
             live: d.shadowRoot.querySelectorAll('[aria-live]').length,
             lang: document.documentElement.lang,
             unlabelled: btns.filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
             slider: !!c.shadowRoot.querySelector('input[type=range]')?.getAttribute('aria-label') };
  }, q);
  check('word display exposes role + accessible name', a11y.role === 'img' && !!a11y.label, JSON.stringify(a11y));
  check('a polite live region exists', a11y.live >= 1, String(a11y.live));
  check('document has a lang', a11y.lang === 'en', a11y.lang);
  check('every button is labelled', a11y.unlabelled === 0, String(a11y.unlabelled));
  check('WPM slider is labelled', a11y.slider);

  // ---- mobile, with real touch emulation so pointer:coarse applies ----
  const mctx = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
  const mob = await mctx.newPage();
  await mob.goto(base, { waitUntil: 'networkidle' });
  await mob.waitForTimeout(800);
  const mobile = await mob.evaluate(qs => {
    const small = [];
    const scan = root => root.querySelectorAll('button, [role=button]').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) small.push(`${Math.round(r.height)}px "${b.textContent.trim().slice(0, 12)}"`);
    });
    const sr = eval(qs); scan(sr); sr.querySelectorAll('*').forEach(el => el.shadowRoot && scan(el.shadowRoot));
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
             scrollWidth: document.documentElement.scrollWidth, small };
  }, q);
  check('no horizontal overflow at 375px', !mobile.overflow, `scrollWidth ${mobile.scrollWidth}`);
  check('touch targets are at least 44px', mobile.small.length === 0, mobile.small.join(', '));
  await mctx.close();

  check('no console or page errors', errs.length === 0, errs.join(' | '));

  await browser.close();
  server.close();

  const passed = results.filter(r => r.pass).length;
  console.log('\n' + results.map(r =>
    `${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? '  << ' + r.detail : ''}`).join('\n'));
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();

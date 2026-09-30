// Headless smoke test (adapted from dr-mow/tools/smoke.mjs): desktop, iPad
// landscape + portrait, phone landscape, and an emulated Xbox controller.
// Each profile plays with the real controls, screenshots, and must report
// 0 console errors and 0 page scroll.
// Usage: python3 -m http.server 4180 &  BASE=http://localhost:4180/ CHROMIUM=/opt/pw-browsers/chromium node tools/smoke.mjs
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
const pw = await import('playwright').catch(() => import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')));
const { chromium, devices } = pw;
const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });
const base = process.env.BASE || 'http://localhost:4180/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let failures = 0;
const only = process.env.ONLY;

// A fake Standard-mapping gamepad the page polls through navigator.getGamepads().
const PAD_SHIM = () => {
  const btn = () => ({ pressed: false, touched: false, value: 0 });
  window.__pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn), vibrationActuator: { playEffect: () => Promise.resolve('complete') } };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__press = (i, on) => { window.__pad.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; window.__pad.timestamp++; };
};

async function run(name, ctxOpts, act, { pad = false, query = '?quality=low' } = {}) {
  if (only && only !== name) return;
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  if (pad) await page.addInitScript(PAD_SHIM);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));
  await page.goto(base + query); // headless = software GL: keep the pixel count down
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${name}-title.png` });
  let res = {};
  try { res = (await act(page)) || {}; } catch (e) { errors.push(`test: ${e.message}`); }
  const st = await page.evaluate(() => ({
    mode: GAME.mode, sum: GAME.summary(), fps: +GAME.metrics.fps.toFixed(1),
    scroll: [document.scrollingElement.scrollHeight, innerHeight, document.scrollingElement.scrollWidth, innerWidth],
  }));
  const scrolls = st.scroll[0] > st.scroll[1] || st.scroll[2] > st.scroll[3];
  const bad = errors.length || scrolls || res.fail;
  if (bad) failures++;
  console.log(`${bad ? 'FAIL' : 'PASS'} ${name}`, 'errors:', errors.length ? errors : 'none', scrolls ? 'PAGE SCROLLS' : 'no scroll', JSON.stringify(st.sum), res.note || '');
  await ctx.close();
}

const tapOrClick = (page, tap) => async (sel) => { if (tap) await page.tap(sel); else await page.click(sel); await page.waitForTimeout(250); };

await run('desktop', { viewport: { width: 1280, height: 800 } }, async (page) => {
  const c = tapOrClick(page, false);
  await c('[data-go=campaign]');
  await page.screenshot({ path: `${OUT}/desktop-campaign.png` });
  await c('[data-lv="fallen-hymn"]');
  await page.screenshot({ path: `${OUT}/desktop-brief.png` });
  await c('#bGo');
  await page.waitForFunction(() => GAME.mode === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const a0 = await page.evaluate(() => GAME.w.player.weapons[0].mag);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(700); await page.keyboard.up('KeyJ'); // J = fire without pointer lock
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/desktop-play.png` });
  const s = await page.evaluate(() => ({ z: GAME.w.player.pos.z, mag: GAME.w.player.weapons[0].mag }));
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/desktop-pause.png` });
  const paused = await page.evaluate(() => GAME.mode);
  return { fail: !(s.z < 25.8 && s.mag < a0 && paused === 'paused'), note: `moved to z=${s.z.toFixed(1)}, mag ${a0}→${s.mag}, ${paused}` };
});

await run('ipad-land', { ...devices['iPad Pro 11 landscape'] }, async (page) => {
  const c = tapOrClick(page, true);
  await c('[data-go=tests]');
  await page.screenshot({ path: `${OUT}/ipad-tests.png` });
  await c('[data-lv="proving"]');
  await page.waitForFunction(() => GAME.mode === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({ z: GAME.w.player.pos.z, yaw: GAME.w.player.yaw, mag: GAME.w.player.weapons[0].mag }));
  // left thumb: drag the floating stick up (forward); right thumb: drag to look
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [{ x: 150, y: 600, id: 1 }]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: 150, y: 600 - i * 8, id: 1 }]);
  await touch('touchStart', [{ x: 150, y: 536, id: 1 }, { x: 700, y: 400, id: 2 }]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: 150, y: 536, id: 1 }, { x: 700 + i * 10, y: 400, id: 2 }]);
  await page.waitForTimeout(700);
  await touch('touchEnd', []);
  await page.screenshot({ path: `${OUT}/ipad-play.png` });
  await c('[data-btn=fire]');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ z: GAME.w.player.pos.z, yaw: GAME.w.player.yaw, mag: GAME.w.player.weapons[0].mag }));
  await c('#pausebtn');
  await page.screenshot({ path: `${OUT}/ipad-pause.png` });
  const ok = after.z < before.z - 0.2 && Math.abs(after.yaw - before.yaw) > 0.02 && after.mag < before.mag;
  return { fail: !ok, note: `z ${before.z.toFixed(1)}→${after.z.toFixed(1)}, yaw ${before.yaw.toFixed(2)}→${after.yaw.toFixed(2)}, mag ${before.mag}→${after.mag}` };
});

await run('ipad-portrait', { ...devices['iPad Pro 11'] }, async (page) => {
  const c = tapOrClick(page, true);
  await c('[data-go=tests]');
  await c('[data-lv="plaza"]');
  await page.waitForFunction(() => GAME.mode === 'play', null, { timeout: 30000 });
  await page.evaluate(() => GAME.ff(7)); // software GL runs far below real time
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/ipad-portrait-plaza.png` });
  const wave = await page.evaluate(() => GAME.w.ff.wave);
  return { fail: wave < 1, note: `wave ${wave}` };
});

await run('phone-land', { ...devices['iPhone 13 landscape'] }, async (page) => {
  const c = tapOrClick(page, true);
  await c('[data-go=campaign]');
  await c('[data-lv="cold-storage"]');
  await c('#bGo');
  await page.waitForFunction(() => GAME.mode === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/phone-land-play.png` });
});

await run('xbox-pad', { viewport: { width: 1280, height: 720 } }, async (page) => {
  const press = async (i, ms = 900) => { await page.evaluate((i) => window.__press(i, true), i); await page.waitForTimeout(ms); await page.evaluate((i) => window.__press(i, false), i); await page.waitForTimeout(200); };
  // menus: first D-pad press shows the focus ring, A confirms, D-pad down moves
  await press(13); // shows focus on CAMPAIGN
  await press(0);  // A → campaign
  await page.waitForTimeout(300);
  const onCampaign = await page.evaluate(() => !document.getElementById('campaign').classList.contains('hidden'));
  await press(13); await press(13); // into the mission list
  await page.screenshot({ path: `${OUT}/xbox-menu.png` });
  await press(0); // A on the focused mission → briefing
  await page.waitForTimeout(300);
  const onBrief = await page.evaluate(() => !document.getElementById('brief').classList.contains('hidden'));
  await press(13); await press(0); // focus BEGIN, press A
  await page.waitForFunction(() => GAME.mode === 'play', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (await page.evaluate(() => GAME.mode) !== 'play') return { fail: true, note: `menus via pad failed (campaign ${onCampaign}, brief ${onBrief})` };
  const before = await page.evaluate(() => ({ z: GAME.w.player.pos.z, yaw: GAME.w.player.yaw, mag: GAME.w.player.weapons[0].mag, dev: GAME.input.device }));
  // left stick forward, right stick right, RT fire
  await page.evaluate(() => { window.__pad.axes = [0, -1, 0.8, 0]; window.__press(7, true); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; window.__press(7, false); });
  await press(0); // A jump
  await press(3); // Y switch weapon
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ z: GAME.w.player.pos.z, yaw: GAME.w.player.yaw, mag: GAME.w.player.weapons[0].mag, cur: GAME.w.player.cur, dev: GAME.input.device, prompt: document.getElementById('ctltable').textContent.length }));
  await page.screenshot({ path: `${OUT}/xbox-play.png` });
  await press(9); // Menu = pause
  const paused = await page.evaluate(() => GAME.mode);
  await press(1); // B = back/resume
  const resumed = await page.evaluate(() => GAME.mode);
  const ok = onCampaign && onBrief && after.z < before.z - 0.3 && after.yaw < before.yaw - 0.1 && after.mag < before.mag && after.cur === 1 && after.dev === 'pad' && paused === 'paused' && resumed === 'play';
  return { fail: !ok, note: `menus ok=${onCampaign && onBrief}; z ${before.z.toFixed(1)}→${after.z.toFixed(1)}, yaw ${before.yaw.toFixed(2)}→${after.yaw.toFixed(2)}, mag ${before.mag}→${after.mag}, weapon slot ${after.cur}, device ${after.dev}, pause ${paused}→${resumed}` };
}, { pad: true });

await browser.close();
console.log(failures ? `${failures} profile(s) FAILED` : 'SMOKE PASS');
process.exit(failures ? 1 : 0);

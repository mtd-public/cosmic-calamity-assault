// Browser-build smoke test: serves the assembled site, drives site/play/ in
// headless Chromium (Playwright, SwiftShader WebGL2) and checks that the
// engine boots, the title renders, a new game reaches MAP01 with no script
// errors, keyboard and (synthetic) gamepad input move and turn the player,
// and savegames persist across a reload. Screenshots go to shots/web/.
//
//   node tools/web-smoke.mjs [--site _site] [--keep]
// Without --site it assembles one into .gz/web-site from site/ + dist/ (run
// node tools/build.mjs first). Needs Playwright with Chromium 137+ (JSPI).
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, rmSync, cpSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { decodePNG } from './lib/png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = join(ROOT, 'shots/web');
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ site
let SITE = args.includes('--site') ? resolve(args[args.indexOf('--site') + 1]) : null;
if (!SITE) {
  SITE = join(ROOT, '.gz/web-site');
  rmSync(SITE, { recursive: true, force: true });
  cpSync(join(ROOT, 'site'), SITE, { recursive: true });
  execFileSync('node', [join(ROOT, 'tools/web-assemble.mjs'), SITE], { stdio: 'inherit' });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(SITE + sep) && p !== SITE) { res.writeHead(403); return res.end(); }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Content-Length': statSync(p).size });
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ------------------------------------------------------------------ browser
async function loadPlaywright() {
  try { return await import('playwright'); } catch (_) {}
  const req = createRequire(join(execSync('npm root -g').toString().trim(), 'noop.js'));
  return req('playwright');
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
// Synthetic gamepad: navigator.getGamepads() returns window.__pad while __padOn.
await context.addInitScript(() => {
  const btn = () => ({ pressed: false, touched: false, value: 0 });
  window.__pad = { id: 'Synthetic Xbox Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard',
    timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
  window.__padOn = false;
  Object.defineProperty(Navigator.prototype, 'getGamepads', {
    configurable: true, value() { return window.__padOn ? [window.__pad] : [null]; } });
});

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
const S = () => page.evaluate(() => ({ phase: __cca.phase, captured: __cca.captured, locked: __cca.locked, fps: __cca.fps,
  frameMs: __cca.frameMs, frames: __cca.frames, audio: __cca.audio, errors: __cca.errors, saves: __cca.saves, pad: __cca.pad }));
const shot = async (name) => {
  const buf = await page.locator('#canvas').screenshot({ path: join(OUT, name + '.png') });
  return decodePNG(buf);
};
// Mean absolute RGB difference over the world view (above the HUD, inside the edges).
function diff(a, b) {
  let sum = 0, n = 0;
  for (let y = Math.floor(a.h * 0.1); y < a.h * 0.62; y += 2) {
    for (let x = Math.floor(a.w * 0.08); x < a.w * 0.92; x += 2) {
      const o = (y * a.w + x) * 4;
      sum += Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2]);
      n++;
    }
  }
  return sum / n / 3;
}
const key = async (code, ms = 120) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };
const setPad = (patch) => page.evaluate((p) => {
  if (p.axes) window.__pad.axes = p.axes;
  for (const [i, v] of Object.entries(p.buttons || {})) window.__pad.buttons[i] = { pressed: v > 0.5, touched: v > 0, value: v };
  window.__pad.timestamp = performance.now();
}, patch);

async function bootToTitle(tag) {
  page = await context.newPage();
  await page.goto(BASE + '/play/?dev=1');
  await page.waitForFunction(() => window.__cca && ['ready', 'failed', 'unsupported'].includes(__cca.phase), null, { timeout: 180000 });
  let s = await S();
  check(`${tag}: page loads and downloads the game`, s.phase === 'ready', s.phase);
  if (s.phase !== 'ready') return false;
  if (tag === 'first') await page.screenshot({ path: join(OUT, 'web-1-start.png') });
  await page.click('#play-btn');
  await page.waitForFunction(() => ['running', 'failed'].includes(__cca.phase), null, { timeout: 60000 });
  await page.waitForFunction(() => __cca.frames > 40 || __cca.phase === 'failed', null, { timeout: 60000 });
  await sleep(2500);
  s = await S();
  check(`${tag}: engine boots and renders`, s.phase === 'running' && s.frames > 40, `${s.frames} frames, errors: ${s.errors.length}`);
  return s.phase === 'running';
}

async function newGame() {
  await key('Escape'); await sleep(1500);
  await shot('web-3-menu');
  await key('Enter'); await sleep(1500);          // New Game (one episode: straight to skill)
  await shot('web-3b-skill');
  await key('Enter');                              // default skill
  await page.waitForFunction(() => __cca.captured, null, { timeout: 30000 }).catch(() => {});
  await sleep(4000);
}

const t0 = Date.now();
try {
  if (await bootToTitle('first')) {
    await shot('web-2-title');
    let s = await S();
    const logText = await page.evaluate(() => __cca.log.join('\n'));
    check('mod scripts compile in GZDoom 4.11.3 (no script errors)', !/Script error|Execution could not continue|Unknown command "cca_/.test(logText),
      (logText.match(/Script error.*|Unknown command.*/g) || []).slice(0, 3).join(' | '));

    await newGame();
    s = await S();
    const map01 = await page.evaluate(() => __cca.log.some((l) => /MAP01/.test(l)));
    check('new game reaches MAP01 (engine captures the mouse)', s.captured, `captured=${s.captured} locked=${s.locked} MAP01 in log=${map01}`);
    const a = await shot('web-4-map01');

    // FPS while idle in MAP01 (SwiftShader: software WebGL, a floor for real GPUs).
    await sleep(3000);
    s = await S();
    check('frame rate measured', s.fps > 0, `${s.fps.toFixed(1)} fps, ${s.frameMs.toFixed(1)} ms/frame (headless SwiftShader)`);

    // Keyboard: idle drift vs holding S (MAP01 starts facing a door).
    const b = await shot('web-5a-idle');
    await page.keyboard.down('KeyS'); await sleep(1500); await page.keyboard.up('KeyS');
    await sleep(300);
    const c = await shot('web-5b-after-S');
    const idle = diff(a, b), moved = diff(b, c);
    check('keyboard: S moves the player', moved > Math.max(6, idle * 2), `idle Δ ${idle.toFixed(1)}, S Δ ${moved.toFixed(1)}`);

    // Gamepad (synthetic navigator.getGamepads).
    await page.evaluate(() => { window.__padOn = true; });
    await sleep(500);
    s = await S();
    check('gamepad detected', !!s.pad, s.pad || 'none');
    const p0 = await shot('web-6a-pad-before');
    await setPad({ axes: [-1, 0, 0, 0] }); await sleep(1200); await setPad({ axes: [0, 0, 0, 0] }); await sleep(300);
    const p1 = await shot('web-6b-pad-leftstick');
    const padMove = diff(p0, p1);
    check('gamepad: left stick strafes the player', padMove > Math.max(6, idle * 2), `Δ ${padMove.toFixed(1)}`);
    await setPad({ axes: [0, 0, 1, 0] }); await sleep(1000); await setPad({ axes: [0, 0, 0, 0] }); await sleep(300);
    const p2 = await shot('web-6c-pad-rightstick');
    const padTurn = diff(p1, p2);
    check('gamepad: right stick turns the view', padTurn > Math.max(6, idle * 2), `Δ ${padTurn.toFixed(1)}`);
    const audio0 = (await S()).audio;
    await setPad({ buttons: { 7: 1 } }); await sleep(150);
    await shot('web-6d-pad-fire');
    await sleep(500); await setPad({ buttons: { 7: 0 } }); await sleep(300);
    const audio1 = (await S()).audio;
    check('gamepad: RT fires (weapon sound played)', audio1 > audio0, `audio buffers ${audio0} -> ${audio1}`);
    await setPad({ buttons: { 13: 1 } }); await sleep(150); await setPad({ buttons: { 13: 0 } }); await sleep(1200);
    await shot('web-6e-pad-iris');
    await page.evaluate(() => { window.__padOn = false; });
    await sleep(300);

    // Save from the console, check it reaches IndexedDB.
    await key('Backquote'); await sleep(400);
    await page.keyboard.type('save websmoke', { delay: 30 });
    await key('Enter'); await sleep(600);
    await key('Backquote');
    await page.waitForFunction(() => __cca.saves.stored.some((p) => /websmoke/.test(p)), null, { timeout: 15000 }).catch(() => {});
    s = await S();
    check('savegame written to IndexedDB (typed console command)', s.saves.stored.some((p) => /websmoke/.test(p)), s.saves.stored.join(', '));
    await shot('web-7-after-save');

    // Reload: the save must come back.
    await page.close();
    if (await bootToTitle('reload')) {
      s = await S();
      check('savegame restored after reload', s.saves.restored > 0, `${s.saves.restored} file(s)`);
      await key('Backquote'); await sleep(400);
      await page.keyboard.type('load websmoke', { delay: 30 });
      await key('Enter'); await sleep(400);
      await key('Backquote');
      await page.waitForFunction(() => __cca.captured, null, { timeout: 30000 }).catch(() => {});
      await sleep(3000);
      s = await S();
      check('restored savegame loads', s.captured && !s.errors.length, `captured=${s.captured}`);
      await shot('web-8-loaded-save');
    }
  }
} catch (e) {
  check('smoke run', false, e.message);
} finally {
  if (page && !page.isClosed()) {
    try { writeFileSync(join(OUT, 'web-log.txt'), await page.evaluate(() => __cca.log.join('\n'))); } catch (_) {}
  }
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`web-smoke: ${results.length - failed.length}/${results.length} passed in ${((Date.now() - t0) / 1000).toFixed(0)} s; screenshots in shots/web/`);
process.exit(failed.length ? 1 : 0);

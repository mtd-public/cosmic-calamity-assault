// Title / menu / intermission graphics and the scope mask, laid out as HTML
// and rendered in headless Chromium, composited over the game's own sky and
// sprite renders. Writes mod/graphics/*.png (hi-res: build declares them 2x).
//   node tools/gfx.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { encodePNG } from './lib/png.mjs';
const pw = await import('playwright').catch(() => import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')));
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'mod/graphics/hires');
mkdirSync(OUT, { recursive: true });
const b64 = (p) => existsSync(join(ROOT, 'mod', p)) ? `data:image/png;base64,${readFileSync(join(ROOT, 'mod', p)).toString('base64')}` : '';

const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{background:transparent;font-family:'Liberation Sans',sans-serif}
.stamp{font-family:'Courier 10 Pitch','Liberation Mono',monospace;font-weight:bold;letter-spacing:2px}`;
const pages = {
  TITLEPIC: [640, 400, `<div style="position:relative;width:640px;height:400px;overflow:hidden;background:#05070a">
    <div style="position:absolute;inset:0;background:url(${b64('textures/SKYA51.png')}) center 70%/cover;filter:saturate(1.1) brightness(.9)"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 35%,rgba(160,255,200,.18),transparent 55%),linear-gradient(transparent 55%,rgba(0,0,0,.85))"></div>
    <img src="${b64('sprites/monsters/GREYA1.png')}" style="position:absolute;left:452px;bottom:26px;height:250px;image-rendering:auto;filter:drop-shadow(0 0 12px rgba(140,255,190,.5))">
    <img src="${b64('sprites/npcs/GRDAA1.png') || b64('sprites/monsters/THRLA1.png')}" style="position:absolute;left:70px;bottom:24px;height:190px;filter:brightness(.45) drop-shadow(0 0 6px #000)">
    <div style="position:absolute;left:36px;top:48px;color:#e8f0ea;font-weight:900;font-size:50px;line-height:.92;letter-spacing:1px;text-shadow:0 0 18px rgba(120,255,170,.55),3px 3px 0 #000">COSMIC<br>CALAMITY</div>
    <div style="position:absolute;left:40px;top:150px;color:#ff463c;font-weight:900;font-size:30px;letter-spacing:12px;text-shadow:2px 2px 0 #000">ASSAULT</div>
    <div class=stamp style="position:absolute;left:40px;top:196px;color:#ffbe5a;font-size:17px">CASE FILE 51</div>
    <div class=stamp style="position:absolute;right:30px;top:30px;color:#d8342c;font-size:20px;border:3px solid #d8342c;padding:3px 10px;transform:rotate(-8deg);opacity:.85">TOP SECRET</div>
    <div class=stamp style="position:absolute;left:40px;bottom:16px;color:#8cf7a0;font-size:11px;opacity:.8">GROOM LAKE, NEVADA · 1997 · EYES ONLY</div></div>`],
  M_DOOM: [360, 110, `<div style="width:360px;height:110px;position:relative">
    <div style="position:absolute;left:0;top:4px;color:#e8f0ea;font-weight:900;font-size:40px;line-height:.9;text-shadow:0 0 14px rgba(120,255,170,.6),3px 3px 0 #000">COSMIC CALAMITY</div>
    <div class=stamp style="position:absolute;left:4px;top:52px;color:#ff463c;font-size:22px;letter-spacing:9px;text-shadow:2px 2px 0 #000">ASSAULT</div>
    <div class=stamp style="position:absolute;left:4px;top:82px;color:#ffbe5a;font-size:14px;text-shadow:1px 1px 0 #000">CASE FILE 51</div></div>`],
  INTERPIC: [640, 400, `<div style="width:640px;height:400px;position:relative;background:#0b0f0c;overflow:hidden">
    <div style="position:absolute;inset:0;background:url(${b64('flats/LABTILE.png')}) 0 0/96px;filter:brightness(.25) sepia(.5)"></div>
    <div style="position:absolute;left:60px;top:40px;width:520px;height:320px;background:#d9c79a;box-shadow:0 10px 40px #000;transform:rotate(-1.5deg)">
      <div style="position:absolute;left:0;top:-18px;width:160px;height:24px;background:#d2bd8c;border-radius:6px 6px 0 0"></div>
      <div class=stamp style="position:absolute;right:26px;top:22px;color:#b8261f;font-size:22px;border:3px solid #b8261f;padding:2px 10px;transform:rotate(-6deg)">CLASSIFIED</div>
      <div class=stamp style="position:absolute;left:28px;top:30px;color:#3a2f1c;font-size:15px">FEDERAL BUREAU OF INVESTIGATION<br>UNEXPLAINED PHENOMENA UNIT</div>
      <div class=stamp style="position:absolute;left:28px;bottom:26px;color:#3a2f1c;font-size:13px">CASE No. X-51 · S.A. E. MARSH</div></div></div>`],
};
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
for (const [name, [w, h, html]] of Object.entries(pages)) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><meta charset=utf-8><style>${CSS}</style>${html}`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(OUT, name + '.png'), omitBackground: name === 'M_DOOM', clip: { x: 0, y: 0, width: w, height: h } });
}
await browser.close();

// scope mask: a translucent blue-grey surround, a lens ring and fine cross-hairs
{
  const S = 512, d = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5 - S / 2) / (S / 2), dy = (y + 0.5 - S / 2) / (S / 2), r = Math.hypot(dx, dy), o = (y * S + x) * 4;
    let a = 0, c = [24, 34, 42];
    if (r > 0.94) a = 235;
    else if (r > 0.9) { a = 180 + (r - 0.9) / 0.04 * 55; c = [60, 80, 96]; }
    else if (r > 0.86) a = (r - 0.86) / 0.04 * 60;
    const line = (Math.abs(dx) < 0.004 || Math.abs(dy) < 0.004) && r < 0.86 && r > 0.03;
    if (line) { a = 200; c = [10, 14, 16]; }
    const mil = Math.abs(dy) < 0.02 && Math.abs(dx) < 0.86 && Math.abs((dx * 10) % 1) < 0.03 && r > 0.05;
    if (mil) { a = 200; c = [10, 14, 16]; }
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = a;
  }
  writeFileSync(join(ROOT, 'mod/graphics/SCOPEMSK.png'), encodePNG(d, S, S));
}
console.log('gfx: TITLEPIC, M_DOOM, INTERPIC (graphics/hires, 2x), SCOPEMSK');

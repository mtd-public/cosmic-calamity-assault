// Contact sheet: renders the PNGs in the given mod/ subfolders as a labelled
// grid (headless Chromium) for review.
//   node tools/contact.mjs out.png "Title" sprites/monsters textures ...
// Options via env: FILTER (regex on file name), TILE (textures tiled 2x2: 1), SCALE (default 1)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
const pw = await import('playwright').catch(() => import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')));
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [out, title, ...dirs] = process.argv.slice(2);
const filter = process.env.FILTER ? new RegExp(process.env.FILTER) : null;
const scale = +(process.env.SCALE || 1);
let cells = '';
for (const d of dirs) {
  const dir = join(ROOT, 'mod', d);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter((f) => f.endsWith('.png') && (!filter || filter.test(f))).sort();
  cells += `<h2>${d} <small>(${files.length})</small></h2><div class=grid>`;
  for (const f of files) {
    const b64 = readFileSync(join(dir, f)).toString('base64');
    const tile = process.env.TILE === '1' && /textures|flats/.test(d) && !f.startsWith('SKY');
    const img = tile ? `<div class=tile style="background-image:url(data:image/png;base64,${b64})"></div>` : `<img src="data:image/png;base64,${b64}">`;
    cells += `<figure>${img}<figcaption>${basename(f, '.png')}</figcaption></figure>`;
  }
  cells += '</div>';
}
const html = `<!doctype html><meta charset=utf-8><style>
body{margin:0;padding:16px;background:#14181c;color:#cfd8dc;font:13px monospace}
h1{margin:0 0 8px;color:#8cf7a0;font-size:20px} h2{margin:14px 0 6px;color:#ffbe5a;font-size:14px}
.grid{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
figure{margin:0;padding:6px;background:#1e252b;border:1px solid #2b3640;text-align:center}
img{display:block;image-rendering:auto;zoom:${scale};max-width:${Math.round(520 / scale)}px}
.tile{width:256px;height:256px;background-size:128px 128px;background-repeat:repeat}
figcaption{margin-top:4px;color:#9fb3bf}
</style><h1>${title}</h1>${cells}`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);

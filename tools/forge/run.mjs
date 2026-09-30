// Runs forge jobs in headless Chromium and writes their images into mod/.
//   node tools/forge/run.mjs                 # every job in tools/forge/jobs/
//   node tools/forge/run.mjs grey hud-pistol # just these
// Env: CHROMIUM (browser binary), OUT (default: mod), JOBS_PARALLEL (default 3)
import http from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { encodePNG } from '../lib/png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(ROOT, process.env.OUT || 'mod');
const pw = await import('playwright').catch(() => import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = resolve(ROOT, '.' + p);
    if (!f.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(f);
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

let jobs = process.argv.slice(2);
if (!jobs.length) jobs = (await readdir(join(ROOT, 'tools/forge/jobs'))).filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.slice(0, -3)).sort();

const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let failed = 0, total = 0;
async function runJob(job) {
  const t0 = Date.now();
  const page = await browser.newPage();
  let written = 0;
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`  [${job}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`  [${job}] pageerror: ${e.message}`));
  await page.exposeFunction('__forgeEmit', async (metaJson, data) => {
    const meta = JSON.parse(metaJson);
    const file = join(OUT, meta.path);
    await mkdir(dirname(file), { recursive: true });
    if (meta.text != null) await writeFile(file, meta.text);
    else await writeFile(file, encodePNG(Buffer.from(data, 'base64'), meta.w, meta.h, { grab: meta.grab }));
    written++;
  });
  const done = new Promise((r) => page.exposeFunction('__forgeDone', (j) => r(JSON.parse(j))));
  await page.goto(`http://127.0.0.1:${port}/tools/forge/index.html?job=${encodeURIComponent(job)}`);
  const res = await Promise.race([done, new Promise((r) => setTimeout(() => r({ ok: false, error: 'timeout' }), 20 * 60 * 1000))]);
  await page.close();
  total += written;
  if (!res.ok) { failed++; console.log(`FAIL ${job}: ${res.error}`); }
  else console.log(`ok   ${job}: ${written} files in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const N = +(process.env.JOBS_PARALLEL || 3);
const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(N, queue.length) }, async () => { while (queue.length) await runJob(queue.shift()); }));
await browser.close();
server.close();
console.log(`${jobs.length - failed}/${jobs.length} jobs ok, ${total} files → ${OUT}`);
process.exit(failed ? 1 : 0);

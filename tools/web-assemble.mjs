// Assembles the browser build into a built site directory (CI: _site):
//   <site>/play/engine/   GZDoom 4.11.3 WebAssembly (vendored in web/engine/, checksummed) + LICENSE
//   <site>/play/freedoom2.wad (+ FREEDOOM-LICENSE.txt)
//   <site>/play/manifest.json   file list with real sizes (progress bar) and a version (cache busting)
// The page itself (site/play/*) is copied with the rest of site/; the mod pk3
// is the site's own download, <site>/cosmic-calamity-assault.pk3.
//
// Usage: node tools/web-assemble.mjs <site> [--iwad path/to/freedoom2.wad] [--pk3 dist/cosmic-calamity-assault.pk3]
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, statSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const SITE = resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) || '_site');
const IWAD = resolve(opt('--iwad', '/usr/share/games/doom/freedoom2.wad'));
const PK3 = resolve(opt('--pk3', join(ROOT, 'dist/cosmic-calamity-assault.pk3')));
const ENGINE = join(ROOT, 'web/engine');
const PLAY = join(SITE, 'play');
const MAX = 100 * 1024 * 1024;   // GitHub Pages: files must be under 100 MB

const die = (m) => { console.error('web-assemble: ' + m); process.exit(1); };
if (!existsSync(IWAD)) die(`no IWAD at ${IWAD} (apt install freedoom, or --iwad)`);

// Page files: normally already copied with site/; copy them if not.
if (!existsSync(join(PLAY, 'index.html'))) cpSync(join(ROOT, 'site/play'), PLAY, { recursive: true });
const pk3Site = join(SITE, 'cosmic-calamity-assault.pk3');
if (!existsSync(pk3Site)) {
  if (!existsSync(PK3)) die(`no pk3 at ${PK3} (node tools/build.mjs)`);
  copyFileSync(PK3, pk3Site);
}

// Engine: verify the vendored files against SHA256SUMS, then copy.
mkdirSync(join(PLAY, 'engine'), { recursive: true });
const sums = readFileSync(join(ENGINE, 'SHA256SUMS'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/));
for (const [sum, name] of sums) {
  const data = readFileSync(join(ENGINE, name));
  const got = createHash('sha256').update(data).digest('hex');
  if (got !== sum) die(`web/engine/${name}: sha256 mismatch (${got})`);
  if (name === 'gzdoom.wasm') {
    const n = silenceTraces(data);
    console.log(`  gzdoom.wasm: silenced ${n} debug trace strings`);
  }
  writeFileSync(join(PLAY, 'engine', name), data);
}
copyFileSync(join(ENGINE, 'LICENSE'), join(PLAY, 'engine/LICENSE'));

// The prebuilt engine still Printf()s porting traces ("[trace] FShader::Bind
// ...") that GZDoom shows on screen as notify messages. Blank each one by
// turning its first byte into NUL (an empty format string prints nothing).
// Only data-segment bytes change, never the length, so the module stays
// valid; a string that is a shared suffix of a trace keeps working.
function silenceTraces(buf) {
  let n = 0;
  for (const tag of ['[trace]', '[creg-walk]']) {
    const needle = Buffer.from(tag);
    for (let i = buf.indexOf(needle); i >= 0; i = buf.indexOf(needle, i + 1)) {
      if (i > 0 && buf[i - 1] === 0) { buf[i] = 0; n++; }
    }
  }
  return n;
}

copyFileSync(IWAD, join(PLAY, 'freedoom2.wad'));
const fdLicense = ['/usr/share/doc/freedoom/copyright', join(dirname(IWAD), 'COPYING.txt')].find(existsSync);
if (fdLicense) copyFileSync(fdLicense, join(PLAY, 'FREEDOOM-LICENSE.txt'));
else writeFileSync(join(PLAY, 'FREEDOOM-LICENSE.txt'), 'Freedoom is distributed under the modified BSD license: https://github.com/freedoom/freedoom/blob/master/COPYING.adoc\n');

// Manifest (urls relative to play/). role: script / wasm go to the worker
// directly; the rest are written into the engine's filesystem at `path`.
const entries = [
  { url: 'engine/gzdoom.js', role: 'script' },
  { url: 'engine/gzdoom.wasm', role: 'wasm' },
  { url: 'engine/gzdoom.pk3', path: '/gzdoom.pk3' },
  { url: 'engine/game_support.pk3', path: '/game_support.pk3' },
  { url: 'engine/game_widescreen_gfx.pk3', path: '/game_widescreen_gfx.pk3' },
  { url: 'freedoom2.wad', path: '/freedoom2.wad' },
  { url: '../cosmic-calamity-assault.pk3', path: '/cosmic-calamity-assault.pk3' },
];
const hash = createHash('sha1');
let total = 0;
for (const e of entries) {
  const f = resolve(PLAY, e.url);
  e.size = statSync(f).size;
  if (e.size >= MAX) die(`${e.url} is ${(e.size / 1048576).toFixed(1)} MB: GitHub Pages files must be under 100 MB`);
  total += e.size;
  hash.update(readFileSync(f));
}
const manifest = {
  version: hash.digest('hex').slice(0, 12),
  engineBase: 'engine/',
  iwad: 'freedoom2.wad',
  pwad: 'cosmic-calamity-assault.pk3',
  files: entries,
};
writeFileSync(join(PLAY, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
for (const e of entries) console.log(`  ${(e.size / 1048576).toFixed(1).padStart(6)} MB  play/${e.url}`);
console.log(`web-assemble: ${SITE}/play ready, download ${(total / 1048576).toFixed(1)} MB (version ${manifest.version})`);

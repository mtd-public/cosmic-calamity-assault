// Stand-in HUD frames for weapons whose art is not rendered yet: copies a
// human gun's frames (same frame letters, same offsets) with the metal tinted
// alien teal and the skin left alone. Never overwrites an existing frame, so
// the real renders (tools/forge/jobs/wpn-*) replace these as they land.
import fs from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from './lib/png.mjs';

const HUD = new URL('../mod/graphics/hud/', import.meta.url).pathname;
const MAP = [ // alien prefix, frames, human source
  ['ABLD', 'ABCDEFG', 'KNIF'],
  ['ASTG', 'ABCLMNOXY', 'P9MM'],
  ['ASCT', 'ABCLMNOXY', 'SHOT'],
  ['APSM', 'ABCDEFGHIJKLMNOXY', 'SMG9'],
  ['SNGL', 'ABCDEFGHI', 'BRFL'],
];

function tint(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx && (mx - mn) / mx > 0.28 && r > b) continue; // skin / sleeve: keep
    const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    data[i] = Math.min(255, 20 + l * 120);
    data[i + 1] = Math.min(255, 30 + l * 230);
    data[i + 2] = Math.min(255, 40 + l * 200);
  }
}

let made = 0;
for (const [pre, frames, src] of MAP) {
  for (const f of frames) {
    const out = path.join(HUD, `${pre}${f}0.png`);
    if (fs.existsSync(out)) continue;
    const from = path.join(HUD, `${src}${f}0.png`);
    if (!fs.existsSync(from)) { console.warn(`no source ${src}${f}0 for ${pre}${f}0`); continue; }
    const { w, h, grab, data } = decodePNG(fs.readFileSync(from));
    tint(data);
    fs.writeFileSync(out, encodePNG(data, w, h, { grab }));
    made++;
  }
}
console.log(`hud stand-ins: ${made} frames written`);

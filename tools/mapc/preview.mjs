// Top-down review image: 8 px per 32-unit cell.
//   floor height -> brightness; hue by kind (room grey-blue, door orange / key colour, window cyan,
//   lift violet, stairs green-grey, damage green, sky rooms slightly blue); 3D slabs hatched;
//   walkable but UNREACHED area tinted red; lines dark; things as dots (player white, monsters red,
//   NPCs cyan, pickups green, keys in their colour, objectives/terminals magenta, exits bright green).
import { encodePNG } from '../lib/png.mjs';
import { MONSTERS, NPCS, KEYS, isPickup } from './assets.mjs';

const PX = 8; // per cell
const KEYCOL = { blue: [60, 110, 255], red: [235, 50, 50], yellow: [240, 220, 40] };

export function renderPreview(lv, rep) {
  const W = lv.W * PX, H = lv.H * PX;
  const img = Buffer.alloc(W * H * 4);
  const set = (x, y, c, a = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    img[o] = img[o] * (1 - a) + c[0] * a; img[o + 1] = img[o + 1] * (1 - a) + c[1] * a; img[o + 2] = img[o + 2] * (1 - a) + c[2] * a; img[o + 3] = 255;
  };
  for (let i = 0; i < W * H; i++) { img[i * 4] = 10; img[i * 4 + 1] = 10; img[i * 4 + 2] = 14; img[i * 4 + 3] = 255; }
  const floors = lv.sectors.filter((s) => !s.control).map((s) => s.floor);
  const fmin = Math.min(...floors), fmax = Math.max(...floors, fmin + 1);
  const shade = (f) => 0.45 + 0.55 * (f - fmin) / (fmax - fmin);
  const colourOf = (s) => {
    let base;
    if (s.kind === 'door') base = s.lock ? KEYCOL[s.lock] : s.p.secret ? [200, 170, 60] : [230, 140, 40];
    else if (s.kind === 'window') base = [80, 200, 220];
    else if (s.kind === 'lift') base = [170, 90, 220];
    else if (s.kind === 'stairs') base = [150, 180, 150];
    else if (s.p.damage) base = [60, 220, 60];
    else if (s.cf === 'F_SKY1') base = [150, 165, 200];
    else base = [175, 175, 185];
    const k = s.kind === 'door' || s.kind === 'window' ? 1 : shade(s.floor);
    return base.map((v) => Math.round(v * k));
  };
  // cells
  for (let r = 0; r < lv.H; r++) for (let c = 0; c < lv.W; c++) {
    const cell = lv.cells[r][c];
    for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) {
      const x = c * PX + px, y = r * PX + py;
      let piece = null;
      if (cell.pieces) {
        if (cell.pieces.F) piece = cell.pieces.F;
        else {
          const lx = (px + 0.5) / PX, ly = (py + 0.5) / PX;
          const h = cell.ch === '/' ? (lx + ly < 1 ? 'UL' : 'LR') : (lx > ly ? 'UR' : 'LL');
          piece = cell.pieces[h] || null;
        }
      }
      if (!piece) { if (cell.kind === 'solid' || cell.kind === 'diag') set(x, y, cell.mark ? [240, 220, 60] : [52, 52, 60]); continue; }
      const s = piece.sector;
      set(x, y, colourOf(s));
      if (s.slabs && s.slabs.length && ((px + py) % (s.slabs.length > 1 ? 2 : 4) === 0)) set(x, y, [235, 235, 235], 0.7);
      if (s.p.secret && s.kind !== 'door' && (px === 0 || py === 0)) set(x, y, [255, 215, 0], 0.8);
      if (rep && rep.walk) {
        const sx = c * 2 + (px >= PX / 2 ? 1 : 0), sy = r * 2 + (py >= PX / 2 ? 1 : 0);
        const k = sy * rep.W + sx;
        if (rep.walk[k] && !rep.reached[k]) set(x, y, [255, 0, 0], 0.45);
      }
    }
  }
  // lines
  const scale = PX / 32;
  const drawLine = (a, b, col) => {
    const x0 = a[0] * scale, y0 = -a[1] * scale, x1 = b[0] * scale, y1 = -b[1] * scale;
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n - (x1 > x0 ? 0 : 0)), y = Math.round(y0 + (y1 - y0) * i / n);
      set(Math.min(W - 1, x), Math.min(H - 1, y), col);
    }
  };
  for (const l of lv.lines) {
    if (l.role === 'control') continue;
    const col = l.role === 'switch' ? [255, 240, 0] : l.role === 'trigger' ? [0, 255, 120] : l.back ? [70, 70, 80] : [15, 15, 20];
    drawLine(l.v1, l.v2, col);
  }
  // things
  const dot = (x, y, col, r) => {
    const cx = Math.round(x * scale), cy = Math.round(-y * scale);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) set(cx + dx, cy + dy, col);
  };
  for (const t of lv.things) {
    let col = null, r = 1;
    if (t.cls === 'PlayerStart') { col = [255, 255, 255]; r = 3; }
    else if (KEYS[t.cls]) { col = KEYCOL[KEYS[t.cls]]; r = 3; }
    else if (t.meta.key) { col = KEYCOL[t.meta.key]; r = 2; }
    else if (t.meta.objective || t.meta.heli || t.cls === 'HackTerminal' || t.cls === 'ExitGate' || t.cls === 'SafeZone') { col = [255, 0, 255]; r = 3; }
    else if (MONSTERS.has(t.cls)) { col = [255, 40, 40]; r = t.cls === 'HiveMind' ? 5 : t.cls === 'Stalker' || t.cls === 'Overseer' ? 3 : 2; }
    else if (NPCS.has(t.cls)) { col = [40, 230, 255]; r = 2; }
    else if (isPickup(t.cls)) { col = /^Pickup/.test(t.cls) ? [255, 160, 0] : [60, 255, 90]; r = /^Pickup/.test(t.cls) ? 2 : 1; }
    else if (t.cls === 'WaveSpot') { col = [255, 120, 0]; r = 1; }
    else if (t.cls === 'IrisTrigger') { col = [120, 255, 120]; r = 1; }
    else if (/^Light/.test(t.cls)) { col = [255, 255, 160]; r = 0; }
    else { col = [120, 120, 130]; r = 0; }
    dot(t.x, t.y, col, r);
  }
  return encodePNG(img, W, H);
}

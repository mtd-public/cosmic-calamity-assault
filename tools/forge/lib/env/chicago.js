// MAP04 Chicago, the Loop, 1997: beige office drywall, grey-blue cubicle
// fabric, venetian blinds, brass, polished granite, white glazed terracotta and
// the green riveted "L".
import { clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash } from './tex.js';

export const CH = {
  drywall: [204, 194, 170], drywallDk: [176, 166, 144], base: [62, 60, 58], rail: [184, 172, 148],
  fabric: [104, 118, 138], fabricDk: [78, 90, 108], trim: [150, 152, 150], trimDk: [96, 98, 100],
  carpet: [84, 96, 112], alu: [176, 178, 176], bronze: [72, 62, 50],
  brass: [198, 158, 76], brassDk: [136, 102, 44], brassLt: [236, 204, 130],
  granite: [150, 132, 126], terra: [226, 220, 202], terraDk: [184, 176, 156],
  lgreen: [50, 84, 62], lgreenDk: [34, 58, 44], night: [16, 22, 40], fireGlow: [255, 140, 50],
  soot: [26, 22, 20], char: [44, 34, 28],
};
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export { mixc };

// Drywall: orange-peel texture, faint taped seams every 128 px, vinyl cove base
// and (optionally) a chair rail. Returns the layout.
export function drywall(s, o = {}) {
  const { w, h } = s, seed = o.seed ?? 1, col = o.color || CH.drywall;
  const baseH = o.baseH ?? 8, railY = o.railY ?? (h - 58);
  s.fill(col, 0.1);
  s.each((u, v, x, y, i) => {
    const n = fbm(u, v, 4, 4, 4, seed), pe = fbm(u, v, 64, 64, 2, seed + 1), g = hash(x, y, seed + 2);
    const k = 0.95 + n * 0.07 + (pe - 0.5) * 0.025 + (g - 0.5) * 0.015;
    s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
    s.H[i] = pe * 0.35 + n * 0.3;
  });
  for (let x = 0; x < w; x += 128) s.rect(x - 3, -2, x + 3, h + 2, { h: 0.25, bevel: 3, op: 'add', color: mixc(col, [255, 255, 255], 0.06), alpha: 0.6 });
  if (o.rail !== false) {
    s.rect(-2, railY, w + 2, railY + 7, { h: 4, bevel: 2, prof: 'round', op: 'set', color: o.railColor || CH.rail, spec: 0.35 });
    s.rect(-2, railY + 2, w + 2, railY + 3, { h: 3.2, bevel: 0.6, op: 'set', color: mixc(o.railColor || CH.rail, [0, 0, 0], 0.18) });
  }
  // vinyl cove base
  s.rect(-2, h - baseH, w + 2, h + 2, { h: 2, bevel: 1.5, prof: 'round', op: 'set', color: CH.base, spec: 0.45 });
  // scuffs and chair dings below the rail, a few nail holes above
  const r = rng(seed + 3);
  for (let k = 0; k < 14; k++) { const x = r() * w, y = railY + 10 + r() * (h - baseH - railY - 14), L = 2 + r() * 9; s.seg(x, y, x + L, y + (r() - 0.5) * 2, 0.5, { color: [120, 112, 100], alpha: 0.25 + r() * 0.2 }); }
  for (let k = 0; k < 3; k++) s.circle(r() * w, 30 + r() * (railY - 60), 0.7, { color: [110, 104, 92], h: -0.5, op: 'add' });
  s.grime([150, 140, 120], (u, v) => sstep(0.85, 1, v) * 0.18, { seed: seed + 4, fx: 16, fy: 4 });
  return { railY, baseH };
}

// Woven fabric (cubicle panels): plain weave with heathered yarn.
export function fabricAt(x, y, col, seed) {
  const wx = (x & 1) ^ (y & 1), ht = hash(x >> 1, y, seed) * 0.5 + hash(x, y >> 1, seed + 1) * 0.5;
  const k = 0.88 + wx * 0.08 + (ht - 0.5) * 0.14;
  const fleck = hash(x, y, seed + 2);
  let c = [col[0] * k, col[1] * k, col[2] * k];
  if (fleck < 0.05) c = mixc(c, [170, 176, 186], 0.5);
  else if (fleck > 0.96) c = mixc(c, [40, 46, 60], 0.5);
  return [c, wx * 0.3 + ht * 0.3];
}

// Speckled granite: pink feldspar, white quartz, black mica and grey, per 2x2 grain.
export function graniteAt(u, v, x, y, seed, o = {}) {
  const g = hash(x, y, seed), g2 = hash(x >> 1, y >> 1, seed + 1);
  const pink = o.pink || [176, 132, 120], grey = o.grey || [128, 122, 120], quartz = o.quartz || [206, 200, 194], mica = o.mica || [34, 30, 32];
  const mid = mixc(pink, grey, 0.5);
  let c = g < 0.07 ? mica : g < 0.27 ? quartz : g < 0.65 ? pink : grey;
  c = mixc(c, mid, o.soft ?? 0.55);
  const n = fbm(u, v, 6, 6, 3, seed + 2), k = 0.9 + n * 0.16 + (g2 - 0.5) * 0.08;
  return [c[0] * k, c[1] * k, c[2] * k];
}

// Venetian blinds over a window rect: drop = fraction lowered (0..1), tilt 0 (open) .. 1 (closed).
// inside(x, y) → colour seen through the glass. Writes colour/height directly.
export function blinds(s, x0, y0, x1, y1, o = {}) {
  const drop = o.drop ?? 1, tilt = o.tilt ?? 0.6, slat = o.slat ?? 4, col = o.color || [196, 188, 168];
  const yb = y0 + (y1 - y0) * drop;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
    const i = s.idx(x, y);
    const inside = o.inside(x, y);
    if (y < yb) {
      const f = mod(y - y0, slat) / slat;
      const cover = clamp(0.35 + tilt * 0.65);
      if (f < cover) { const sh = 0.75 + f / cover * 0.3; s.setC(i, [col[0] * sh, col[1] * sh, col[2] * sh]); s.H[i] = 1.2 + f; s.S[i] = 0.3; if (o.backlit) s.addE(i, col, o.backlit * 0.25); }
      else { s.setC(i, inside); s.H[i] = 0; s.S[i] = 1; if (o.lit) s.addE(i, inside, o.lit); }
    } else { s.setC(i, inside); s.H[i] = 0; s.S[i] = 1; if (o.lit) s.addE(i, inside, o.lit); }
  }
  // bottom rail of the blinds and the pull cords
  if (drop > 0.02) {
    s.rect(x0, yb - 2, x1, yb + 1.5, { h: 3, bevel: 1, op: 'set', color: mixc(col, [0, 0, 0], 0.15), spec: 0.4 });
    s.seg(x1 - 6, y0, x1 - 6, Math.min(y1 - 4, yb + 26), 0.5, { h: 3, op: 'set', color: [220, 214, 196] });
    s.circle(x1 - 6, Math.min(y1 - 4, yb + 26), 1.4, { h: 3, op: 'set', color: [220, 214, 196] });
  }
}

// Night view of the burning Loop through a window (lx, ly local to the pane, W, H pane size).
export function nightView(seed) {
  return (lx, ly, W, H) => {
    const t = ly / H, u = lx / Math.max(1, W);
    let c = mixc([10, 14, 30], [96, 46, 26], sstep(0.15, 1.0, t));            // sky glowing orange low down
    const sm = fbm(u, t, 3, 2, 3, seed + 9);
    c = mixc(c, [40, 30, 30], clamp((sm - 0.55) * 2) * (1 - t) * 0.8);       // drifting smoke
    // far buildings: blocky silhouettes with small lit windows
    const bi = Math.floor((lx + hash(seed, 2, 1) * 40) / 14), top = 0.18 + hash(bi, seed, 2) * 0.5;
    if (t > top) {
      c = mixc([16, 16, 22], [26, 22, 26], hash(bi, 3, seed));
      const wx = Math.floor(lx / 3), wy = Math.floor(ly / 4);
      if (mod(lx, 3) === 1 && mod(ly, 4) === 2) {
        const hh = hash(wx, wy, seed + 3);
        if (hh < 0.22) c = hh < 0.15 ? [210, 176, 110] : [140, 170, 200];
        if (hash(bi, 7, seed) < 0.18 && hash(wx, wy, seed + 5) < 0.6) c = [255, 140, 40];
      }
      if (hash(bi, 7, seed) < 0.18 && t > top + 0.02) c = mixc(c, [255, 110, 30], 0.12);
    }
    return c;
  };
}

// Riveted plate / angle helper: a rectangle with rivet rows along its long edges.
export function riveted(s, x0, y0, x1, y1, o = {}) {
  s.rect(x0, y0, x1, y1, { h: o.h ?? 4, bevel: o.bevel ?? 1.5, op: o.op || 'max', color: o.color, spec: o.spec ?? 0.35, a: o.a });
  const p = o.pitch ?? 8, r = o.r ?? 1.5, inset = o.inset ?? 3;
  if ((x1 - x0) >= (y1 - y0)) { for (let x = x0 + p / 2; x < x1; x += p) { s.bolt(x, y0 + inset, r, { h: 1.2, color: o.color }); if (y1 - y0 > inset * 3) s.bolt(x, y1 - inset, r, { h: 1.2, color: o.color }); } }
  else { for (let y = y0 + p / 2; y < y1; y += p) { s.bolt(x0 + inset, y, r, { h: 1.2, color: o.color }); if (x1 - x0 > inset * 3) s.bolt(x1 - inset, y, r, { h: 1.2, color: o.color }); } }
}

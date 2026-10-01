// MAP02 Dulce base (Dark Forces' Secret Base in the New Mexico desert): red
// sandstone mesa strata, board-formed government concrete with stencilled
// markings, rusted plate, caged bulkhead lamps and hazard paint.
import { clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash } from './tex.js';

export const DP = {
  // mesa sandstone
  red: [158, 68, 42], redDk: [112, 46, 32], orange: [192, 100, 56], salmon: [204, 136, 98], cream: [214, 176, 132],
  purple: [112, 62, 58], varnish: [52, 32, 28], sand: [176, 104, 66], sandLt: [206, 142, 98],
  // concrete and paint
  conc: [146, 142, 132], concDk: [104, 101, 94], concLt: [170, 166, 156],
  govGreen: [74, 88, 78], govGrey: [96, 102, 100], navy: [34, 44, 60],
  yellow: [224, 176, 36], red2: [168, 34, 26], white: [226, 224, 214], black: [24, 24, 24],
  // metal
  steel: [104, 108, 108], steelDk: [64, 68, 70], rust: [122, 62, 34], rustLt: [156, 88, 48], rustDk: [66, 38, 26],
  lamp: [255, 214, 140],
};
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export { mixc };

// ------------------------------------------------------------------ mesa strata
// Horizontal sandstone beds (periodic vertically): hard beds stand out as
// ledges, soft beds are recessed and honeycombed, joints crack through, desert
// varnish runs down from the ledges and sand gathers on top of them.
export function strata(s, o = {}) {
  const { w, h } = s, seed = o.seed ?? 1, r = rng(seed);
  // bed sequence summing to h: mostly red and orange sandstone, the odd pale or purple bed
  const kinds = [
    { c: [158, 72, 46], hard: 0.85, p: 3 }, { c: [176, 92, 58], hard: 0.55, p: 3 }, { c: [142, 62, 42], hard: 0.7, p: 2 },
    { c: [190, 118, 80], hard: 0.9, p: 1.5 }, { c: [204, 164, 124], hard: 1.0, p: 0.7 }, { c: [150, 86, 62], hard: 0.2, p: 1 },
  ];
  const tot = kinds.reduce((a, k) => a + k.p, 0);
  const pick = () => { let q = r() * tot; for (const k of kinds) { q -= k.p; if (q <= 0) return k; } return kinds[0]; };
  const beds = []; let y = 0, last = null;
  while (y < h) {
    const t = Math.round(10 + Math.pow(r(), 1.2) * (o.maxBed ?? 50));
    let k; do k = pick(); while (k === last);
    last = k;
    // vertical joints dividing the bed into blocks
    const jx = []; let x = r() * 40; while (x < w) { jx.push(x); x += 26 + r() * 70; }
    beds.push({ y0: y, y1: Math.min(h, y + t), ...k, tone: 0.92 + r() * 0.14, id: beds.length, jx, slant: (r() - 0.5) * 0.3 });
    y += t;
  }
  const bedAt = (L) => { L = mod(L, h); for (const b of beds) if (L < b.y1) return b; return beds[beds.length - 1]; };
  const amp = o.warp ?? 4;
  s.each((u, v, x, yy, i) => {
    const warp = (fbm(u, 0.5, 2, 1, 3, seed + 1) - 0.5) * amp * 2 + (fbm(u, v, 6, 3, 3, seed + 15) - 0.5) * 6 + (fbm(u, v, 16, 16, 3, seed + 2) - 0.5) * 3;
    const L = yy + warp, b = bedAt(L), Lm = mod(L, h);
    const dTop = Lm - b.y0, dBot = b.y1 - Lm, above = beds[(b.id + beds.length - 1) % beds.length];
    // irregular blocks: Worley cells, narrow and tall so the fractures run mostly vertically
    const [f1, f2, cid] = worley(u + (fbm(u, v, 8, 8, 2, seed + 12) - 0.5) * 0.03, v, o.cellsX ?? 7, o.cellsY ?? 3, seed + b.id * 3, 1);
    const edge = f2 - f1, blk = hash(cid, b.id, seed + 13);
    const crackOn = fbm(u, v, 6, 6, 3, seed + 14) > 0.42 && b.hard > 0.3;
    const n = fbm(u, v, 10, 10, 4, seed + 3), n2 = fbm(u, v, 40, 40, 2, seed + 4), g = hash(x, yy, seed + 5);
    const big = fbm(u, v, 2, 2, 4, seed + 6);
    const flute = ridged(u, v, 40, 3, 3, seed + 7);
    const soft = 1 - b.hard;
    let k = b.tone * (0.8 + n * 0.24 + (n2 - 0.5) * 0.08 + (g - 0.5) * 0.1 + (blk - 0.5) * 0.1 + (big - 0.5) * 0.3);
    // a step (not a groove) between beds: blend from the bed above over a few texels
    const top = sstep(0, above.hard > b.hard ? 2.5 : 4 + b.hard * 2, dTop);
    const lump = sstep(0, 0.25, edge);                                      // rounded block edges
    let H = mix(above.hard, b.hard, top) * 7 + (crackOn ? lump * 2.5 * b.hard : 0) + (blk - 0.5) * 2.5 * b.hard + flute * (0.8 + soft) + n * 2.2 + (g - 0.5) * 0.6;
    if (soft > 0.5) H += (fbm(u, v, 24, 24, 3, seed + 9) - 0.5) * 4 * soft;
    let c = [b.c[0] * k, b.c[1] * k, b.c[2] * k];
    if (crackOn && edge < 0.035) c = mixc(c, [84, 46, 34], 0.55 * (1 - edge / 0.035));
    if (dTop < 2.5 && above.hard > b.hard + 0.2) c = mixc(c, [92, 50, 38], 0.3 * (1 - dTop / 2.5));
    if (dTop < 3 && b.hard > 0.55) c = mixc(c, [210, 150, 106], (1 - dTop / 3) * 0.35 * (0.5 + n));
    s.setC(i, c); s.H[i] = H;
  });
  // spalls: fresh, paler scoops broken out of the hard beds
  const pr = rng(seed + 10);
  for (let k = 0; k < (o.spalls ?? 0); k++) {
    const x = pr() * w, yy = pr() * h, b = bedAt(yy); if (b.hard < 0.5) continue;
    const rx = 5 + pr() * 12, ry = Math.min(5 + pr() * 6, (b.y1 - b.y0) * 0.45);
    s.stamp((px, py) => (Math.hypot((px - x) / rx, (py - yy) / ry) - 1) * Math.min(rx, ry), [x - rx, yy - ry, x + rx, yy + ry], { h: -3, op: 'add', bevel: 4, prof: 'smooth', fn: (i, cov) => s.setC(i, mixc(s.getC(i), [206, 120, 76], 0.35), cov) });
  }
  // sparse alveolar pockets in the soft beds
  for (let k = 0; k < (o.pockets ?? 10); k++) {
    const x = pr() * w, yy = pr() * h, b = bedAt(yy);
    if (b.hard > 0.5) continue;
    const rr = 1.2 + pr() * 2.2;
    s.circle(x, yy, rr, { h: -2, op: 'add', bevel: rr, prof: 'round', color: [96, 56, 42], alpha: 0.3 });
  }
  // a couple of long tectonic joints through several beds
  for (let k = 0; k < (o.joints ?? 2); k++) {
    const jx = pr() * w, pts = []; let xx = jx;
    const y0 = pr() * h, len = h * (0.4 + pr() * 0.5);
    for (let yy = y0; yy <= y0 + len; yy += 4) { xx += (hash(Math.round(jx), Math.round(yy), seed + 11) - 0.5) * 5; pts.push([xx, yy, 0.5 + hash(Math.round(yy), 3, seed) * 0.9]); }
    s.tube(pts, 1, { h: 2.5, op: 'sub', bevel: 1.2, color: [84, 46, 36], alpha: 0.5 });
  }
  return { beds, bedAt };
}

// ------------------------------------------------------------------ board-formed concrete
// Brutalist cast-in-place concrete: horizontal timber boards (wood grain printed
// into the surface), staggered butt joints, form-panel seams and snap-tie holes.
export function boardForm(s, o = {}) {
  const { w, h } = s, seed = o.seed ?? 1, bh = o.board ?? 16, base = o.color || DP.conc;
  const panel = o.panel ?? 256, nb = Math.round(h / bh);
  s.fill(base, 0.05);
  s.each((u, v, x, y, i) => {
    const row = Math.floor(y / bh), fy = y - row * bh, rr = mod(row, nb);
    // butt joints: 1-2 per board per texture width, staggered
    const nj = 1 + Math.floor(hash(rr, 1, seed) * 2.2);
    let off = 0, dj = 99;
    for (let k = 0; k < nj; k++) { const jx = hash(rr, k + 5, seed) * w; dj = Math.min(dj, Math.abs(mod(x - jx + w / 2, w) - w / 2)); if (x > jx) off = k + 1; }
    const bid = rr * 7 + off;
    const grain = fbm(mod(x + bid * 61, w) / w, fy / bh / nb + v * 0.0, Math.max(1, Math.round(w / 128)), nb * 3, 3, seed + bid % 13) ;
    const ring = Math.sin((x * 0.045 + grain * 9 + hash(bid, 2, seed) * 20) * 1.0) * 0.5 + 0.5;
    const tone = 0.96 + hash(bid, 3, seed) * 0.06;
    const n = fbm(u, v, 6, 6, 4, seed + 7), m = fbm(u, v, 32, 32, 2, seed + 8);
    const k = tone * (0.84 + n * 0.24 + (m - 0.5) * 0.08 + (ring - 0.5) * 0.035);
    s.setC(i, [base[0] * k, base[1] * k, base[2] * k * 0.99]);
    // board relief: each board slightly cupped, offset per board; seams between boards
    let H = (hash(bid, 4, seed) - 0.5) * 0.8 + Math.sin(fy / bh * Math.PI) * 0.35 + (ring - 0.5) * 0.3 + n * 1.4 + m * 0.4;
    if (fy < 1 || fy > bh - 1) { H -= 0.5; s.C[i * 3] *= 0.95; s.C[i * 3 + 1] *= 0.95; s.C[i * 3 + 2] *= 0.95; }
    if (dj < 0.7) H -= 0.3;
    // grout fins squeezed out at the seams (a lighter, lumpy line)
    if (fy === 0 && hash(x >> 2, row, seed + 11) < 0.3) { H += 0.6; s.setC(i, mixc(s.getC(i), DP.concLt, 0.25)); }
    s.H[i] = H;
  });
  // form-panel seams and snap-tie holes
  for (let x = 0; x < w; x += panel) s.rect(x - 1, -2, x + 1, h + 2, { h: -1.2, op: 'add', bevel: 1, color: DP.concDk, alpha: 0.5 });
  if (o.ties !== false) {
    for (let x = (o.tieX ?? 32); x < w; x += (o.tieDx ?? 64)) for (const y of (o.tieY ?? [bh * 3, bh * 11])) {
      s.circle(x, y, 4.2, { h: -2.6, op: 'add', bevel: 2.5, color: [112, 108, 100], alpha: 0.85 });
      s.circle(x, y, 2, { h: -1.4, op: 'add', bevel: 1, color: [70, 66, 60] });
    }
  }
  // pits, bug holes
  const r = rng(seed + 12);
  for (let k = 0; k < (o.pits ?? 90); k++) s.circle(r() * w, r() * h, 0.6 + r() * 1.4, { h: -1, op: 'add', bevel: 1, color: [104, 100, 92], alpha: 0.6 });
}

// ------------------------------------------------------------------ stencil paint
// Spray-stencilled text with stencil bridges in the round glyphs, soft edges,
// overspray and wear. o: { font, size, align, sx, spacing, color, alpha, wear, seed, bridge }
const BRIDGED = new Set([...'OQDBPRA0689CGU4']);
export function stencil(s, str, x, y, o = {}) {
  const size = o.size ?? 24, font = o.font || `bold ${size}px "DejaVu Sans", sans-serif`, sx = o.sx ?? 1, sp = o.spacing ?? 0;
  const m = s.mask((g) => {
    g.font = font; g.textBaseline = 'alphabetic';
    const chars = [...str], ws = chars.map((c) => g.measureText(c).width);
    const total = (ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) * sx;
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    g.save(); g.translate(cx, y); g.scale(sx, 1);
    let px = 0;
    chars.forEach((c, k) => {
      g.fillStyle = '#fff'; g.fillText(c, px, 0);
      if (o.bridge !== false && BRIDGED.has(c)) { g.fillStyle = '#000'; const bw = Math.max(1.2, size * 0.07); g.fillRect(px + ws[k] / 2 - bw / 2, -size, bw, size * 1.2); }
      px += ws[k] + sp;
    });
    g.restore();
  }, { wrap: o.wrap ?? false });
  paintMask(s, m, o.color || DP.white, o);
  return m;
}
// Spray-paint a coverage mask with soft edges, speckle, wear and a little paint height.
export function paintMask(s, m, color, o = {}) {
  const seed = o.seed ?? 3, soft = s.blur(m, 0.8, 1), over = o.over ? s.blur(m, 3, 2) : null;
  const wear = o.wear ?? 0.35;
  for (let i = 0; i < s.n; i++) {
    const x = i % s.w, y = (i / s.w) | 0;
    let a = soft[i];
    if (over) a = Math.max(a, over[i] * 0.15 * (hash(x, y, seed) < 0.5 ? 1 : 0.4));
    if (a < 0.01) continue;
    const wn = fbm(x / s.w, y / s.h, 16, 16, 3, seed + 1), sp = hash(x, y, seed + 2);
    a *= sstep(wear - 0.1, wear + 0.12, wn + 0.25) * (0.82 + sp * 0.18);
    if (sp < 0.04) a *= 0.3;
    s.setC(i, color, clamp(a) * (o.alpha ?? 0.92));
    s.H[i] += a * 0.25;
  }
}

// ------------------------------------------------------------------ caged bulkhead lamp
// cast base, glass globe (emissive when lit), wire guard, and a glow on the wall.
export function cagedLamp(s, cx, cy, o = {}) {
  const R = o.r ?? 12, lit = o.lit ?? true, col = o.color || DP.lamp;
  s.rect(cx - R - 5, cy - R - 7, cx + R + 5, cy + R + 7, { h: 6, bevel: 3, op: 'max', color: o.base || [70, 74, 70], r: 5, spec: 0.4 });
  for (const [bx, by] of [[cx - R - 1, cy - R - 3], [cx + R + 1, cy - R - 3], [cx - R - 1, cy + R + 3], [cx + R + 1, cy + R + 3]]) s.bolt(bx, by, 1.4, { h: 0.8 });
  const gm = s.mask((g) => { g.beginPath(); g.ellipse(cx, cy, R * 0.82, R, 0, 0, 7); g.fill(); }, { wrap: false });
  s.apply(gm, { h: 10, bevel: R * 0.8, op: 'max', color: lit ? mixc(col, [255, 255, 255], 0.35) : [120, 112, 92], spec: 1 });
  if (lit) { s.apply(gm, { E: col, eAlpha: 0.95 }); s.glow(gm, col, o.halo ?? 14, o.haloK ?? 0.55); s.glow(gm, mixc(col, [255, 255, 255], 0.5), 3, 0.35); }
  // wire guard: vertical bars + two rings
  const wire = o.wire || [46, 46, 44];
  for (let k = -2; k <= 2; k++) {
    const x = cx + k * R * 0.36, yy = Math.sqrt(Math.max(0, 1 - Math.pow(k * 0.36 / 0.82, 2))) * R;
    s.seg(x, cy - yy - 1, x, cy + yy + 1, 0.8, { h: 13, op: 'max', bevel: 0.8, prof: 'round', color: wire, spec: 0.6 });
  }
  s.stamp((px, py) => Math.abs(Math.hypot((px - cx) / (R * 0.86), (py - cy) / (R * 1.04)) - 1) * R - 0.8, [cx - R - 2, cy - R - 2, cx + R + 2, cy + R + 2], { h: 12.5, op: 'max', bevel: 0.8, prof: 'round', color: wire, spec: 0.6 });
  s.seg(cx - R * 0.82, cy, cx + R * 0.82, cy, 0.8, { h: 13.5, op: 'max', bevel: 0.8, prof: 'round', color: wire, spec: 0.6 });
  return gm;
}

// Worn hazard stripes over a rectangle (paint chips to steel/concrete underneath)
export function hazardRect(s, x0, y0, x1, y1, o = {}) {
  const per = o.period ?? 32, seed = o.seed ?? 5, a = o.a || DP.yellow, b = o.b || DP.black;
  s.rect(x0, y0, x1, y1, {
    h: o.h, bevel: o.bevel ?? 1, op: o.op || 'add',
    fn: (i, cov, t, d, px, py) => {
      const c = fract((px + py * (o.dir ?? 1)) / per) < 0.5 ? a : b;
      const chip = fbm(mod(px, s.w) / s.w, mod(py, s.h) / s.h, 24, 24, 3, seed);
      const worn = chip < (o.wear ?? 0.3);
      s.setC(i, worn ? (o.under || [110, 110, 106]) : c, cov);
      if (worn) s.H[i] -= 0.4 * cov;
    },
  });
}

// Rusted steel colour at (u,v): paint remnants over rust, pitting; returns [colour, heightDelta, spec]
export function rustAt(u, v, x, y, seed, paint = DP.govGrey, amount = 0.6) {
  const r1 = fbm(u, v, 4, 4, 5, seed), r2 = fbm(u, v, 16, 16, 3, seed + 1), g = hash(x, y, seed + 2);
  const rusty = sstep(1 - amount - 0.08, 1 - amount + 0.08, r1 * 0.75 + r2 * 0.35);
  const rc = mixc(DP.rust, r2 > 0.55 ? DP.rustLt : DP.rustDk, Math.abs(r2 - 0.5) * 1.6);
  const pc = mixc(paint, [paint[0] * 0.8, paint[1] * 0.8, paint[2] * 0.8], r2);
  let c = mixc(pc, rc, rusty);
  const r3 = fbm(u, v, 2, 2, 4, seed + 3), k = (0.9 + (g - 0.5) * 0.1 + (r2 - 0.5) * 0.14) * (0.78 + r3 * 0.36);
  c = [c[0] * k, c[1] * k, c[2] * k];
  const pitH = rusty > 0.5 && g < 0.035 ? -0.7 : 0;
  return [c, rusty * -0.5 + pitH + (r2 - 0.5) * 0.5, mix(0.5, 0.08, rusty)];
}

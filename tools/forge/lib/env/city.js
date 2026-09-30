// MAP02 Washington D.C. (Duke Nukem 3D seedy, late 90s): bricks, spray paint,
// torn posters and glass.
import { clamp, mix, sstep, fbm, vn, worley, fract, mod, rng, hash } from './tex.js';

export const CP = {
  brick: [148, 64, 46], brickDk: [78, 52, 44], mortar: [118, 110, 100], mortarDk: [70, 66, 60],
  sodium: [255, 170, 70], night: [26, 34, 56], soot: [30, 28, 28], stucco: [150, 140, 124],
};
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// Running-bond brick over the rect [x0,y0,x1,y1) (default: whole texture). o: { bw, bh, m, col, mortar, vari, seed, burnt, chip }
export function bricks(s, o = {}) {
  const bw = o.bw ?? 32, bh = o.bh ?? 16, m = o.m ?? 2.2, seed = o.seed ?? 1;
  const col = o.col || CP.brick, mc = o.mortar || CP.mortar, vari = o.vari ?? 0.2;
  const [X0, Y0, X1, Y1] = o.rect || [0, 0, s.w, s.h];
  const ncol = Math.round(s.w / bw);
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const i = mod(y, s.h) * s.w + mod(x, s.w), u = mod(x, s.w) / s.w, v = mod(y, s.h) / s.h;
    const row = Math.floor(y / bh), off = (row % 2) * bw / 2, bx = x + off, c = Math.floor(bx / bw);
    const fx = bx - c * bw, fy = y - row * bh, id = hash(mod(c, ncol), mod(row, Math.round(s.h / bh)), seed);
    const chip = (fbm(u, v, 32, 32, 3, seed + 3) - 0.5) * (o.chip ?? 2.4);
    const d = Math.min(fx - m / 2, bw - m / 2 - fx, fy - m / 2, bh - m / 2 - fy) + chip;
    const n = fbm(u, v, 16, 16, 3, seed + 5), g = hash(x, y, seed + 7);
    if (d <= 0) {
      const k = 0.85 + n * 0.25 + (g - 0.5) * 0.15;
      s.setC(i, [mc[0] * k, mc[1] * k, mc[2] * k]); s.H[i] = 0.3 + n * 0.5;
    } else {
      let k = 1 + (id - 0.5) * 2 * vari, bc = col;
      if (o.burnt && hash(c, row, seed + 9) < o.burnt) bc = mixc(col, [50, 34, 30], 0.6);
      if (hash(c, row, seed + 11) < 0.08) bc = mixc(bc, [184, 120, 88], 0.4);   // a paler brick here and there
      k *= 0.86 + n * 0.22 + (g - 0.5) * 0.14;
      s.setC(i, [bc[0] * k, bc[1] * k, bc[2] * k * 0.98]);
      s.H[i] = 2.4 * clamp(d / 1.6) + n * 0.9 + (g - 0.5) * 0.3;
    }
  }
}

// Spray paint: mask from a canvas drawing, soft overspray, speckle breakup and drips.
export function spray(s, draw, color, o = {}) {
  const m = s.mask(draw, { wrap: o.wrap ?? false });
  const soft = s.blur(m, o.soft ?? 1, 1), over = s.blur(m, o.over ?? 4, 2);
  const r = rng(o.seed ?? 1);
  for (let i = 0; i < s.n; i++) {
    const x = i % s.w, y = (i / s.w) | 0;
    const a = soft[i] * (0.82 + 0.18 * hash(x, y, o.seed ?? 1)) + over[i] * 0.18 * (hash(x >> 1, y >> 1, 7) < 0.5 ? 1 : 0.3);
    if (a > 0.01) s.setC(i, color, clamp(a) * (o.alpha ?? 0.92));
  }
  // drips: from the lower edges of the paint
  if (o.drips) for (let k = 0; k < o.drips; k++) {
    for (let t = 0; t < 60; t++) {
      const x = Math.floor(r() * s.w), y = Math.floor(r() * s.h), i = y * s.w + x;
      if (m[i] > 0.6 && m[mod(y + 2, s.h) * s.w + x] < 0.2) {
        const L = 4 + r() * 24;
        s.seg(x, y, x + (r() - 0.5), y + L, 0.7 + r() * 0.5, { color, alpha: 0.85 });
        s.circle(x, y + L, 1.3, { color, alpha: 0.85 });
        break;
      }
    }
  }
  return m;
}

// A torn paper poster drawn by fn(g, w, h) into [x0,y0,x0+w,y0+h] with a ragged outline, wrinkles and fading.
export function poster(s, x0, y0, w, h, fn, o = {}) {
  const r = rng(o.seed ?? 1);
  const pts = [];
  const rag = (a, b, n, fixed) => { for (let k = 0; k <= n; k++) { const t = k / n; pts.push([mix(a[0], b[0], t) + (fixed ? 0 : (r() - 0.5) * (o.tear ?? 6)), mix(a[1], b[1], t) + (fixed ? 0 : (r() - 0.5) * (o.tear ?? 6))]); } };
  const torn = o.torn ?? 0.5;
  rag([x0, y0], [x0 + w, y0], 8, r() > torn); rag([x0 + w, y0], [x0 + w, y0 + h], 8, r() > torn);
  rag([x0 + w, y0 + h], [x0, y0 + h], 8, r() > torn); rag([x0, y0 + h], [x0, y0], 8, r() > torn);
  const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
  const g = c.getContext('2d');
  // drawn at the 3x3 wrap offsets so a poster crossing an edge continues on the far side
  for (const oy of [-s.h, 0, s.h]) for (const ox of [-s.w, 0, s.w]) {
    g.save(); g.translate(ox, oy);
    g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
    g.translate(x0, y0); fn(g, w, h); g.restore();
  }
  const d = g.getImageData(0, 0, s.w, s.h).data;
  const fade = o.fade ?? 0.2;
  for (let i = 0; i < s.n; i++) {
    const a = d[i * 4 + 3] / 255; if (!a) continue;
    const x = i % s.w, y = (i / s.w) | 0;
    const wr = fbm(x / s.w, y / s.h, 24, 24, 3, (o.seed ?? 1) + 3);
    let col = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    col = mixc(col, [200, 196, 180], fade);
    const k = 0.85 + wr * 0.25; col = [col[0] * k, col[1] * k, col[2] * k];
    s.setC(i, col, a);
    s.H[i] += a * (1 + (wr - 0.5) * 1.6);
  }
}

// Neon signs: a single-stroke tube font (4 x 6 grid, y down) and a painter
// that lays tubes on a Surf with a white-hot core, saturated glass and a soft
// halo on the wall behind.
const O = [[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]];
const Pb = [[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]];
export const GLYPHS = {
  A: [[[0, 6], [2, 0], [4, 6]], [[0.7, 4], [3.3, 4]]],
  B: [[[0, 6], [0, 0], [3, 0], [4, 0.8], [4, 2.2], [3, 3], [0, 3]], [[3, 3], [4, 3.8], [4, 5.2], [3, 6], [0, 6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.5], [2.2, 3.5]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[2, 0], [2, 6]], [[1, 0], [3, 0]], [[1, 6], [3, 6]]],
  J: [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.4, 2.6], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3.6], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [O],
  P: [Pb],
  Q: [O, [[2.5, 4.5], [4.2, 6.3]]],
  R: [Pb, [[2, 3], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  0: [O, [[3.5, 0.8], [0.5, 5.2]]],
  1: [[[1, 1], [2, 0], [2, 6]], [[1, 6], [3, 6]]],
  2: [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [0, 6], [4, 6]]],
  3: [[[0, 0], [4, 0], [2, 2.5], [3, 2.5], [4, 3.5], [4, 5], [3, 6], [1, 6], [0, 5]]],
  4: [[[3, 6], [3, 0], [0, 4], [4, 4]]],
  5: [[[4, 0], [0, 0], [0, 2.5], [3, 2.5], [4, 3.5], [4, 5], [3, 6], [0, 6]]],
  6: [[[4, 0.5], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.8], [3, 2.8], [0, 2.8]]],
  7: [[[0, 0], [4, 0], [1.5, 6]]],
  8: [[[1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]]],
  9: [[[4, 3.2], [1, 3.2], [0, 2.2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6]]],
  '-': [[[1, 3], [3, 3]]], '.': [[[2, 5.8], [2, 6]]], '!': [[[2, 0], [2, 4.2]], [[2, 5.8], [2, 6]]], "'": [[[2, 0], [2, 1.6]]],
  '+': [[[2, 1.5], [2, 4.5]], [[0.5, 3], [3.5, 3]]], '&': [[[4, 6], [0.8, 2], [0.8, 0.8], [1.6, 0], [2.6, 0.6], [2.4, 1.8], [0, 4], [0, 5.2], [1, 6], [2.6, 6], [4, 3.8]]],
  ' ': [],
};

// Stroke paths for a string: returns [[[x,y],...], ...] in pixels. size = cap height (px); slant = italic shear
export function strokes(str, x, y, size, { spacing = 1.6, slant = 0, align = 'left', wide = 1 } = {}) {
  const k = size / 6, adv = (4 * wide + spacing) * k;
  const total = str.length * adv - spacing * k;
  let x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const out = [];
  for (const ch of str.toUpperCase()) {
    for (const st of GLYPHS[ch] || []) out.push(st.map(([gx, gy]) => [x0 + gx * wide * k + (6 - gy) * k * slant, y + gy * k - size]));
    x0 += adv;
  }
  return out;
}
export function strokeWidth(str, size, { spacing = 1.6, wide = 1 } = {}) { const k = size / 6; return str.length * (4 * wide + spacing) * k - spacing * k; }

// Paint neon tubes. paths: stroke list; o: { color, width (px), core, halo (px), glowK, mounts }
export function neon(s, paths, o = {}) {
  const col = o.color || [255, 60, 160], wd = o.width ?? 3.2;
  const draw = (lw) => (g) => { g.lineCap = g.lineJoin = 'round'; g.lineWidth = lw; for (const p of paths) { g.beginPath(); p.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); if (p.length === 1) g.lineTo(p[0][0] + 0.01, p[0][1]); g.stroke(); } };
  const tube = s.mask(draw(wd), { wrap: false }), core = s.mask(draw(Math.max(0.8, wd * 0.38)), { wrap: false });
  // halo on the wall (added before so the tube stays crisp)
  s.glow(tube, col, o.halo ?? 9, o.glowK ?? 0.55);
  s.glow(tube, col, (o.halo ?? 9) * 0.35, (o.glowK ?? 0.55) * 0.8);
  s.apply(tube, { color: [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], E: col, eAlpha: 0.75, h: wd * 0.5, spec: 0.8 });
  const hot = o.core || [Math.min(255, col[0] * 0.4 + 170), Math.min(255, col[1] * 0.4 + 170), Math.min(255, col[2] * 0.4 + 170)];
  s.apply(core, { E: hot, eAlpha: 0.7 });
  if (o.mounts !== false) for (const p of paths) for (let k = 0; k < p.length; k += 3) s.circle(p[k][0], p[k][1] + wd, 0.9, { color: [30, 30, 30], h: 1 });
  return tube;
}

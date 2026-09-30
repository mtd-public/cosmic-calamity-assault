// Alien materials shared by the lab overgrowth (MAP01), the saucer (MAP03) and
// the mothership (MAP04): violet hull plating, bone ribs, teal bioluminescent
// seams and creeping veins.
import { Surf, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash } from './tex.js';

export const A = {
  violet: [82, 56, 106], violetLo: [64, 44, 88], violetDk: [40, 28, 56], plum: [58, 34, 62],
  bone: [196, 184, 160], boneDk: [140, 126, 108], teal: [50, 240, 205], tealDk: [20, 110, 100],
  black: [18, 14, 24], flesh: [112, 60, 84],
};
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// Organic hull plates: warped Worley cells with swollen faces, growth-line
// striations, deep seams and a share of the seams glowing teal.
// o: { fx, fy, seed, glow (fraction of glowing seams), base, dark, warp, stria }
export function hullPlates(s, o = {}) {
  const { w, h } = s, fx = o.fx ?? 2, fy = o.fy ?? 3, seed = o.seed ?? 1, wp = o.warp ?? 0.12;
  const base = o.base || A.violet, dark = o.dark || A.black, glowC = o.glowC || A.teal;
  const E = new Float32Array(s.n);
  s.each((u, v, x, y, i) => {
    const wu = u + (fbm(u, v, 3, 3, 3, seed + 3) - 0.5) * wp, wv = v + (fbm(u, v, 3, 3, 3, seed + 4) - 0.5) * wp;
    const [f1, f2, id] = worley(mod(wu, 1), mod(wv, 1), fx, fy, seed, 0.8);
    const e = f2 - f1;
    const dome = sstep(0.0, 0.45, e);
    const n = fbm(u, v, 6, 6, 4, seed + 5);
    const n2 = fbm(u, v, 24, 24, 2, seed + 9);
    const stria = Math.sin(e * (o.stria ?? 38) + n * 9 + n2 * 3) * 0.5 + 0.5;
    s.H[i] = dome * 9 + (1 - f1) * 2 + stria * 0.2 * dome + (n - 0.5) * 1.6 + (n2 - 0.5) * 0.8;
    const sheen = 0.5 + 0.5 * Math.sin((u * 1.5 + v * 2.5 + n * 0.8) * 6.283 + hash(id, 1, seed) * 6);
    let c = mixc(base, mixc(base, [118, 84, 140], 0.6), sheen * (o.iri ?? 0.4));
    c = mixc(c, dark, clamp(1 - e / 0.14) * 0.9);
    const k = 0.8 + n * 0.3 + hash(id, 2, seed) * 0.12 + stria * 0.05;
    s.setC(i, [c[0] * k, c[1] * k, c[2] * k]);
    s.S[i] = 0.7 * dome;
    if (e < 0.06) {
      s.H[i] -= (1 - e / 0.06) * 4;
      if (hash(id, 9, seed) < (o.glow ?? 0.35)) E[i] = clamp(1 - e / 0.03);
    }
  });
  // glowing seams with a soft halo
  const halo = s.blur(E, 3, 2);
  for (let i = 0; i < s.n; i++) {
    if (E[i] > 0) { s.addE(i, glowC, E[i] * E[i] * 0.9); s.setC(i, mixc(s.getC(i), glowC, E[i] * 0.5)); }
    if (halo[i] > 0.01) s.addE(i, glowC, halo[i] * 0.35);
  }
  return s;
}

// Bone ribs running vertically (or horizontally), swelling and tapering, with
// knuckles. o: { n, width, h, axis, seed, color, sway }
export function boneRibs(s, o = {}) {
  const { w, h } = s, n = o.n ?? 4, seed = o.seed ?? 7, width = o.width ?? 14, H0 = o.h ?? 12, col = o.color || A.bone;
  const vert = (o.axis ?? 'v') === 'v';
  const L = vert ? w : h;
  s.each((u, v, x, y, i) => {
    const a = vert ? u : v, b = vert ? v : u;
    const warp = (fbm(vert ? 0.5 : u, vert ? v : 0.5, 2, 2, 3, seed) - 0.5) * 0.1 + Math.sin(b * 6.283 * (o.waves ?? 1)) * (o.sway ?? 0.012);
    const ribIdx = Math.floor((a + warp) * n);
    const t = fract((a + warp) * n);
    const d = Math.abs(t - 0.5) * L / n;
    const knuckle = Math.pow(Math.abs(Math.sin((b * (o.knuckles ?? 3) + hash(mod(ribIdx, n), 3, seed)) * Math.PI)), 6);
    const r = width / 2 * (0.8 + 0.25 * vn(vert ? 0 : u, vert ? v : 0, 1, 4, seed + 1) + knuckle * 0.3);
    if (d > r + 1.5) return;
    const cov = clamp(r + 0.5 - d);
    const prof = Math.sqrt(Math.max(0, 1 - (d / r) * (d / r)));
    const hh = prof * H0 * (0.9 + knuckle * 0.3) + 4;
    s.H[i] = mix(s.H[i], Math.max(s.H[i], hh), cov);
    const nn = fbm(u, v, 12, 12, 3, seed + 2), grain = fbm(u, v, vert ? 40 : 4, vert ? 4 : 40, 2, seed + 8);
    const c = mixc(col, A.boneDk, clamp(0.15 + (1 - prof) * 0.55 + (nn - 0.5) * 0.5 + grain * 0.2));
    s.setC(i, c, cov); s.S[i] = mix(s.S[i], 0.45, cov);
  });
  return s;
}

// Creeping veins over any surface: branching random walks. o: { count, seed, r0, color, glow, stain }
export function veins(s, o = {}) {
  const { w, h } = s, r = rng(o.seed ?? 3);
  const paths = [];
  const walk = (x, y, ang, rad, depth) => {
    const pts = [[x, y, rad]];
    let a = ang;
    const steps = 10 + Math.floor(r() * 16);
    for (let k = 0; k < steps; k++) {
      a += (r() - 0.5) * 0.7;
      const L = 5 + r() * 6;
      x += Math.cos(a) * L; y += Math.sin(a) * L; rad *= 0.94;
      pts.push([x, y, Math.max(0.8, rad)]);
      if (depth < 3 && r() < 0.12) walk(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), rad * 0.7, depth + 1);
      if (rad < 0.9) break;
    }
    paths.push(pts);
  };
  for (let k = 0; k < (o.count ?? 6); k++) walk(r() * w, r() * h, r() * Math.PI * 2, (o.r0 ?? 5) * (0.6 + r() * 0.6), 0);
  // stain halo on the host surface
  if (o.stain !== false) {
    const m = s.mask((g) => { g.lineCap = g.lineJoin = 'round'; for (const p of paths) for (let k = 0; k < p.length - 1; k++) { g.lineWidth = p[k][2] * 2 + 10; g.beginPath(); g.moveTo(p[k][0], p[k][1]); g.lineTo(p[k + 1][0], p[k + 1][1]); g.stroke(); } });
    const b = s.blur(m, 6, 2);
    for (let i = 0; i < s.n; i++) if (b[i] > 0.01) s.setC(i, o.stainC || [70, 46, 70], b[i] * 0.45);
  }
  const col = o.color || A.plum;
  for (const p of paths) s.tube(p, 3, { h: 5, bevel: 4, prof: 'round', op: 'max', color: col, spec: 0.8 });
  // glowing cores only in the thickest runs, dim, with a faint halo
  if (o.glow !== false) {
    const core = s.mask((g) => { g.lineCap = g.lineJoin = 'round'; for (const p of paths) for (let k = 0; k < p.length - 1; k++) { if (p[k][2] < 3.2) continue; g.lineWidth = p[k][2] * 0.38; g.beginPath(); g.moveTo(p[k][0], p[k][1]); g.lineTo(p[k + 1][0], p[k + 1][1]); g.stroke(); } });
    s.apply(core, { E: o.glowC || A.teal, eAlpha: 0.45, color: mixc(col, o.glowC || A.teal, 0.45) });
    s.glow(core, o.glowC || A.teal, 4, 0.2);
  }
  // nodules
  for (const p of paths) if (r() < 0.6) { const q = p[Math.floor(r() * p.length)]; s.circle(q[0], q[1], q[2] + 2.5, { h: q[2] + 5, bevel: q[2] + 2.5, prof: 'round', op: 'max', color: mixc(col, A.flesh, 0.4), spec: 0.8 }); }
  return paths;
}

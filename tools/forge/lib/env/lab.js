// Area 51 / S-4 lab look (Half-Life 1 Black Mesa, gone wrong): shared palette
// and the beige panel wall that several textures are built on (LABWALL1/2,
// switches, signs, posters, the alien-overgrown wall).
import { Surf, clamp, mix, sstep, fbm, vn, fract, mod, rng, hash } from './tex.js';

export const P = {
  beige: [200, 189, 160], beigeLo: [184, 172, 142], tan: [150, 134, 104], tanDk: [112, 98, 76],
  cream: [214, 208, 190], base: [66, 63, 60], baseDk: [44, 42, 41],
  orange: [206, 110, 36], orangeDk: [150, 70, 26], brown: [96, 64, 40],
  steel: [132, 136, 138], steelLo: [104, 108, 112], steelDk: [70, 74, 78], gunmetal: [52, 55, 60],
  alu: [168, 172, 174], hazard: [226, 178, 34], black: [28, 27, 26],
  grime: [74, 66, 52], rust: [120, 70, 36], soot: [36, 34, 32],
  conc: [148, 144, 136], concDk: [118, 115, 108],
  violet: [92, 64, 118], violetDk: [48, 34, 66], bone: [196, 186, 162], teal: [60, 240, 210],
  red: [255, 40, 30], green: [60, 255, 90], amber: [255, 170, 40],
};

// A full-width horizontal band [y0, y1): dist-based so it tiles; o like stamp()
export function hband(s, y0, y1, o = {}) {
  return s.stamp((px, py) => Math.max(y0 - py, py - y1), [0, y0, s.w - 1, y1], { op: 'set', ...o });
}
export function vband(s, x0, x1, o = {}) {
  return s.stamp((px, py) => Math.max(x0 - px, px - x1), [x0, 0, x1, s.h - 1], { op: 'set', ...o });
}

// Weathering pass common to lab walls: mottling, grain, faint bottom grime.
export function labWeather(s, { seed = 1, grime = 0.22, mottle = 0.05 } = {}) {
  s.mottle(mottle, 4, 4, 4, seed);
  s.mottle(0.025, 24, 24, 2, seed + 1);
  s.grain(0.018, seed + 2);
  // grime rising from the floor (last 20%) and a faint ceiling shadow so the vertical wrap matches
  s.grime(P.grime, (u, v) => sstep(0.8, 1.0, v) * grime + sstep(0.12, 0.0, v) * grime * 0.45, { fx: 16, fy: 4, seed: seed + 3 });
  return s;
}

// The beige lab panel wall. Two 128-px panels per 256 px, an engraved inset
// line in the upper panel, a tan chair rail and screws at the panel corners.
// opts.stripe: paint an orange band across the upper panel (LABWALL2).
export function labWall(s, o = {}) {
  const { w, h } = s, pw = o.pw ?? 128;
  const railT = Math.round(h * 0.585), railB = railT + 16;
  s.fill(P.beige, 0.06);
  // panel colour drift (paint batches)
  for (let x = 0; x < w; x += pw) {
    const k = 0.97 + hash(x, 1, o.seed ?? 3) * 0.06;
    const col = [P.beige[0] * k, P.beige[1] * k, P.beige[2] * k * 0.99];
    s.rect(x + 1.5, 1.5, x + pw - 1.5, railT - 1.5, { h: 3, bevel: 2.2, op: 'set', color: col, prof: 'smooth' });
    s.rect(x + 1.5, railB + 1.5, x + pw - 1.5, h - 1.5, { h: 3, bevel: 2.2, op: 'set', color: col, prof: 'smooth' });
    // engraved inset line in the upper panel
    if (o.inset !== false) {
      s.stamp((px, py) => Math.abs(sdBox(px, py, x + pw / 2, railT / 2, pw / 2 - 14, railT / 2 - 14, 3)) - 0.9, [x + 10, 10, x + pw - 10, railT - 10], { h: 1.4, op: 'sub', bevel: 0.9 });
    }
    // screws
    for (const [sx, sy] of [[x + 7, 7], [x + pw - 7, 7], [x + 7, railT - 7], [x + pw - 7, railT - 7], [x + 7, railB + 7], [x + pw - 7, railB + 7], [x + 7, h - 7], [x + pw - 7, h - 7]])
      s.bolt(sx, sy, 1.9, { h: 1.2, color: P.steelLo, slot: true, spec: 0.4, ring: 0.85 });
  }
  // chair rail
  hband(s, railT, railB, { h: 5, bevel: 3, color: P.tan, prof: 'round', spec: 0.15 });
  hband(s, railT + 7, railT + 9, { h: 3.6, bevel: 1, color: mix3(P.tan, P.tanDk, 0.6) });
  if (o.stripe) {
    const y0 = railT - 44, y1 = railT - 24;
    s.stamp((px, py) => Math.max(y0 - py, py - y1), [0, y0, w - 1, y1], { color: P.orange, alpha: 0.95 });
    s.stamp((px, py) => Math.max(y1 + 5 - py, py - (y1 + 8)), [0, y1 + 5, w - 1, y1 + 8], { color: P.brown, alpha: 0.9 });
  }
  labWeather(s, { seed: o.seed ?? 3, grime: o.grime ?? 0.2 });
  // soft smudges at hand height and a few knocks at boot height
  const r = rng(o.seed ?? 3);
  for (let k = 0; k < 5; k++) {
    const x = r() * w, y = railB - 30 + r() * 50;
    s.circle(x, y, 6 + r() * 10, { color: P.grime, alpha: 0.05 + r() * 0.05, bevel: 12, aa: 10 });
  }
  for (let k = 0; k < 6; k++) {
    const x = r() * w, y = h - 12 - r() * 30, L = 2 + r() * 5;
    s.seg(x, y, x + L, y + (r() - 0.5) * 2, 0.6, { color: [120, 108, 88], alpha: 0.3 });
  }
  return { railT, railB };
}
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
function sdBox(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
export { mix3 };

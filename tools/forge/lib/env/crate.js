// Government-warehouse crates (Raiders of the Lost Ark): pale pine planks in a
// dark batten frame, nails, knots and spray-stencilled markings. Shared by
// CRATEWAL, CRATETOP and the DCRT prop so they match.
import { clamp, mix, sstep, fbm, vn, fract, mod, rng, hash, textMask, textWidth } from './tex.js';

export const PINE = [206, 174, 122], PINE_LO = [170, 136, 90], BATTEN = [146, 112, 74], STENCIL = [30, 26, 22];

// Paint a crate face into the rectangle [x0,y0,x1,y1) (may extend past the texture: it wraps).
// o: { seed, plank (px), batten (px), brace ('z'|'x'|null), stencil: [[text, relY, sizePx, opts]...], dir: 'h'|'v', tone }
export function crateFace(s, x0, y0, x1, y1, o = {}) {
  const seed = o.seed ?? 1, pl = o.plank ?? 22, bw = o.batten ?? 12, r = rng(seed);
  const tone = o.tone ?? (0.9 + r() * 0.16);
  const W = x1 - x0, H = y1 - y0, vert = o.dir === 'v';
  // the face: gap shadow around it, planks inside
  s.rect(x0, y0, x1, y1, { h: 0, bevel: 1, op: 'set', color: [36, 30, 24], occl: 0.6 });
  s.rect(x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, {
    h: 5, bevel: 1.2, op: 'set', fn: (i, cov, t, d, px, py) => {
      const lx = px - x0, ly = py - y0, a = vert ? lx : ly, b = vert ? ly : lx;
      const k = Math.floor(a / pl), fa = a - k * pl;
      const pt = hash(k, seed, 7) * 0.14 - 0.07;
      const grain = fbm((b + k * 37) / 256, fa / 256, 2, 48, 3, seed + k) * 0.25 + fbm((b + k * 37) / 256, a / 256, 16, 2, 2, seed + 3) * 0.1;
      const u = 0.86 + pt + grain;
      let c = [PINE[0] * u * tone, PINE[1] * u * tone, PINE[2] * u * tone];
      // plank gaps
      const gap = fa < 1.2 ? 0.55 : fa < 2 ? 0.85 : 1;
      c = [c[0] * gap, c[1] * gap, c[2] * gap];
      s.setC(i, c, cov);
      if (fa < 1.5) s.H[i] -= 1.5 * cov;
      s.H[i] += (grain - 0.2) * 0.8;
    },
  });
  // knots
  for (let k = 0; k < Math.round(W * H / 3500); k++) {
    const kx = x0 + bw + r() * (W - 2 * bw), ky = y0 + bw + r() * (H - 2 * bw), rr = 1.5 + r() * 2;
    s.stamp((px, py) => Math.hypot((px - kx) / (vert ? 1 : 1.8), (py - ky) / (vert ? 1.8 : 1)) - rr, [kx - rr * 2, ky - rr * 2, kx + rr * 2, ky + rr * 2], { color: [110, 76, 44], alpha: 0.8 });
  }
  // brace
  const bat = (ax, ay, bx, by) => s.seg(ax, ay, bx, by, bw / 2, { h: 9, bevel: 1.5, op: 'max', color: (px, py) => { const g = fbm(px / 256, py / 256, 24, 24, 2, seed + 9); return [BATTEN[0] * (0.85 + g * 0.3) * tone, BATTEN[1] * (0.85 + g * 0.3) * tone, BATTEN[2] * (0.85 + g * 0.3) * tone]; } });
  if (o.brace === 'z') bat(x0 + bw, y1 - bw, x1 - bw, y0 + bw);
  if (o.brace === 'x') { bat(x0 + bw, y1 - bw, x1 - bw, y0 + bw); bat(x0 + bw, y0 + bw, x1 - bw, y1 - bw); }
  // frame battens
  const frame = (ax0, ay0, ax1, ay1) => s.rect(ax0, ay0, ax1, ay1, { h: 10, bevel: 1.5, op: 'max', color: (px, py) => { const g = fbm(px / 256, py / 256, 32, 4, 2, seed + 11); return [BATTEN[0] * (0.85 + g * 0.3) * tone, BATTEN[1] * (0.85 + g * 0.3) * tone, BATTEN[2] * (0.85 + g * 0.3) * tone]; } });
  frame(x0 + 1.5, y0 + 1.5, x1 - 1.5, y0 + bw); frame(x0 + 1.5, y1 - bw, x1 - 1.5, y1 - 1.5);
  frame(x0 + 1.5, y0 + 1.5, x0 + bw, y1 - 1.5); frame(x1 - bw, y0 + 1.5, x1 - 1.5, y1 - 1.5);
  // nails at the batten corners
  for (const [nx, ny] of [[x0 + bw / 2 + 1, y0 + bw / 2 + 1], [x1 - bw / 2 - 1, y0 + bw / 2 + 1], [x0 + bw / 2 + 1, y1 - bw / 2 - 1], [x1 - bw / 2 - 1, y1 - bw / 2 - 1]])
    for (const [dx, dy] of [[-2.5, -2], [2.5, 2]]) s.circle(nx + dx, ny + dy, 0.9, { color: [50, 44, 40], h: 0.3, op: 'add', spec: 0.4 });
  // stencils
  for (const [text, ry, size, so] of o.stencil || []) {
    const cx = x0 + W / 2 + (so?.dx ?? 0), cy = y0 + H * ry;
    const font = `bold ${size}px "DejaVu Sans Mono", monospace`;
    const fitW = W - 2 * bw - 8, tw = textWidth(text, font, 1, so?.sp ?? 1);
    const m = textMask(s, text, cx, cy, { font, align: 'center', sx: Math.min(so?.sx ?? 0.8, fitW / tw), spacing: so?.sp ?? 1, wrap: true });
    const col = so?.color || STENCIL;
    for (let i = 0; i < s.n; i++) {
      if (m[i] <= 0.01) continue;
      const x = i % s.w, y = (i / s.w) | 0;
      const spray = 0.55 + 0.45 * vn(x / s.w, y / s.h, 64, 64, seed + 21) - (hash(x, y, seed) < 0.12 ? 0.35 : 0);
      s.setC(i, col, clamp(m[i] * spray * (so?.alpha ?? 0.9)));
    }
  }
  // dust on top edges, grime at the bottom
  s.grime([120, 104, 80], (u, v, x, y) => { const ly = mod(y - y0, s.h); return ly >= 0 && ly < H && mod(x - x0, s.w) < W ? sstep(H * 0.7, H, ly) * 0.35 : 0; }, { seed: seed + 5, fx: 16, fy: 16 });
}

// A stencil set pool so crates in a stack differ
export const STENCILS = [
  [['ARMY INTEL', 0.38, 20], ['DO NOT OPEN', 0.56, 16], ['9 52 0341-C', 0.78, 11]],
  [['TOP SECRET', 0.42, 18], ['51-7730-A', 0.62, 12]],
  [['DO NOT OPEN', 0.45, 18], ['ARMY INTEL', 0.64, 12]],
  [['HANDLE WITH CARE', 0.3, 11], ['▲ THIS SIDE UP ▲', 0.82, 10]],
  [['CLASSIFIED', 0.5, 18]],
  [['PROJECT GRUDGE', 0.4, 12], ['NO. 4471-B', 0.6, 12]],
  [['S-4', 0.5, 30]],
  [],
  [['51-0917-D', 0.2, 10]],
  [['FRAGILE', 0.5, 12]],
];

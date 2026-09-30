// MAP01 outdoors (desert yard at night) and the government warehouse (Raiders of the Lost Ark).
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash, textMask } from '../lib/env/tex.js';
import { P, hband, vband, mix3 } from '../lib/env/lab.js';
import { crateFace, STENCILS } from '../lib/env/crate.js';

export const GOVGREEN = [104, 114, 98];

export default async function (F) {
  const T = async (name, dir, w, h, paint, bake = {}) => {
    const s = new Surf(w, h);
    await paint(s);
    await save(F, dir, name, s.bake(bake));
  };

  // ---------------------------------------------------------------- WHSEWALL: corrugated R-panel, government grey-green
  await T('WHSEWALL', 'textures', 256, 256, (s) => {
    const { w, h } = s, per = 32;
    s.fill(GOVGREEN, 0.35);
    s.each((u, v, x, y, i) => {
      const t = fract(x / per);
      // trapezoid rib: 0.0-0.18 rising, 0.18-0.32 top, 0.32-0.5 falling, pan elsewhere, small stiffener in the pan
      const rib = sstep(0.0, 0.16, t) * (1 - sstep(0.34, 0.5, t));
      const stiff = Math.exp(-Math.pow((t - 0.75) / 0.03, 2)) * 0.25;
      s.H[i] = rib * 7 + stiff * 3;
      const fade = fbm(u, v, 3, 3, 4, 401), n2 = fbm(u, v, 32, 4, 2, 402);
      const k = 0.86 + fade * 0.22 + n2 * 0.06 + rib * 0.04;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
    });
    // lap joint at the top of each sheet (every 128 px) and girt fastener rows
    for (const y0 of [0, 128]) {
      hband(s, y0, y0 + 2, { h: -1, op: 'add', bevel: 1, color: [40, 44, 40] });
      hband(s, y0 + 2, y0 + 6, { h: 1.2, op: 'add', bevel: 1 });
    }
    for (const yy of [12, 72, 140, 200]) for (let x = per * 0.75; x < w; x += per) s.bolt(x, yy, 1.6, { h: 1, color: [150, 150, 140], spec: 0.6 });
    // rust bleeding from the fasteners and lap joints
    s.streaks([118, 74, 40], { amount: 0.55, fx: 8, seed: 403, len: 0.12, start: (u) => 12 / 256 });
    s.streaks([118, 74, 40], { amount: 0.45, fx: 8, seed: 404, len: 0.12, start: (u) => 140 / 256 });
    s.streaks([60, 62, 54], { amount: 0.35, fx: 16, seed: 405, len: 0.5 });
    s.grime([96, 86, 70], (u, v) => sstep(0.72, 1, v) * 0.5 + sstep(0.08, 0, v) * 0.2, { seed: 406, fx: 12, fy: 4 });
    s.grain(0.02, 407);
  }, { specK: 0.9, shadow: 8, light: [-0.6, -0.5, 0.62] });

  // ---------------------------------------------------------------- WHSEDOOR: roll-up door with a stencilled number
  await T('WHSEDOOR', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    const paint = mix3(GOVGREEN, [150, 150, 140], 0.18);
    s.fill(paint, 0.35);
    for (let y = 0; y < h - 18; y += 16) {
      s.stamp((px, py) => Math.max(y - py, py - (y + 16)), [0, y, w - 1, y + 16], {
        h: 1, op: 'set', fn: (i, cov, t, d, px, py) => {
          const ly = py - y;
          // curled slat profile: rounded bead at the top, flat face, hinge groove at the bottom
          const bead = Math.exp(-Math.pow((ly - 3) / 2.2, 2)) * 2.5;
          const face = 3 + Math.sin(ly / 16 * Math.PI) * 1.5;
          const groove = ly > 14.5 ? -3 : 0;
          s.H[i] = face + bead + groove;
        },
      });
    }
    // bottom bar
    hband(s, h - 18, h - 6, { h: 5, bevel: 2, color: [70, 74, 72], spec: 0.5 });
    hband(s, h - 6, h, { h: 3, bevel: 1, color: [22, 22, 22] });
    s.rect(112, h - 16, 144, h - 8, { h: 7, bevel: 2, prof: 'round', color: [150, 150, 146], spec: 0.8 });
    // stencil number + legend (white paint, worn)
    const big = textMask(s, '14', 128, 150, { font: 'bold 120px "DejaVu Sans", sans-serif', align: 'center', sx: 0.85 });
    const leg = textMask(s, 'BLDG 14 — AUTHORIZED ACCESS ONLY', 128, 190, { font: 'bold 12px "DejaVu Sans", sans-serif', align: 'center', sx: 0.9 });
    for (const [m, a] of [[big, 0.85], [leg, 0.8]]) for (let i = 0; i < s.n; i++) {
      if (m[i] <= 0.01) continue;
      const x = i % w, y = (i / w) | 0;
      const wear = fbm(x / w, y / h, 24, 24, 3, 411);
      s.setC(i, [226, 224, 210], m[i] * a * sstep(0.28, 0.45, wear));
    }
    s.mottle(0.1, 4, 4, 4, 412); s.grain(0.02, 413);
    s.streaks([110, 72, 40], { amount: 0.35, fx: 16, seed: 414, len: 0.2 });
    s.grime([80, 74, 60], (u, v) => sstep(0.7, 1, v) * 0.45, { seed: 415, fx: 12, fy: 4 });
    s.edgeWear([176, 176, 168], 0.4, 1, 416);
  }, { specK: 1, shadow: 6, light: [-0.6, -0.5, 0.62] });

  // ---------------------------------------------------------------- CRATEWAL: a wall of stacked crates (tiles both ways)
  await T('CRATEWAL', 'textures', 256, 256, (s) => {
    s.fill([30, 26, 22]);
    const rows = [
      [0, 100, [[0, 120, null, 0], [120, 256, 'z', 8]]],
      [100, 178, [[-56, 64, null, 3], [64, 150, 'x', 7], [150, 200, null, 9]]],
      [178, 256, [[28, 148, null, 2], [148, 284, null, 5]]],
    ];
    let seed = 421;
    for (const [y0, y1, crates] of rows) for (const [x0, x1, brace, st] of crates) {
      crateFace(s, x0, y0, x1, y1, { seed: seed++, brace, stencil: STENCILS[st], plank: 20 + (seed % 3) * 3, batten: 11 });
    }
    s.grain(0.02, 431);
  }, { shadow: 10, shadowK: 0.55, specK: 0.4, ao: [[1.5, 0.3], [5, 0.12], [14, 0.05]] });

  // ---------------------------------------------------------------- FENCEPOL: precast concrete post / base
  await T('FENCEPOL', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    s.fill([150, 146, 138]);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 5, 5, 5, 441), m = fbm(u, v, 40, 40, 2, 442);
      const k = 0.84 + n * 0.24 + (m - 0.5) * 0.12;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k * 0.98;
      s.H[i] = n * 2 + m * 0.9;
      if (hash(x, y, 443) < 0.015) { s.H[i] -= 1; s.C[i * 3] *= 0.7; s.C[i * 3 + 1] *= 0.7; s.C[i * 3 + 2] *= 0.7; }
    });
    // chamfered cap band and formwork joints
    hband(s, 0, 14, { h: 3, bevel: 6, op: 'add', color: [168, 164, 156], alpha: 0.5 });
    hband(s, 14, 16, { h: -1.5, op: 'add', bevel: 1 });
    for (let x = 0; x < w; x += 64) vband(s, x - 1, x + 1, { h: -1.2, op: 'add', bevel: 1, color: [110, 106, 100], alpha: 0.6 });
    // rebar rust and chipped corners
    s.streaks([130, 80, 44], { amount: 0.4, fx: 12, seed: 444, len: 0.25, start: () => 16 / 256 });
    const r = rng(445);
    for (let k = 0; k < 4; k++) { const x = r() * w, y = 30 + r() * (h - 60), rr = 4 + r() * 6; s.circle(x, y, rr, { h: -1.8, op: 'add', bevel: rr, prof: 'smooth', color: [128, 124, 116], alpha: 0.6 }); }
    // desert dust drifted at the foot
    s.grime([176, 160, 128], (u, v) => sstep(0.7, 1, v) * 0.7, { seed: 446, fx: 16, fy: 4 });
  }, { amb: 0.5, shadow: 6 });

  // ---------------------------------------------------------------- flats
  await T('DESERT', 'flats', 128, 128, (s) => {
    s.fill([150, 146, 138]);
    s.each((u, v, x, y, i) => {
      const warp = fbm(u, v, 2, 2, 3, 451) * 3;
      const rip = Math.sin((u * 2 + v * 5 + warp) * Math.PI * 2) * 0.5 + 0.5;
      const ripA = fbm(u, v, 3, 3, 3, 455);
      const n = fbm(u, v, 6, 6, 4, 452), g = hash(x, y, 453), big = fbm(u, v, 2, 2, 3, 456);
      s.H[i] = rip * 0.9 * ripA + n * 1.4 + g * 0.5;
      const k = 0.84 + n * 0.16 + big * 0.12 + (g - 0.5) * 0.14 + rip * ripA * 0.03;
      s.setC(i, [150 * k, 146 * k, 140 * k]);
    });
    const r = rng(454);
    for (let k = 0; k < 40; k++) { const x = r() * 128, y = r() * 128, rr = 0.7 + r() * 1.8; s.circle(x, y, rr, { h: rr * 1.2, bevel: rr, prof: 'round', op: 'max', color: mix3([110, 104, 96], [170, 164, 152], r()) }); }
    for (let k = 0; k < 3; k++) { // dry scrub twigs
      const x = r() * 128, y = r() * 128;
      for (let j = 0; j < 6; j++) { const a = r() * 6.28, L = 3 + r() * 6; s.seg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.5, { h: 1.2, op: 'max', bevel: 0.5, color: [82, 70, 56] }); }
    }
  }, { amb: 0.5, shadow: 4, light: [-0.4, -0.5, 0.75] });

  await T('TARMAC', 'flats', 128, 128, (s) => {
    s.fill([72, 72, 74], 0.1);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 4, 4, 4, 461), g = hash(x, y, 462), a2 = hash(x >> 1, y >> 1, 463);
      const k = 0.82 + n * 0.28 + (g - 0.5) * 0.3 + (a2 > 0.9 ? 0.2 : 0);
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
      s.H[i] = g * 0.8 + (a2 > 0.9 ? 0.6 : 0);
      // cracks: Worley edges, some sealed with tar
      const [f1, f2] = worley(u, v, 2, 2, 464);
      if (f2 - f1 < 0.03 && fbm(u, v, 4, 4, 3, 465) > 0.56) { s.H[i] -= 1.5; s.setC(i, [30, 30, 32], 0.8); s.S[i] = 0.5; }
    });
    // faded, broken yellow line along one edge
    s.rect(4, -4, 12, 132, {
      fn: (i, cov, t, d, px, py) => { const wear = fbm(px / 128, py / 128, 16, 16, 3, 466); s.setC(i, [196, 160, 52], cov * sstep(0.35, 0.55, wear) * 0.75); },
    });
    s.grime([46, 44, 42], () => 0.2, { fx: 4, fy: 4, seed: 467, contrast: 2.5 });
    s.grime([150, 136, 108], () => 0.12, { fx: 8, fy: 8, seed: 468, contrast: 3 }); // blown sand
  }, { specK: 0.8, amb: 0.5, shadow: 3 });

  await T('CRATETOP', 'flats', 128, 128, (s) => {
    s.fill([30, 26, 22]);
    crateFace(s, 0, 0, 128, 128, { seed: 471, plank: 21, batten: 10, stencil: [['→ 51-0347 ←', 0.5, 11]] });
  }, { shadow: 8, specK: 0.4, light: [-0.35, -0.55, 0.76] });
}

// MAP01 Area 51 / S-4 lab: flats (128 x 128 PNG = 64 x 64 units, tile both ways).
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash } from '../lib/env/tex.js';
import { P, mix3 } from '../lib/env/lab.js';
import { A, hullPlates } from '../lib/env/alien.js';

export default async function (F) {
  const T = async (name, paint, bake = {}) => {
    const s = new Surf(128, 128);
    await paint(s);
    await save(F, 'flats', name, s.bake({ light: [-0.35, -0.55, 0.76], ...bake }));
  };

  // vinyl composition tiles: 32 px (16 units) squares, speckled, waxed
  const vct = (s, toneFn, seed) => {
    s.each((u, v, x, y, i) => {
      const tx = Math.floor(x / 64), ty = Math.floor(y / 64);
      const base = toneFn(tx, ty);
      const k = 0.94 + hash(tx, ty, seed) * 0.1;
      const chip = hash(x >> 1, y >> 1, seed + 1), chip2 = fbm(u, v, 32, 32, 2, seed + 2);
      let c = [base[0] * k, base[1] * k, base[2] * k];
      if (chip < 0.07) c = mix3(c, [base[0] * 0.78, base[1] * 0.78, base[2] * 0.8], 0.5);
      else if (chip > 0.96) c = mix3(c, [235, 232, 224], 0.3);
      c = mix3(c, [c[0] * 0.93, c[1] * 0.93, c[2] * 0.93], chip2);
      s.setC(i, c); s.S[i] = 0.35;
      const fx = x % 64, fy = y % 64;
      const edge = Math.min(fx, 63 - fx, fy, 63 - fy);
      s.H[i] = edge < 1 ? 0 : 1.2;
    });
    s.mottle(0.06, 4, 4, 4, seed + 3);
    // scuff marks
    const r = rng(seed + 4);
    for (let k = 0; k < 10; k++) { const x = r() * 128, y = r() * 128, a = r() * 6.28, L = 3 + r() * 10; s.seg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.5 + r() * 0.6, { color: [50, 48, 46], alpha: 0.25 + r() * 0.25 }); }
    s.grime([90, 84, 72], () => 0.18, { fx: 4, fy: 4, seed: seed + 5, contrast: 2.2 });
  };

  await T('LABTILE', (s) => vct(s, () => [176, 170, 154], 301), { specK: 0.6, specPow: 10 });
  await T('LABTIL2', (s) => vct(s, (tx, ty) => ((tx + ty) % 2 ? [112, 122, 132] : [180, 178, 170]), 311), { specK: 0.6, specPow: 10 });

  // acoustic ceiling tiles in a T-bar grid (64 px = 32 units)
  await T('LABCEIL', (s) => {
    s.fill([196, 194, 186]);
    s.each((u, v, x, y, i) => {
      const f = fbm(u, v, 16, 16, 3, 321), w2 = worley(u, v, 24, 24, 322)[0];
      const fiss = w2 < 0.12 ? 1 : 0;
      s.H[i] = 1 + (f - 0.5) * 0.8 - fiss * 0.5;
      const k = 0.93 + f * 0.1 - fiss * 0.08;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
    });
    for (const o of [0, 64]) {
      s.rect(-2, o - 2, 130, o + 2, { h: 3, bevel: 1, op: 'set', color: [176, 176, 172], spec: 0.5 });
      s.rect(o - 2, -2, o + 2, 130, { h: 3, bevel: 1, op: 'set', color: [176, 176, 172], spec: 0.5 });
    }
    // water stain on one tile
    s.grime([150, 130, 96], (u, v) => clamp(0.5 - Math.hypot(u - 0.72, v - 0.3) * 4), { seed: 323, fx: 8, fy: 8 });
    s.mottle(0.04, 4, 4, 3, 324);
  }, { amb: 0.55 });

  // fluorescent troffer: frame, prismatic diffuser, two tubes glowing through
  await T('LABLITE', (s) => {
    s.fill([180, 180, 176], 0.5);
    s.rect(-2, -2, 130, 4, { h: 3, bevel: 1, op: 'set' }); s.rect(-2, 124, 130, 130, { h: 3, bevel: 1, op: 'set' });
    s.rect(-2, -2, 4, 130, { h: 3, bevel: 1, op: 'set' }); s.rect(124, -2, 130, 130, { h: 3, bevel: 1, op: 'set' });
    s.rect(8, 8, 120, 120, { h: -1, bevel: 2, op: 'set', color: [150, 150, 146] });
    s.each((u, v, x, y, i) => {
      if (x < 12 || x > 116 || y < 12 || y > 116) return;
      const prism = (Math.abs(fract(x / 4) - 0.5) + Math.abs(fract(y / 4) - 0.5)) * 0.5;
      const tube = Math.max(Math.exp(-Math.pow((x - 42) / 12, 2)), Math.exp(-Math.pow((x - 86) / 12, 2)));
      const endFade = sstep(12, 28, y) * sstep(116, 100, y);
      const b = 0.62 + 0.38 * tube * (0.7 + 0.3 * endFade) - prism * 0.12;
      s.setC(i, [40, 42, 46]);
      s.addE(i, [226, 236, 250], b * 0.9 + 0.02);
    });
  }, { ao: [[1.5, 0.2]], shadow: 0 });

  // concrete slab floor with saw-cut joints
  await T('CONCFLR', (s) => {
    s.fill(P.conc);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 4, 4, 5, 341), m = fbm(u, v, 32, 32, 2, 342), tr = fbm(u, v, 2, 16, 3, 343);
      const k = 0.84 + n * 0.24 + (m - 0.5) * 0.1 + (tr - 0.5) * 0.06;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k * 0.98;
      s.H[i] = n * 1.5 + m * 0.6;
      if (hash(x, y, 344) < 0.02) { s.C[i * 3] *= 0.75; s.C[i * 3 + 1] *= 0.75; s.C[i * 3 + 2] *= 0.75; }
    });
    s.rect(-2, -1, 130, 1, { h: -2, op: 'add', bevel: 1, color: [80, 78, 74] });
    s.rect(-1, -2, 1, 130, { h: -2, op: 'add', bevel: 1, color: [80, 78, 74] });
    // oil stain + tyre marks
    s.grime([62, 58, 52], (u, v) => clamp(0.55 - Math.hypot(u - 0.35, v - 0.6) * 3.2), { seed: 345, fx: 8, fy: 8 });
    s.grime([96, 92, 86], () => 0.2, { fx: 6, fy: 6, seed: 346, contrast: 2.5 });
  }, { amb: 0.5, shadow: 4 });

  // diamond plate steel
  await T('METLFLR', (s) => {
    s.fill([126, 130, 132], 0.6);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 8, 8, 4, 351);
      const k = 0.85 + n * 0.25; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
    });
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
      const cx = gx * 16 + 8, cy = gy * 16 + 8, a = (gx + gy) % 2 ? Math.PI / 4 : -Math.PI / 4;
      const dx = Math.cos(a) * 5, dy = Math.sin(a) * 5;
      s.seg(cx - dx, cy - dy, cx + dx, cy + dy, 1.8, { h: 2.4, bevel: 1.8, prof: 'round', op: 'max', spec: 0.9 });
    }
    s.edgeWear([196, 200, 204], 0.8, 1, 352);
    s.grime([60, 58, 54], () => 0.25, { fx: 6, fy: 6, seed: 353, contrast: 2.2 });
    s.grime(P.rust, () => 0.12, { fx: 10, fy: 10, seed: 354, contrast: 3 });
  }, { specK: 1.3, specPow: 18 });

  // bar grating over a dark service void
  await T('GRATEFLR', (s) => {
    s.fill([22, 24, 26]);
    // what's below: pipes and cable trays in the dark
    s.rect(-2, 30, 130, 44, { h: -14, op: 'set', bevel: 7, prof: 'round', color: [60, 62, 60], spec: 0.4 });
    s.rect(-2, 88, 130, 96, { h: -16, op: 'set', bevel: 4, prof: 'round', color: [70, 40, 34], spec: 0.4 });
    s.each((u, v, x, y, i) => { if (s.H[i] === 0) s.H[i] = -20; });
    for (let x = 0; x < 128; x += 16) s.rect(x, -4, x + 4, 132, { h: 6, bevel: 1.5, op: 'set', color: [124, 128, 130], spec: 0.8 });
    for (let y = 0; y < 128; y += 32) s.rect(-4, y, 132, y + 3, { h: 5.5, bevel: 1, op: 'max', color: [108, 112, 114], spec: 0.7 });
    for (let y = 16; y < 128; y += 32) s.rect(-4, y, 132, y + 2, { h: 4, bevel: 1, op: 'max', color: [96, 100, 102], spec: 0.6 });
    s.each((u, v, x, y, i) => { if (s.H[i] > 0) { const n = fbm(u, v, 8, 8, 3, 361); const k = 0.8 + n * 0.35; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; } });
    s.grime(P.rust, (u, v, x, y, i) => (s.H[i] > 0 ? 0.25 : 0), { fx: 8, fy: 8, seed: 362, contrast: 3 });
  }, { specK: 1.2, shadow: 14, shadowK: 0.7, ao: [[1.5, 0.3], [4, 0.1]] });

  // alien floor: plates with teal seams
  await T('ALNFLR1', (s) => {
    hullPlates(s, { fx: 2, fy: 2, seed: 371, glow: 0.5, base: A.violetLo, stria: 30 });
    s.grain(0.03, 372);
  }, { specK: 1.2, specPow: 18 });

  // stair tread: dark steel with raised rubber studs and a worn centre
  await T('STEPTOP', (s) => {
    s.fill([74, 76, 78], 0.4);
    s.each((u, v, x, y, i) => { const n = fbm(u, v, 8, 8, 4, 381); const k = 0.85 + n * 0.25; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; });
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
      const cx = gx * 16 + 8 + (gy % 2) * 8, cy = gy * 16 + 8;
      s.circle(cx, cy, 3.4, { h: 2, bevel: 1.5, prof: 'round', op: 'max', color: [40, 40, 42], spec: 0.2 });
    }
    s.edgeWear([150, 152, 154], 0.5, 1, 382);
    s.grime([50, 46, 40], () => 0.2, { fx: 6, fy: 6, seed: 383, contrast: 2 });
  }, { specK: 1, shadow: 6 });
}

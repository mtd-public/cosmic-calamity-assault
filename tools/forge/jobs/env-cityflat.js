// MAP02 Washington D.C.: flats (128 x 128 PNG = 64 x 64 units).
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash } from '../lib/env/tex.js';
import { mix3, P } from '../lib/env/lab.js';

export default async function (F) {
  const T = async (name, paint, bake = {}) => { const s = new Surf(128, 128); await paint(s); await save(F, 'flats', name, s.bake({ light: [-0.35, -0.55, 0.76], ...bake })); };

  const asphalt = (s, seed) => {
    s.fill([62, 62, 64], 0.15);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 4, 4, 4, seed), g = hash(x, y, seed + 1), a2 = hash(x >> 1, y >> 1, seed + 2);
      const k = 0.8 + n * 0.3 + (g - 0.5) * 0.34 + (a2 > 0.92 ? 0.25 : 0);
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k * 1.02;
      s.H[i] = g * 0.9 + (a2 > 0.92 ? 0.7 : 0);
      const [f1, f2] = worley(u, v, 2, 2, seed + 3);
      if (f2 - f1 < 0.025 && fbm(u, v, 4, 4, 3, seed + 4) > 0.55) { s.H[i] -= 1.6; s.setC(i, [26, 26, 28], 0.85); s.S[i] = 0.6; }
    });
    s.grime([30, 30, 32], (u, v) => clamp(0.5 - Math.hypot(u - 0.3, v - 0.7) * 3), { seed: seed + 5, fx: 6, fy: 6 });  // oil stain
    s.grime([40, 40, 42], () => 0.18, { fx: 4, fy: 4, seed: seed + 6, contrast: 2.5 });
  };
  await T('ASPHALT', (s) => asphalt(s, 801), { specK: 0.8, amb: 0.5, shadow: 3 });
  await T('ASPHLINE', (s) => {
    asphalt(s, 811);
    // double yellow centre line running along y
    for (const x0 of [55, 67]) s.rect(x0, -4, x0 + 6, 132, { fn: (i, cov, t, d, px, py) => { const w = fbm(px / 128, py / 128, 16, 16, 3, 812); s.setC(i, [214, 176, 50], cov * sstep(0.3, 0.45, w) * 0.9); s.H[i] += cov * 0.4; } });
  }, { specK: 0.8, amb: 0.5, shadow: 3 });

  await T('SIDEWALK', (s) => {
    s.fill([150, 148, 142]);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 4, 4, 5, 821), m = fbm(u, v, 32, 32, 2, 822), sl = Math.floor(x / 64) + Math.floor(y / 64) * 2;
      const k = 0.84 + n * 0.22 + (m - 0.5) * 0.1 + hash(sl, 1, 823) * 0.06;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
      s.H[i] = n * 1.2 + m * 0.5;
      const fx = x % 64, fy = y % 64;
      if (Math.min(fx, 63 - fx, fy, 63 - fy) < 1.2) { s.H[i] -= 2; s.setC(i, [70, 68, 64], 0.9); }
    });
    // gum spots, a crack, a stain
    const r = rng(824);
    for (let k = 0; k < 14; k++) s.circle(r() * 128, r() * 128, 1 + r() * 1.6, { color: [60, 58, 56], alpha: 0.7, h: 0.4 });
    s.tube([[70, 10], [78, 22], [76, 36], [86, 50]], 0.5, { h: -1.2, op: 'add', color: [70, 68, 64] });
    s.grime([90, 86, 78], () => 0.2, { fx: 6, fy: 6, seed: 825, contrast: 2.4 });
  }, { amb: 0.5, shadow: 3 });

  await T('CARPETR', (s) => {
    s.each((u, v, x, y, i) => {
      const cx = mod(x, 32) - 16, cy = mod(y, 32) - 16;
      const dia = Math.abs(cx) + Math.abs(cy);
      let c = [120, 20, 26];
      if (Math.abs(dia - 12) < 1.6) c = [196, 150, 60];
      if (dia < 4) c = [196, 150, 60];
      if (Math.abs(Math.abs(cx) - 16) < 1 || Math.abs(Math.abs(cy) - 16) < 1) c = [70, 14, 18];
      const pile = hash(x, y, 831), n = fbm(u, v, 8, 8, 3, 832);
      const k = 0.82 + pile * 0.2 + n * 0.12;
      s.setC(i, [c[0] * k, c[1] * k, c[2] * k]); s.H[i] = pile * 0.8;
    });
    s.grime([60, 30, 26], (u, v) => 0.2, { fx: 4, fy: 4, seed: 833, contrast: 2.5 });
    s.grime([40, 26, 20], (u, v) => clamp(0.4 - Math.hypot(u - 0.65, v - 0.35) * 3), { seed: 834, fx: 8, fy: 8 });
  }, { amb: 0.55, shadow: 0 });

  await T('MARBFLR', (s) => {
    s.each((u, v, x, y, i) => {
      const tx = Math.floor(x / 64), ty = Math.floor(y / 64), dark = (tx + ty) % 2 === 1;
      const lx = (x % 64) / 64, ly = (y % 64) / 64;
      const t = fbm(u, v, 3, 3, 5, 841 + (dark ? 7 : 0)), vein = Math.abs(Math.sin((lx * 2 + ly * 3 + t * 6) * Math.PI));
      let c = dark ? [34, 34, 38] : [220, 212, 196];
      c = mix3(c, dark ? [120, 120, 124] : [150, 140, 120], clamp(1 - vein * 16) * 0.6);
      c = mix3(c, dark ? [60, 58, 64] : [236, 230, 218], clamp((t - 0.5) * 2) * 0.5);
      s.setC(i, c); s.S[i] = 0.95;
      const fx = x % 64, fy = y % 64;
      s.H[i] = Math.min(fx, 63 - fx, fy, 63 - fy) < 1 ? -1 : 0;
    });
  }, { specK: 0.6, specPow: 40, shadow: 0, ao: [[1, 0.3]] });

  await T('SUBFLR', (s) => {
    s.each((u, v, x, y, i) => {
      const tx = Math.floor(x / 32), ty = Math.floor(y / 32);
      const k0 = 0.92 + hash(tx, ty, 851) * 0.1, n = fbm(u, v, 16, 16, 2, 852);
      const g = hash(x, y, 853), chip = g < 0.1 ? 0.7 : g > 0.95 ? 1.25 : 1;
      const k = k0 * chip * (0.88 + n * 0.2);
      s.setC(i, [122 * k, 120 * k, 116 * k]); s.S[i] = 0.35;
      const fx = x % 32, fy = y % 32;
      s.H[i] = Math.min(fx, 31 - fx, fy, 31 - fy) < 1 ? -1 : 0.5;
      if (Math.min(fx, 31 - fx, fy, 31 - fy) < 1) s.setC(i, [60, 58, 54]);
    });
    s.grime([50, 46, 40], () => 0.3, { fx: 4, fy: 4, seed: 854, contrast: 2.2 });
    const r = rng(855); for (let k = 0; k < 10; k++) s.circle(r() * 128, r() * 128, 1 + r() * 1.5, { color: [40, 38, 36], alpha: 0.7 });
  }, { specK: 0.6, specPow: 16, amb: 0.5, shadow: 2 });

  await T('ROOFTAR', (s) => {
    s.fill([52, 50, 50], 0.3);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 4, 861), g = hash(x, y, 862), gr = worley(u, v, 40, 40, 863)[0];
      const pebble = gr < 0.35;
      const k = 0.8 + n * 0.3 + (g - 0.5) * 0.2;
      s.setC(i, pebble ? [104 * k, 98 * k, 92 * k] : [52 * k, 50 * k, 50 * k]);
      s.H[i] = pebble ? (0.35 - gr) * 5 : n * 0.5;
      s.S[i] = pebble ? 0.1 : 0.5;
    });
    // membrane seam
    s.rect(-4, 60, 132, 66, { h: 1.5, bevel: 2, op: 'add', color: [36, 34, 34], alpha: 0.8 });
    s.grime([90, 86, 80], () => 0.15, { fx: 4, fy: 4, seed: 864, contrast: 2 });
  }, { amb: 0.5, shadow: 3 });
}

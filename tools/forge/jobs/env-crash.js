// MAP03 crash site: night forest, trench walls, Army canvas, the violet saucer hull.
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash, textMask } from '../lib/env/tex.js';
import { hband, vband, mix3, P } from '../lib/env/lab.js';
import { A, hullPlates, boneRibs, veins } from '../lib/env/alien.js';

export default async function (F) {
  const T = async (name, dir, w, h, paint, bake = {}) => { const s = new Surf(w, h); await paint(s); await save(F, dir, name, s.bake(bake)); };

  // ---------------------------------------------------------------- ROCKWAL1: layered granite cliff
  // fractured rock: each warped Worley cell is a tilted facet; seams between facets are cracks
  const rock = (s, seed, base = [112, 106, 98]) => {
    const { w, h } = s;
    s.each((u, v, x, y, i) => {
      const wu = u + (fbm(u, v, 3, 3, 3, seed + 7) - 0.5) * 0.1, wv = v + (fbm(u, v, 3, 3, 3, seed + 8) - 0.5) * 0.1;
      const [f1, f2, id, px, py] = worley(mod(wu, 1), mod(wv, 1), 3, 5, seed, 0.9);
      const gx = (hash(id, 1, seed) - 0.5) * 0.7, gy = (hash(id, 2, seed) - 0.25) * 0.6;
      const du = (mod(wu, 1) - px) * w, dv = (mod(wv, 1) - py) * h;
      const e = f2 - f1, d = fbm(u, v, 16, 16, 4, seed + 2), strata = fbm(0.3, v, 1, 10, 3, seed + 3);
      const facet = hash(id, 3, seed) * 10 + du * gx + dv * gy;
      s.H[i] = facet * sstep(0.0, 0.05, e) + d * 4 + strata * 4;
      const tint = fbm(u, v, 2, 2, 3, seed + 4);
      const k = 0.66 + hash(id, 4, seed) * 0.22 + d * 0.25 + (strata - 0.5) * 0.15 - (e < 0.012 ? 0.2 : 0);
      s.setC(i, [base[0] * k * (0.94 + tint * 0.12), base[1] * k, base[2] * k * (1.06 - tint * 0.12)]);
    });
    s.grime([80, 90, 64], () => 0.2, { fx: 8, fy: 8, seed: seed + 5, contrast: 3 });
    s.grime([60, 52, 44], (u, v) => 0.15, { fx: 4, fy: 12, seed: seed + 6, contrast: 2.5 });
  };
  await T('ROCKWAL1', 'textures', 256, 256, (s) => rock(s, 1001), { amb: 0.4, shadow: 16, shadowK: 0.6, ao: [[2, 0.2], [6, 0.08], [16, 0.03]] });

  // ---------------------------------------------------------------- DIRTWALL: trench cut through soil
  await T('DIRTWALL', 'textures', 256, 256, (s) => {
    s.each((u, v, x, y, i) => {
      const warp = fbm(u, v, 4, 2, 3, 1011) * 0.12;
      const layer = fbm(0.5, v + warp, 1, 6, 3, 1012);
      const n = fbm(u, v, 16, 16, 4, 1013), clump = fbm(u, v, 6, 6, 4, 1014);
      let c = mix3([92, 70, 50], [60, 46, 36], layer);
      c = mix3(c, [130, 110, 84], clamp((n - 0.6) * 3) * 0.5);
      const k = 0.8 + clump * 0.35;
      s.setC(i, [c[0] * k, c[1] * k, c[2] * k]);
      s.H[i] = clump * 5 + n * 2;
    });
    const r = rng(1015);
    for (let k = 0; k < 50; k++) { const x = r() * 256, y = r() * 256, rr = 1.2 + r() * 3.5; s.circle(x, y, rr, { h: rr * 1.4, bevel: rr, prof: 'round', op: 'max', color: mix3([110, 104, 96], [150, 140, 126], r()) }); }
    for (let k = 0; k < 7; k++) { let x = r() * 256, y = r() * 256; const pts = [[x, y, 2.2]]; for (let j = 0; j < 10; j++) { x += (r() - 0.5) * 16; y += 6 + r() * 10; pts.push([x, y, Math.max(0.6, 2.2 - j * 0.18)]); } s.tube(pts, 1.5, { h: 3, bevel: 1.5, prof: 'round', op: 'max', color: [70, 52, 36] }); }
  }, { amb: 0.42, shadow: 10, shadowK: 0.5 });

  // ---------------------------------------------------------------- TENTCANV: olive drab canvas
  await T('TENTCANV', 'textures', 256, 256, (s) => {
    s.each((u, v, x, y, i) => {
      const weave = ((x + (y >> 1)) % 3 === 0 ? -0.04 : 0.02) + (hash(x, y, 1021) - 0.5) * 0.06;
      const n = fbm(u, v, 6, 6, 4, 1022), wr = fbm(u, v, 3, 12, 3, 1023);
      const k = 0.84 + n * 0.22 + weave;
      s.setC(i, [92 * k, 94 * k, 62 * k]);
      s.H[i] = Math.sin((u * 2 + wr * 0.6) * Math.PI * 2) * 0.8 * (0.5 + v * 0.5) + weave * 5;  // gentle sag between the poles
    });
    // seams with stitching, grommets along the hem
    for (const x0 of [0, 128]) {
      vband(s, x0 - 3, x0 + 3, { h: 2, op: 'add', bevel: 2, color: [78, 80, 52] });
      for (let y = 4; y < 256; y += 6) { s.seg(x0 - 5, y, x0 - 5, y + 3, 0.5, { color: [60, 62, 40] }); s.seg(x0 + 5, y, x0 + 5, y + 3, 0.5, { color: [60, 62, 40] }); }
    }
    hband(s, 238, 250, { h: 3, op: 'add', bevel: 2, color: [80, 82, 54] });
    for (let x = 16; x < 256; x += 32) { s.ring(x, 244, 3.5, 2, { h: 5, bevel: 1, prof: 'round', color: [150, 140, 100], spec: 0.8 }); s.circle(x, 244, 2, { h: -1, op: 'set', color: [20, 20, 16] }); }
    s.apply(textMask(s, 'U.S.', 64, 110, { font: 'bold 34px "DejaVu Sans Mono", monospace', align: 'center', sx: 0.9 }), { color: [40, 40, 30], alpha: 0.6 });
    s.grime([70, 58, 40], (u, v) => sstep(0.7, 1, v) * 0.6, { seed: 1024, fx: 12, fy: 4 });
    s.grime([56, 50, 36], () => 0.15, { seed: 1025, fx: 8, fy: 8, contrast: 2.5 });
  }, { amb: 0.5, shadow: 4 });

  // ---------------------------------------------------------------- saucer hull
  // saucer plating: broad horizontal rim bands with long plates, a recessed groove band with ports and a glow line
  const hull = (s, seed) => {
    const { w, h } = s;
    const bands = [[0, 96, [0, 128], 1], [96, 150, null, 0], [150, 256, [60, 188], 1]];
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 4, seed + 1), n2 = fbm(u, v, 24, 24, 2, seed + 5);
      const sheen = 0.5 + 0.5 * Math.sin((u * 1.3 + v * 0.6 + n * 0.5) * Math.PI * 2);
      let c = mix3([72, 52, 102], [124, 92, 156], sheen * 0.55);
      const k = 0.85 + n * 0.25 + (n2 - 0.5) * 0.06; c = [c[0] * k, c[1] * k, c[2] * k];
      s.setC(i, c); s.S[i] = 0.85;
      for (const [y0, y1, seams, raised] of bands) {
        if (y < y0 || y >= y1) continue;
        const t = (y - y0) / (y1 - y0);
        const edge = Math.min(y - y0, y1 - 1 - y);
        s.H[i] = raised ? 6 * Math.sin(t * Math.PI) ** 0.5 : 1 + Math.sin(t * Math.PI) * 1.2;
        if (!raised) { s.setC(i, mix3(s.getC(i), [34, 26, 48], 0.6)); }
        if (edge < 1.5) { s.H[i] -= 2; s.setC(i, [22, 16, 30]); }
        if (seams) for (const sx of seams) if (Math.abs(x - sx) < 1.2) { s.H[i] -= 2; s.setC(i, [22, 16, 30]); }
      }
    });
    // groove band: glow line, ports and glyphs
    const gl = s.mask((g) => { g.fillRect(0, 122, 256, 2.5); });
    s.apply(gl, { color: A.teal, E: A.teal, eAlpha: 0.85 }); s.glow(gl, A.teal, 5, 0.4);
    for (let x = 16; x < 256; x += 32) { s.circle(x, 108, 5, { h: -2, op: 'add', bevel: 2, color: [20, 16, 28] }); s.circle(x, 108, 3, { color: [60, 200, 190], E: [40, 170, 160], eAlpha: 0.6 }); }
    const r = rng(seed + 2);
    const m = s.mask((g) => { g.lineWidth = 1.5; g.lineCap = 'round'; for (let k = 0; k < 10; k++) { const x = 8 + k * 25 + r() * 6, y0 = 132; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - 0.5) * 8, y0 + 7); g.arc(x, y0 + 10, 3, -1.5, 1.5 * r()); g.stroke(); } }, { wrap: true });
    s.apply(m, { color: [40, 200, 180], E: [30, 150, 140], eAlpha: 0.5, h: -0.5 });
  };
  await T('HULLEXT', 'textures', 256, 256, (s) => hull(s, 1031), { specK: 1.4, specPow: 30, shadow: 5 });
  await T('HULLBRN', 'textures', 256, 256, (s) => {
    hull(s, 1041);
    // scorch: soot, heat-tint rainbow, cracks leaking teal, dents
    s.each((u, v, x, y, i) => {
      const burn = fbm(u, v, 3, 3, 5, 1042), t = fbm(u, v, 8, 8, 3, 1043);
      const soot = clamp((burn - 0.35) * 2.5);
      const heat = clamp(1 - Math.abs(burn - 0.33) * 12);
      s.setC(i, mix3(s.getC(i), [18, 14, 16], soot * 0.9));
      if (heat > 0) s.setC(i, mix3(s.getC(i), t > 0.5 ? [160, 120, 60] : [60, 90, 170], heat * 0.6));
      s.S[i] *= 1 - soot * 0.8;
      s.H[i] += (t - 0.5) * 2 * soot;
    });
    const r = rng(1044);
    for (let k = 0; k < 4; k++) {
      let x = r() * 256, y = r() * 256; const pts = [[x, y, 1.6]];
      for (let j = 0; j < 9; j++) { x += (r() - 0.5) * 20; y += (r() - 0.5) * 20; pts.push([x, y, Math.max(0.4, 1.6 - j * 0.15)]); }
      s.tube(pts, 1, { h: -3, op: 'add', bevel: 1, color: [20, 60, 56], E: A.teal, eAlpha: 0.6 });
    }
    s.grime([30, 26, 26], () => 0.2, { fx: 8, fy: 8, seed: 1045, contrast: 2.5 });
  }, { specK: 1.2, specPow: 24, shadow: 5 });
  await T('HULLIN1', 'textures', 256, 256, (s) => {
    s.fill(A.violetDk);
    hullPlates(s, { fx: 2, fy: 2, seed: 1051, glow: 0.2, base: [60, 42, 80] });
    boneRibs(s, { n: 4, width: 16, h: 12, seed: 1052, sway: 0.004, color: [150, 136, 150] });
    // a horizontal light conduit
    hband(s, 150, 162, { h: 14, bevel: 5, prof: 'round', color: [40, 30, 50], spec: 0.8, op: 'max' });
    const lm = s.mask((g) => { g.fillRect(0, 154, 256, 4); });
    s.apply(lm, { color: A.teal, E: A.teal, eAlpha: 0.9 }); s.glow(lm, A.teal, 6, 0.5);
    s.grain(0.03, 1053);
  }, { specK: 1.1, specPow: 20, shadow: 10 });

  // ---------------------------------------------------------------- flats
  const FT = (name, paint, bake = {}) => T(name, 'flats', 128, 128, paint, { light: [-0.35, -0.55, 0.76], ...bake });
  await FT('DIRTFLR', (s) => {
    s.each((u, v, x, y, i) => { const n = fbm(u, v, 6, 6, 5, 1061), g = hash(x, y, 1062), c2 = fbm(u, v, 16, 16, 3, 1063); const k = 0.8 + n * 0.3 + (g - 0.5) * 0.15; s.setC(i, mix3([88, 70, 52], [64, 54, 42], c2)); s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; s.H[i] = n * 2 + g * 0.5; });
    const r = rng(1064);
    for (let k = 0; k < 70; k++) { const x = r() * 128, y = r() * 128, a = r() * 6.28, L = 2 + r() * 5; s.seg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.45, { color: r() < 0.5 ? [110, 80, 46] : [70, 60, 40], h: 0.6, op: 'max', bevel: 0.4 }); }   // pine needles
    for (let k = 0; k < 25; k++) { const rr = 0.8 + r() * 1.6; s.circle(r() * 128, r() * 128, rr, { h: rr, bevel: rr, prof: 'round', op: 'max', color: mix3([100, 96, 90], [140, 130, 120], r()) }); }
    for (let k = 0; k < 3; k++) { const x = r() * 128, y = r() * 128, a = r() * 6.28; s.seg(x, y, x + Math.cos(a) * 14, y + Math.sin(a) * 14, 1.1, { h: 2, bevel: 1, prof: 'round', op: 'max', color: [70, 52, 36] }); }
  }, { amb: 0.5, shadow: 4 });
  await FT('GRASSFLR', (s) => {
    s.each((u, v, x, y, i) => { const n = fbm(u, v, 4, 4, 4, 1071), d = fbm(u, v, 3, 3, 4, 1072); s.setC(i, mix3([54, 74, 38], [74, 66, 44], clamp((d - 0.55) * 3))); const k = 0.75 + n * 0.3; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; s.H[i] = n; });
    const r = rng(1073);
    for (let k = 0; k < 900; k++) { const x = r() * 128, y = r() * 128, a = -Math.PI / 2 + (r() - 0.5) * 1.4, L = 2 + r() * 5, g = 0.7 + r() * 0.6; s.seg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.45, { color: [60 * g, 96 * g, 44 * g], h: 1 + r(), op: 'max', bevel: 0.4 }); }
  }, { amb: 0.5, shadow: 3 });
  await FT('MUDFLR', (s) => {
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 4, 4, 5, 1081), p = fbm(u, v, 3, 3, 4, 1082), g = hash(x, y, 1083);
      const wet = clamp((p - 0.58) * 6);
      // tyre tracks along y
      const tr = (Math.abs(x - 34) < 12 || Math.abs(x - 96) < 12) ? 1 : 0, tread = tr && fract(y / 8) < 0.45 ? 1 : 0;
      s.H[i] = n * 3 - tr * 1.5 + tread * 0.8 - wet * 2 + g * 0.3;
      const k = 0.75 + n * 0.3;
      s.setC(i, mix3([72 * k, 56 * k, 40 * k], [30, 28, 26], wet * 0.7)); s.S[i] = wet * 0.9 + 0.1;
    });
  }, { amb: 0.5, shadow: 4, specK: 0.5, specPow: 20 });
  await FT('ROCKFLR', (s) => {
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 4, 1092), g = hash(x, y, 1098);
      s.setC(i, mix3([84, 72, 58], [104, 96, 86], n)); s.H[i] = n * 2 + g * 0.6;
      const k = 0.85 + (g - 0.5) * 0.2; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
      const wu = u + (fbm(u, v, 4, 4, 3, 1095) - 0.5) * 0.1, wv = v + (fbm(u, v, 4, 4, 3, 1096) - 0.5) * 0.1;
      const [f1, f2, id] = worley(mod(wu, 1), mod(wv, 1), 4, 4, 1091, 0.95);
      if (hash(id, 5, 1099) < 0.62) {
        const r0 = 0.3 + hash(id, 6, 1099) * 0.25;
        if (f1 < r0) { const t = 1 - f1 / r0; const kk = 0.62 + hash(id, 1, 1093) * 0.35 + fbm(u, v, 16, 16, 3, 1094) * 0.2; s.H[i] = Math.max(s.H[i], Math.sqrt(t) * 7 * (0.5 + hash(id, 2, 1097))); s.setC(i, [122 * kk, 116 * kk, 106 * kk]); }
      }
    });
    s.grime([80, 86, 60], () => 0.15, { fx: 6, fy: 6, seed: 1094, contrast: 3 });
  }, { amb: 0.45, shadow: 8 });
  await FT('HULLFLR', (s) => {
    s.fill([50, 38, 66], 0.7);
    for (let gy = 0; gy < 2; gy++) for (let gx = 0; gx < 2; gx++) {
      const x0 = gx * 64, y0 = gy * 64;
      s.rect(x0 + 2, y0 + 2, x0 + 62, y0 + 62, { h: 3, bevel: 3, op: 'set', color: mix3([62, 46, 82], [80, 60, 104], hash(gx, gy, 1101)), r: 6 });
      s.circle(x0 + 32, y0 + 32, 14, { h: -1.5, op: 'add', bevel: 2 });
      s.ring(x0 + 32, y0 + 32, 14, 1.4, { E: A.teal, eAlpha: 0.7, color: [60, 200, 180] });
    }
    for (const o of [0, 64]) { s.rect(-2, o - 1, 130, o + 1, { E: A.teal, eAlpha: 0.35, color: [40, 90, 90] }); s.rect(o - 1, -2, o + 1, 130, { E: A.teal, eAlpha: 0.35, color: [40, 90, 90] }); }
    s.mottle(0.1, 6, 6, 4, 1102);
  }, { specK: 1.3, specPow: 26 });
}

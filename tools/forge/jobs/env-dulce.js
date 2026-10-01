// MAP02 Dulce base (Dark Forces' Secret Base under a New Mexico mesa): walls and flats.
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash, textMask, textWidth } from '../lib/env/tex.js';
import { hband, vband } from '../lib/env/lab.js';
import { DP, mixc, strata, boardForm, stencil, paintMask, cagedLamp, hazardRect, rustAt } from '../lib/env/dulce.js';

// BUNKWALL layout shared by DULCSIGN and the switches so they drop into a run of it.
const BW = { conduitY: 22, stripe0: 186, stripe1: 193, dado: 193 };

export default async function (F, params = {}) {
  const only = params.only ? params.only.split(',') : null;
  const want = (n) => !only || only.includes(n);
  const T = async (name, dir, w, h, paint, bake = {}) => {
    if (!want(name)) return;
    const s = new Surf(w, h);
    await paint(s);
    await save(F, dir, name, s.bake(bake));
  };

  // The bunker wall base: board-formed concrete, a painted dado with a yellow
  // line, an electrical conduit along the top, grime and seepage.
  const bunker = (s, seed) => {
    const { w, h } = s;
    boardForm(s, { seed, tieY: [56, 152], tieDx: 128, tieX: 64 });
    // painted dado (government grey-green over the boards) and the safety line
    s.rect(-2, BW.dado, w + 2, h + 2, {
      fn: (i, cov, t, d, px, py) => {
        const x = mod(px, w), y = mod(py, h), chip = fbm(x / w, y / h, 20, 10, 3, seed + 40), sp = hash(x, y, seed + 41);
        if (chip < 0.28 && (y < BW.dado + 10 || chip < 0.2)) return;     // paint chipped off near the top edge
        const k = 0.9 + sp * 0.1 + (fbm(x / w, y / h, 4, 2, 3, seed + 42) - 0.5) * 0.2;
        s.setC(i, [DP.govGreen[0] * k, DP.govGreen[1] * k, DP.govGreen[2] * k], cov); s.S[i] = 0.25;
      },
    });
    s.rect(-2, BW.stripe0, w + 2, BW.stripe1, {
      fn: (i, cov, t, d, px, py) => { const x = mod(px, w), chip = fbm(x / w, py / h, 32, 8, 3, seed + 43); if (chip > 0.3) s.setC(i, mixc(DP.yellow, [170, 130, 30], hash(x, py, 3) * 0.3), cov * 0.95); },
    });
    // conduit with strap clamps and a pull box
    hband(s, BW.conduitY - 4, BW.conduitY + 4, { h: 9, bevel: 4, prof: 'round', op: 'max', color: [124, 128, 126], spec: 0.7 });
    for (let x = 40; x < w; x += 128) { s.rect(x, BW.conduitY - 6, x + 6, BW.conduitY + 6, { h: 10, bevel: 1.5, op: 'max', color: [90, 92, 90], spec: 0.5 }); s.bolt(x + 3, BW.conduitY - 8, 1.3, { h: 1 }); s.bolt(x + 3, BW.conduitY + 8, 1.3, { h: 1 }); }
    // seepage below the tie holes and the conduit, grime rising from the floor
    s.streaks([96, 92, 82], { amount: 0.35, fx: 32, seed: seed + 44, len: 0.25, start: () => (BW.conduitY + 6) / h });
    s.streaks([182, 178, 166], { amount: 0.18, fx: 24, seed: seed + 45, len: 0.12, start: () => 60 / h });
    s.grime([56, 52, 46], (u, v) => sstep(0.82, 1, v) * 0.5 + sstep(0.1, 0, v) * 0.2, { fx: 16, fy: 4, seed: seed + 46 });
    s.grain(0.025, seed + 47);
  };

  // ---------------------------------------------------------------- MESAWALL: red sandstone strata (tiles both ways)
  await T('MESAWALL', 'textures', 256, 256, (s) => {
    strata(s, { seed: 1101, maxBed: 52, joints: 2 });
    // desert varnish: dark streaks hanging from ledges
    s.streaks(DP.varnish, { amount: 0.6, fx: 20, seed: 1102, len: 0.45, start: () => 0.1 });
    s.streaks([70, 40, 32], { amount: 0.3, fx: 16, seed: 1103, len: 0.25, start: () => 0.55 });
    s.mottle(0.08, 3, 3, 3, 1104);
    s.grain(0.03, 1105);
  }, { amb: 0.42, shadow: 10, shadowK: 0.42, bump: 1.0, light: [-0.4, -0.72, 0.56], ao: [[1.5, 0.22], [5, 0.1], [14, 0.05]] });

  // ---------------------------------------------------------------- BUNKWALL: board-formed concrete, stencilled (512 x 256)
  await T('BUNKWALL', 'textures', 512, 256, (s) => {
    bunker(s, 1111);
    // painted level number and markings
    stencil(s, 'LEVEL', 120, 86, { size: 26, align: 'center', color: DP.white, seed: 1112, wear: 0.32, sx: 1.05, spacing: 3 });
    stencil(s, '3', 120, 178, { size: 112, align: 'center', color: DP.white, seed: 1113, wear: 0.3 });
    s.rect(64, 96, 176, 99, { color: DP.white, alpha: 0.6 });
    stencil(s, 'SECTOR C', 404, 118, { size: 17, align: 'center', color: DP.yellow, seed: 1114, wear: 0.3, spacing: 2 });
    s.poly([[330, 140], [352, 128], [352, 135], [478, 135], [478, 145], [352, 145], [352, 152]], { fn: (i, cov) => s.setC(i, DP.yellow, cov * 0.85 * (hash(i, 3, 1) < 0.85 ? 1 : 0.3)) });
    stencil(s, 'B3-114', 404, 174, { size: 12, align: 'center', color: [30, 30, 30], seed: 1115, wear: 0.25, spacing: 1 });
  }, { amb: 0.46, shadow: 8, specK: 0.7 });

  // ---------------------------------------------------------------- BUNKDOOR: heavy bunker door (256 x 256)
  await T('BUNKDOOR', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(DP.steel, 0.4);
    s.each((u, v, x, y, i) => { const [c, dh, sp] = rustAt(u, v, x, y, 1121, [96, 106, 100], 0.22); s.setC(i, c); s.H[i] = dh; s.S[i] = sp; });
    // outer frame and the slab
    s.rect(0, 0, w, h, { h: 2, bevel: 1, op: 'add' });
    s.rect(6, 6, w - 6, h - 6, { h: 4, bevel: 3, op: 'add' });
    // hazard bands top and bottom
    hazardRect(s, 6, 6, w - 6, 30, { h: 1.5, period: 40, seed: 1122, wear: 0.32 });
    hazardRect(s, 6, h - 34, w - 6, h - 6, { h: 1.5, period: 40, seed: 1123, wear: 0.32 });
    // heavy horizontal ribs and the locking dogs from a central hub
    for (const y of [56, 200]) s.rect(10, y - 9, w - 10, y + 9, { h: 9, bevel: 4, op: 'max', color: [88, 96, 92], spec: 0.5 });
    for (const sgn of [-1, 1]) {
      s.rect(sgn < 0 ? 18 : 128, 118, sgn < 0 ? 128 : w - 18, 138, { h: 11, bevel: 5, prof: 'round', op: 'max', color: [150, 150, 144], spec: 0.9 });
      s.rect(sgn < 0 ? 10 : w - 30, 108, sgn < 0 ? 30 : w - 10, 148, { h: 12, bevel: 3, op: 'max', color: [78, 84, 80], spec: 0.5 });
    }
    for (const sgn of [-1, 1]) s.rect(118, sgn < 0 ? 66 : 138, 138, sgn < 0 ? 118 : 168, { h: 10, bevel: 5, prof: 'round', op: 'max', color: [150, 150, 144], spec: 0.9 });
    s.circle(128, 128, 40, { h: 13, bevel: 6, op: 'max', color: [84, 92, 88], spec: 0.5 });
    s.ring(128, 128, 30, 6, { h: 17, bevel: 3, prof: 'round', op: 'max', color: DP.red2, spec: 0.6 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; s.seg(128, 128, 128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30, 3, { h: 16, bevel: 2, op: 'max', color: [150, 30, 22], spec: 0.5 }); }
    s.circle(128, 128, 9, { h: 19, bevel: 5, prof: 'round', op: 'max', color: [170, 170, 164], spec: 0.9 });
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; s.bolt(128 + Math.cos(a) * 36, 128 + Math.sin(a) * 36, 1.8, { h: 1.4, hex: true }); }
    // rivets along the frame
    for (let x = 14; x < w; x += 16) { s.bolt(x, 38, 1.7, { h: 1.2 }); s.bolt(x, h - 42, 1.7, { h: 1.2 }); }
    for (let y = 70; y < h - 60; y += 16) { s.bolt(14, y, 1.7, { h: 1.2 }); s.bolt(w - 14, y, 1.7, { h: 1.2 }); }
    // markings
    stencil(s, 'D-3', 64, 104, { size: 28, align: 'center', color: DP.white, seed: 1124, wear: 0.3 });
    stencil(s, 'D-3', 192, 104, { size: 28, align: 'center', color: DP.white, seed: 1125, wear: 0.3 });
    stencil(s, 'KEEP CLEAR', 128, 186, { size: 13, align: 'center', color: DP.yellow, seed: 1126, wear: 0.3, spacing: 2 });
    s.grain(0.03, 1127);
    s.edgeWear([176, 176, 168], 0.7, 1, 1128);
    s.streaks(DP.rust, { amount: 0.45, fx: 24, seed: 1129, len: 0.25, start: () => 66 / 256 });
    s.streaks(DP.rustDk, { amount: 0.35, fx: 20, seed: 1130, len: 0.2, start: () => 210 / 256 });
    s.grime([40, 38, 34], (u, v) => sstep(0.8, 1, v) * 0.4, { seed: 1131 });
  }, { specK: 1.1, shadow: 10 });

  // ---------------------------------------------------------------- SHAFTWAL: ribbed shaft wall with caged lamps (tiles both ways)
  await T('SHAFTWAL', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    // smooth poured concrete with vertical form lines
    s.fill([128, 125, 118], 0.05);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 5, 5, 5, 1141), m = fbm(u, v, 30, 30, 2, 1142), lift = hash(0, Math.floor(y / 64), 1143) * 0.06;
      const k = 0.8 + n * 0.22 + (m - 0.5) * 0.08 + lift;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k * 0.98;
      s.H[i] = n * 2 + m * 0.6;
    });
    // pour lines (lifts) every 64 px
    for (let y = 0; y < h; y += 64) hband(s, y - 1, y + 1, { h: -0.8, op: 'add', bevel: 1, color: DP.concDk, alpha: 0.4 });
    // ribs: tall fins every 64 px
    for (let x = 0; x < w; x += 64) {
      s.rect(x - 8, -4, x + 8, h + 4, { h: 14, bevel: 5, op: 'max', prof: 'smooth', fn: (i, cov) => { const c = s.getC(i); s.setC(i, [c[0] * 1.05, c[1] * 1.05, c[2] * 1.04], cov); } });
      s.rect(x - 2, -4, x + 2, h + 4, { h: -0.6, op: 'add', bevel: 1 });
    }
    // ring beam with a hazard edge
    hband(s, 0, 22, { h: 20, bevel: 4, op: 'max', color: DP.concLt });
    hazardRect(s, -2, 22, w + 2, 30, { h: 0.5, period: 24, seed: 1144, wear: 0.38 });
    // caged lamps in alternate bays, cable conduit down the fins
    for (const [lx, ly] of [[32, 140], [160, 140]]) {
      s.rect(lx - 2, 30, lx + 2, ly - 18, { h: 6, bevel: 2, prof: 'round', op: 'max', color: [60, 62, 60], spec: 0.5 });
      cagedLamp(s, lx, ly, { r: 11, halo: 18, haloK: 0.7 });
    }
    // depth marker and painted bay numbers on the beam
    stencil(s, '-340 FT', 96, 16, { size: 11, align: 'center', color: [30, 30, 30], seed: 1145, wear: 0.25, spacing: 1 });
    stencil(s, '-340 FT', 224, 16, { size: 11, align: 'center', color: [30, 30, 30], seed: 1146, wear: 0.25, spacing: 1 });
    // seepage: dark wet streaks and white mineral bloom
    s.streaks([60, 62, 58], { amount: 0.5, fx: 32, seed: 1147, len: 0.6, start: () => 30 / 256 });
    s.streaks([196, 194, 182], { amount: 0.22, fx: 24, seed: 1148, len: 0.2, start: () => 30 / 256 });
    s.grime([50, 48, 44], () => 0.22, { fx: 8, fy: 8, seed: 1149, contrast: 2.4 });
    s.streaks(DP.rust, { amount: 0.4, fx: 16, seed: 1151, len: 0.12, start: () => 156 / 256 });
    s.grain(0.025, 1150);
  }, { amb: 0.4, shadow: 14, shadowK: 0.55, specK: 0.8 });

  // ---------------------------------------------------------------- MACHWALL: turbine and pipe machinery (512 x 256)
  await T('MACHWALL', 'textures', 512, 256, (s) => {
    const { w, h } = s;
    // dark steel wall panels
    s.fill(DP.steelDk, 0.35);
    s.each((u, v, x, y, i) => { const [c, dh, sp] = rustAt(u, v, x, y, 1161, [70, 76, 76], 0.25); s.setC(i, c); s.H[i] = dh; s.S[i] = sp; });
    for (let x = 0; x < w; x += 128) { s.rect(x + 1, 1, x + 127, h - 1, { h: 2, bevel: 1.5, op: 'add' }); for (let y = 10; y < h; y += 20) { s.bolt(x + 5, y, 1.4, { h: 1 }); s.bolt(x + 123, y, 1.4, { h: 1 }); } }
    // overhead pipe run (tiles)
    const hpipe = (y, r, col, seed) => {
      s.stamp((px, py) => Math.abs(py - y) - r, [0, y - r, w - 1, y + r], { h: 14 + r, bevel: r, prof: 'round', op: 'max', fn: (i, cov) => { const x = i % w, yy = (i / w) | 0; const [c] = rustAt(x / w, yy / h, x, yy, seed, col, 0.3); s.setC(i, c, cov); s.S[i] = 0.6; } });
    };
    hpipe(16, 11, [120, 124, 120], 1162); hpipe(44, 7, [160, 128, 40], 1163);
    for (let x = 100; x < w; x += 256) {
      s.rect(x, 2, x + 8, 30, { h: 34, bevel: 3, prof: 'round', op: 'max', color: [130, 132, 128], spec: 0.8 });
      s.rect(x + 120, 34, x + 126, 54, { h: 28, bevel: 2, prof: 'round', op: 'max', color: [150, 120, 40], spec: 0.7 });
    }
    // the turbine: volute casing with an outlet duct up into the overhead main
    const cx = 150, cy = 150, R = 80;
    const vol = (px, py) => {
      const dx = px - cx, dy = py - cy, a = Math.atan2(dy, dx), t = mod(a + Math.PI / 2, Math.PI * 2) / (Math.PI * 2);
      const rr = R * (0.82 + 0.18 * t);
      const body = Math.hypot(dx, dy) - rr;
      const duct = Math.max(Math.abs(px - (cx + R * 0.62)) - R * 0.36, Math.max(py - cy, 26 - py));
      return Math.min(body, duct);
    };
    s.stamp(vol, [cx - R - 4, 20, cx + R + 4, cy + R + 4], {
      h: 20, bevel: 22, prof: 'round', op: 'max',
      fn: (i, cov) => { const x = i % w, y = (i / w) | 0; const [c, , sp] = rustAt(x / w, y / h, x, y, 1164, [92, 112, 98], 0.3); s.setC(i, c, cov); s.S[i] = sp; },
    });
    // duct flange where it meets the main, and casing flange bolts
    s.rect(cx + R * 0.2, 28, cx + R * 1.04, 36, { h: 34, bevel: 2, op: 'max', color: [96, 112, 100], spec: 0.6 });
    for (let k = 0; k < 6; k++) s.bolt(cx + R * 0.26 + k * R * 0.14, 32, 1.6, { h: 1.2, hex: true });
    s.ring(cx, cy, R * 0.62, 6, { h: 3, bevel: 2, op: 'add', color: [80, 96, 86] });
    for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; s.bolt(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62, 2, { h: 1.6, hex: true, color: [150, 150, 146] }); }
    // bearing hub with ribs and a red cap
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; s.seg(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 3.2, { h: 26, bevel: 2.5, prof: 'round', op: 'max', color: [86, 102, 92] }); }
    s.circle(cx, cy, 24, { h: 30, bevel: 8, prof: 'round', op: 'max', color: [110, 116, 112], spec: 0.7 });
    s.circle(cx, cy, 13, { h: 34, bevel: 6, prof: 'round', op: 'max', color: DP.red2, spec: 0.7 });
    s.poly(Array.from({ length: 6 }, (_, k) => [cx + Math.cos(k * Math.PI / 3) * 6, cy + Math.sin(k * Math.PI / 3) * 6]), { h: 36, bevel: 2, op: 'max', color: [170, 170, 164], spec: 0.9 });
    // rotation arrow + stencil
    s.stamp((px, py) => Math.abs(Math.hypot(px - cx, py - cy) - 56) - 2.2, [cx - 60, cy - 60, cx + 60, cy + 60], { fn: (i, cov, t, d, px, py) => { const a = Math.atan2(py - cy, px - cx); if (a > 0.3 && a < 1.9) s.setC(i, DP.white, cov * 0.8); } });
    s.poly([[cx + Math.cos(0.3) * 56 - 7, cy + Math.sin(0.3) * 56 + 3], [cx + Math.cos(0.3) * 56 + 7, cy + Math.sin(0.3) * 56 + 3], [cx + Math.cos(0.12) * 56, cy + Math.sin(0.12) * 56 - 8]], { color: DP.white, alpha: 0.8 });
    stencil(s, 'TURBINE 2', cx - 6, cy - 50, { size: 12, align: 'center', color: DP.white, seed: 1165, wear: 0.18, spacing: 1 });
    // plinth with hazard edge
    s.rect(cx - R - 14, h - 26, cx + R + 14, h + 2, { h: 10, bevel: 2, op: 'max', color: DP.conc });
    hazardRect(s, cx - R - 14, h - 26, cx + R + 14, h - 18, { h: 0.6, period: 20, seed: 1166, wear: 0.35 });
    for (const x of [cx - R, cx + R]) s.bolt(x, h - 10, 3, { h: 2.5, hex: true });
    // right half: vertical pipe bank
    const vpipe = (x, r, col, seed) => s.stamp((px, py) => Math.abs(px - x) - r, [x - r, 0, x + r, h - 1], { h: 14 + r, bevel: r, prof: 'round', op: 'max', fn: (i, cov) => { const xx = i % w, y = (i / w) | 0; const [c] = rustAt(xx / w, y / h, xx, y, seed, col, 0.3); s.setC(i, c, cov); s.S[i] = 0.6; } });
    vpipe(282, 12, [150, 40, 30], 1167); vpipe(318, 8, [170, 140, 40], 1168); vpipe(482, 15, [128, 130, 126], 1169);
    for (const [x, r] of [[282, 12], [318, 8], [482, 15]]) for (const y of [80, 220]) { s.rect(x - r - 3, y - 4, x + r + 3, y + 4, { h: 30 + r, bevel: 2, prof: 'round', op: 'max', color: [130, 130, 126], spec: 0.8 }); }
    // handwheel valve on the yellow line
    s.ring(318, 150, 15, 3.4, { h: 38, bevel: 2, prof: 'round', op: 'max', color: [190, 36, 26], spec: 0.6 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; s.seg(318, 150, 318 + Math.cos(a) * 14, 150 + Math.sin(a) * 14, 1.7, { h: 37, bevel: 1, op: 'max', color: [160, 30, 22] }); }
    s.circle(318, 150, 4.5, { h: 40, bevel: 2, prof: 'round', op: 'max', color: [150, 150, 150], spec: 0.9 });
    // gauge and control box
    const bx0 = 346, bx1 = 456, by0 = 72, by1 = 178;
    s.rect(bx0, by0, bx1, by1, { h: 12, bevel: 3, op: 'max', color: [104, 112, 108], r: 3, spec: 0.4 });
    s.rect(bx0 + 4, by0 + 4, bx1 - 4, by1 - 4, { h: 12.5, bevel: 1, op: 'max', color: [92, 100, 96] });
    for (const [gx, gy] of [[374, 106], [428, 106]]) {
      s.circle(gx, gy, 19, { h: 16, bevel: 3, prof: 'round', op: 'max', color: [60, 60, 60], spec: 0.8 });
      s.circle(gx, gy, 15, { h: 15, bevel: 1, op: 'set', color: [226, 222, 206], spec: 1 });
      s.stamp((px, py) => Math.abs(Math.hypot(px - gx, py - gy) - 12) - 1.2, [gx - 14, gy - 14, gx + 14, gy + 14], { fn: (i, cov, t, d, px, py) => { const a = Math.atan2(py - gy, px - gx); if (a < -0.2 && a > -1.3) s.setC(i, [200, 30, 20], cov); else if (a > -2.6 && a < -0.2 || a > 0.6) s.setC(i, [40, 40, 40], cov * 0.7); } });
      const na = gx < 400 ? -0.6 : -2.0;
      s.seg(gx, gy, gx + Math.cos(na) * 12, gy + Math.sin(na) * 12, 0.9, { color: [20, 20, 20] });
      s.circle(gx, gy, 1.8, { color: [30, 30, 30], h: 16, op: 'max' });
    }
    for (let k = 0; k < 5; k++) { const col = [[255, 60, 40], [80, 255, 100], [255, 180, 40], [80, 255, 100], [255, 255, 220]][k]; const lm = s.mask((g) => { g.beginPath(); g.arc(366 + k * 17, 142, 3.6, 0, 7); g.fill(); }, { wrap: false }); s.apply(lm, { h: 15, bevel: 2, op: 'max', color: col, E: k === 1 || k === 3 || k === 0 ? col : null, eAlpha: 0.8, spec: 0.9 }); if (k !== 2 && k !== 4) s.glow(lm, col, 3, 0.4); }
    s.rect(358, 156, 444, 168, { h: 13.5, bevel: 0.8, op: 'max', color: [210, 206, 190] });
    s.apply(textMask(s, 'LOOP B  PSI', 401, 165, { font: 'bold 9px "DejaVu Sans", sans-serif', align: 'center' }), { color: [30, 30, 30] });
    for (const [bx, by] of [[bx0 + 4, by0 + 4], [bx1 - 4, by0 + 4], [bx0 + 4, by1 - 4], [bx1 - 4, by1 - 4]]) s.bolt(bx, by, 1.6, { h: 1.2, hex: true });
    s.rect(398, by1, 404, h - 22, { h: 8, bevel: 2, prof: 'round', op: 'max', color: [70, 72, 70], spec: 0.5 });
    // floor kick plate with hazard stripes
    hazardRect(s, 256, h - 22, w, h, { h: 2, period: 28, seed: 1170, wear: 0.33, op: 'add' });
    stencil(s, 'DANGER HIGH PRESSURE', 401, 67, { size: 9, align: 'center', color: DP.yellow, seed: 1171, wear: 0.2, spacing: 0.5, sx: 0.88 });
    s.grain(0.03, 1172);
    s.edgeWear([186, 186, 178], 0.6, 1, 1173);
    s.streaks(DP.rust, { amount: 0.4, fx: 32, seed: 1174, len: 0.3, start: () => 56 / 256 });
    s.streaks([30, 28, 26], { amount: 0.35, fx: 24, seed: 1175, len: 0.25, start: () => 0.62 });   // oil
    s.grime([36, 34, 30], (u, v) => sstep(0.75, 1, v) * 0.45, { seed: 1176, fx: 16, fy: 4 });
  }, { specK: 1.1, shadow: 18, shadowK: 0.55, ao: [[2, 0.2], [6, 0.08], [16, 0.03]] });

  // ---------------------------------------------------------------- RUSTMETL: rusted riveted plates (tiles both ways)
  await T('RUSTMETL', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    const plates = [[0, 0, 160, 96, 0.55], [160, 0, 256, 96, 0.75], [-48, 96, 80, 176, 0.65], [80, 96, 208, 176, 0.5], [208, 96, 336, 176, 0.65], [0, 176, 256, 256, 0.6]];
    s.fill(DP.rustDk);
    plates.forEach(([x0, y0, x1, y1, amt], k) => {
      s.rect(x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, {
        h: 3 + (k % 2) * 1.5, bevel: 1.5, op: 'set',
        fn: (i, cov) => { const x = i % w, y = (i / w) | 0; const [c, dh, sp] = rustAt(x / w, y / h, x, y, 1181 + k * 7, [86, 98, 92], amt); s.setC(i, c, cov); s.H[i] += dh * cov; s.S[i] = sp; },
      });
      for (let x = x0 + 8; x <= x1 - 8; x += 12) { s.bolt(x, y0 + 6, 2.1, { h: 1.7, spec: 0.4 }); s.bolt(x, y1 - 6, 2.1, { h: 1.7, spec: 0.4 }); }
      for (let y = y0 + 18; y <= y1 - 18; y += 12) { s.bolt(x0 + 6, y, 2.1, { h: 1.7, spec: 0.4 }); s.bolt(x1 - 6, y, 2.1, { h: 1.7, spec: 0.4 }); }
    });
    // a weld bead patch and a few holes rusted through
    s.tube([[30, 40], [60, 52], [96, 48]], 2, { h: 3, bevel: 2, prof: 'round', op: 'add', color: [60, 46, 38] });
    const r = rng(1189);
    for (let k = 0; k < 5; k++) { const x = r() * w, y = r() * h, rr = 1.5 + r() * 3; s.circle(x, y, rr + 2.5, { h: -0.8, op: 'add', bevel: 2, color: DP.rustLt, alpha: 0.7 }); s.circle(x, y, rr, { h: -4, op: 'add', bevel: 1, color: [14, 10, 8] }); }
    s.streaks(DP.rust, { amount: 0.6, fx: 24, seed: 1190, len: 0.25, start: (u) => (u < 0.625 ? 6 : 102) / 256 });
    s.streaks([60, 30, 18], { amount: 0.5, fx: 16, seed: 1191, len: 0.35, start: () => 182 / 256 });
    s.edgeWear([150, 120, 90], 0.4, 1, 1192);
    s.grain(0.03, 1193);
  }, { specK: 0.9, shadow: 6 });

  // ---------------------------------------------------------------- DULCSIGN: restricted-area sign on the bunker wall (512 x 256)
  await T('DULCSIGN', 'textures', 512, 256, (s) => {
    bunker(s, 1201);
    const x0 = 72, x1 = 440, y0 = 34, y1 = 178;
    // the enamel plate, standing off the wall
    s.rect(x0, y0, x1, y1, { h: 7, bevel: 2, op: 'max', color: [232, 228, 214], r: 3, spec: 0.7 });
    s.rect(x0 + 5, y0 + 5, x1 - 5, y0 + 34, { h: 7.2, bevel: 0.8, op: 'max', color: DP.red2 });
    const fit = (str, font, avail, sp = 0) => Math.min(1, avail / textWidth(str, font, 1, sp));
    const cx = (x0 + x1) / 2, avail = x1 - x0 - 24;
    const f1 = 'bold 22px "DejaVu Sans", sans-serif', f2 = 'bold 34px "DejaVu Sans", sans-serif', f3 = 'bold 15px "DejaVu Sans", sans-serif', f4 = 'bold 10px "DejaVu Sans", sans-serif';
    s.apply(textMask(s, 'RESTRICTED AREA', cx, y0 + 28, { font: f1, align: 'center', sx: fit('RESTRICTED AREA', f1, avail, 3), spacing: 3 }), { color: [244, 240, 228] });
    s.apply(textMask(s, 'DULCE FACILITY', cx, y0 + 69, { font: f2, align: 'center', sx: fit('DULCE FACILITY', f2, avail, 1) * 0.92, spacing: 1 }), { color: [24, 24, 26] });
    s.rect(cx - 70, y0 + 76, cx + 70, y0 + 100, { h: 7.2, bevel: 0.8, op: 'max', color: [24, 24, 26] });
    s.apply(textMask(s, 'LEVEL 3', cx, y0 + 95, { font: 'bold 20px "DejaVu Sans", sans-serif', align: 'center', spacing: 4 }), { color: DP.yellow });
    s.apply(textMask(s, 'AUTHORIZED PERSONNEL ONLY', cx, y0 + 118, { font: f3, align: 'center', sx: fit('AUTHORIZED PERSONNEL ONLY', f3, avail, 1), spacing: 1 }), { color: DP.red2 });
    s.apply(textMask(s, 'USE OF DEADLY FORCE AUTHORIZED', cx, y0 + 133, { font: f4, align: 'center', spacing: 1 }), { color: [30, 30, 30] });
    // bolts, enamel chips, rust bleeding, two bullet strikes
    for (const [bx, by] of [[x0 + 8, y0 + 8], [x1 - 8, y0 + 8], [x0 + 8, y1 - 8], [x1 - 8, y1 - 8]]) s.bolt(bx, by, 2.4, { h: 1.6, hex: true, color: [120, 110, 96] });
    const r = rng(1202);
    for (let k = 0; k < 9; k++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), rr = 0.7 + r() * 1.4; s.poly([[x - rr, y], [x, y - rr * 0.7], [x + rr * 1.3, y + 0.2], [x, y + rr]], { color: [58, 56, 54], h: -0.4, op: 'add', alpha: 0.85 }); }
    for (const [bx, by] of [[x0 + 310, y0 + 52], [x0 + 70, y0 + 112]]) { s.circle(bx, by, 5, { h: 2, bevel: 3, op: 'add', color: [200, 196, 180] }); s.circle(bx, by, 2.4, { h: -4, bevel: 1, op: 'add', color: [20, 18, 16] }); }
    s.streaks(DP.rust, { amount: 0.5, fx: 48, seed: 1203, len: 0.12, start: () => (y1 - 4) / 256 });
    s.grime([90, 84, 70], (u, v, x, y) => (x > x0 && x < x1 && y > y0 && y < y1 ? 0.18 : 0), { seed: 1204, fx: 12, fy: 6, contrast: 2.2 });
  }, { amb: 0.46, shadow: 8, specK: 0.9 });

  // ---------------------------------------------------------------- SW1DULC / SW2DULC: lever box on the bunker wall (128 x 256)
  for (const on of [0, 1]) {
    await T(on ? 'SW2DULC' : 'SW1DULC', 'textures', 128, 256, (s) => {
      bunker(s, 1211);
      const cx = 64, y0 = 52, y1 = 176;
      // conduit drop into the box
      s.rect(cx + 22, BW.conduitY, cx + 30, y0, { h: 9, bevel: 4, prof: 'round', op: 'max', color: [124, 128, 126], spec: 0.7 });
      hazardRect(s, cx - 38, y0, cx + 38, y1, { h: 10, bevel: 3, op: 'max', period: 22, seed: 1212, wear: 0.25 });
      s.rect(cx - 30, y0 + 8, cx + 30, y1 - 8, { h: 11, bevel: 1.5, op: 'max', color: [92, 100, 96], spec: 0.4 });
      // label plate
      s.rect(cx - 27, y0 + 12, cx + 27, y0 + 26, { h: 11.5, bevel: 0.8, op: 'max', color: [222, 218, 202] });
      s.apply(textMask(s, 'SHAFT LIFT', cx, y0 + 23, { font: 'bold 9px "DejaVu Sans", sans-serif', align: 'center', sx: 0.82 }), { color: [30, 30, 30] });
      // lamp
      const lamp = on ? [70, 255, 90] : [255, 50, 30];
      const lm = s.mask((g) => { g.beginPath(); g.arc(cx, y0 + 40, 6, 0, 7); g.fill(); }, { wrap: false });
      s.circle(cx, y0 + 40, 8, { h: 14, bevel: 2, op: 'max', color: [50, 50, 50], spec: 0.6 });
      s.apply(lm, { h: 16, bevel: 4, prof: 'round', op: 'max', color: mixc(lamp, [255, 255, 255], 0.35), E: lamp, eAlpha: 0.9, spec: 1 });
      s.glow(lm, lamp, 6, 0.55);
      // the lever slot and T-handle
      s.rect(cx - 5, y0 + 54, cx + 5, y1 - 14, { h: 4, op: 'set', bevel: 1, color: [16, 16, 16] });
      const ty = on ? y1 - 22 : y0 + 62;
      s.rect(cx - 3, ty - 2, cx + 3, ty + 2, { h: 16, bevel: 1.5, op: 'max', color: [140, 140, 136], spec: 0.9 });
      s.seg(cx, ty, cx, on ? ty + 4 : ty - 4, 3, { h: 18, bevel: 2, prof: 'round', op: 'max', color: [150, 150, 146], spec: 0.9 });
      s.rect(cx - 18, (on ? ty + 4 : ty - 10), cx + 18, (on ? ty + 10 : ty - 4), { h: 22, bevel: 3, prof: 'round', op: 'max', color: [30, 30, 30], spec: 0.6, r: 3 });
      s.apply(textMask(s, 'OFF', cx - 27, y0 + 72, { font: 'bold 7px "DejaVu Sans", sans-serif', align: 'left' }), { color: [230, 226, 210] });
      s.apply(textMask(s, 'ON', cx - 27, y1 - 26, { font: 'bold 7px "DejaVu Sans", sans-serif', align: 'left' }), { color: [230, 226, 210] });
      for (const [bx, by] of [[cx - 34, y0 + 4], [cx + 34, y0 + 4], [cx - 34, y1 - 4], [cx + 34, y1 - 4]]) s.bolt(bx, by, 1.8, { h: 1.2, hex: true });
      s.streaks(DP.rust, { amount: 0.4, fx: 8, seed: 1213, len: 0.1, start: () => (y1 + 2) / 256 });
      s.edgeWear([190, 186, 170], 0.5, 1, 1214);
    }, { amb: 0.46, shadow: 10, specK: 1 });
  }

  // ---------------------------------------------------------------- flats (128 x 128)
  const FB = { light: [-0.35, -0.55, 0.76] };
  await T('MESAFLR', 'flats', 128, 128, (s) => {
    s.each((u, v, x, y, i) => {
      const warp = fbm(u, v, 2, 2, 3, 1301) * 3;
      const rip = Math.sin((u * 3 + v * 4 + warp) * Math.PI * 2) * 0.5 + 0.5, ripA = fbm(u, v, 3, 3, 3, 1302);
      const n = fbm(u, v, 6, 6, 4, 1303), g = hash(x, y, 1304), big = fbm(u, v, 2, 2, 3, 1305);
      s.H[i] = rip * 0.9 * ripA + n * 1.4 + g * 0.5;
      const k = 0.82 + n * 0.18 + big * 0.1 + (g - 0.5) * 0.16;
      s.setC(i, mixc([168, 94, 60], [190, 120, 80], big).map((c) => c * k));
      // patches of exposed slickrock
      const slab = fbm(u, v, 5, 5, 4, 1306);
      if (slab > 0.6) {
        const a = sstep(0.6, 0.63, slab), kk = 0.82 + n * 0.22 + (fbm(u, v, 24, 24, 2, 1307) - 0.5) * 0.2;
        s.setC(i, [152 * kk, 74 * kk, 48 * kk], a); s.H[i] += a * 2 + (fbm(u, v, 20, 20, 2, 1307) - 0.5) * a;
        const [f1, f2] = worley(u, v, 6, 6, 1309); if (f2 - f1 < 0.04 && slab > 0.63) { s.setC(i, [90, 46, 32], 0.6); s.H[i] -= 1; }
      }
    });
    const r = rng(1308);
    for (let k = 0; k < 40; k++) { const x = r() * 128, y = r() * 128, rr = 0.8 + Math.pow(r(), 2) * 2.6; s.circle(x, y, rr, { h: rr * 0.9, bevel: rr, prof: 'round', op: 'max', color: mixc([104, 52, 36], [170, 116, 84], r()) }); }
    for (let k = 0; k < 2; k++) { const x = r() * 128, y = r() * 128; for (let j = 0; j < 7; j++) { const a = r() * 6.28, L = 3 + r() * 6; s.seg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.5, { h: 1.2, op: 'max', bevel: 0.5, color: [96, 80, 56] }); } }
  }, { amb: 0.48, shadow: 4, specK: 0.3, ...FB });

  await T('BUNKFLR', 'flats', 128, 128, (s) => {
    s.fill(DP.conc, 0.12);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 4, 4, 5, 1311), m = fbm(u, v, 24, 24, 2, 1312), g = hash(x, y, 1313);
      const k = 0.78 + n * 0.26 + (m - 0.5) * 0.1 + (g - 0.5) * 0.06 + (hash(x >> 6, y >> 6, 1319) - 0.5) * 0.06;
      s.C[i * 3] *= k * 0.96; s.C[i * 3 + 1] *= k * 0.96; s.C[i * 3 + 2] *= k * 0.95;
      s.H[i] = n * 0.8 + m * 0.3;
      // saw-cut joints on a 1 m grid
      const ex = Math.min(mod(x, 64), 63 - mod(x, 64)), ey = Math.min(mod(y, 64), 63 - mod(y, 64));
      if (ex < 1 || ey < 1) { s.H[i] -= 1.4; s.setC(i, [64, 62, 58], 0.8); }
      // a faded painted guide line beside one joint
      const wear = fbm(u, v, 12, 12, 3, 1314);
      if (x >= 3 && x < 9) s.setC(i, DP.yellow, sstep(0.36, 0.5, wear) * 0.6);
    });
    // oil and rust stains, boot scuffs
    s.grime([46, 42, 36], (u, v) => clamp(0.55 - Math.hypot(u - 0.62, v - 0.4) * 3.2), { seed: 1315, fx: 8, fy: 8 });
    s.grime([110, 70, 40], (u, v) => clamp(0.3 - Math.hypot(u - 0.25, v - 0.8) * 4), { seed: 1316, fx: 10, fy: 10 });
    const r = rng(1317);
    for (let k = 0; k < 30; k++) { const x = r() * 128, y = r() * 128, L = 2 + r() * 8, a = r() * 6.28; s.seg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.5 + r() * 0.5, { color: [62, 60, 56], alpha: 0.25 + r() * 0.25 }); }
    s.grime([60, 56, 50], () => 0.18, { fx: 4, fy: 4, seed: 1318, contrast: 2.2 });
  }, { amb: 0.5, shadow: 3, specK: 0.6, ...FB });

  await T('ROOFGRVL', 'flats', 128, 128, (s) => {
    s.fill([58, 54, 50], 0.2);
    // densely packed pebbles: Worley cells as stones, sized and tinted per cell
    s.each((u, v, x, y, i) => {
      const [f1, f2, id] = worley(u, v, 24, 24, 1321, 0.9);
      const e = f2 - f1, tint = hash(id, 1, 1322);
      const base = tint < 0.35 ? [146, 140, 130] : tint < 0.65 ? [124, 118, 110] : tint < 0.88 ? [158, 144, 122] : [100, 96, 92];
      const k = (0.88 + hash(x, y, 1324) * 0.1) * (0.85 + fbm(u, v, 3, 3, 3, 1327) * 0.25);
      if (e > 0.05) { const dome = Math.sqrt(clamp(1 - f1 * f1 * 2.2)); s.setC(i, base.map((c) => c * k * (0.85 + dome * 0.2))); s.H[i] = dome * 3 * sstep(0.05, 0.12, e); s.S[i] = 0.3; }
      else { s.setC(i, [44, 42, 40]); s.H[i] = 0; }
    });
    // a bald patch of tar membrane and some grime
    s.grime([40, 38, 36], (u, v) => clamp(0.6 - Math.hypot(u - 0.3, v - 0.65) * 5), { seed: 1325, fx: 8, fy: 8, contrast: 2 });
    s.grime([80, 76, 70], () => 0.12, { fx: 4, fy: 4, seed: 1326, contrast: 2 });
  }, { amb: 0.5, shadow: 3, ...FB });
}

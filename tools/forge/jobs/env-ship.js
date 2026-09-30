// MAP04 mothership: Independence Day scale ribs (organic-mechanical) and Perfect Dark
// sleekness (dark panels with cyan light strips), consoles, pods, animated goo.
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash, textMask } from '../lib/env/tex.js';
import { hband, vband, mix3 } from '../lib/env/lab.js';
import { A, hullPlates, boneRibs, veins } from '../lib/env/alien.js';

const CY = [70, 230, 255], DARK = [30, 32, 40], GUN = [60, 56, 72];

export default async function (F) {
  const T = async (name, dir, w, h, paint, bake = {}) => { const s = new Surf(w, h); await paint(s); await save(F, dir, name, s.bake(bake)); };
  const strip = (s, x0, y0, x1, y1, col = CY, k = 0.9, halo = 5) => {
    const m = s.mask((g) => g.fillRect(x0, y0, x1 - x0, y1 - y0), { wrap: true });
    s.apply(m, { color: mix3(col, [255, 255, 255], 0.3), E: col, eAlpha: k, h: 0.5 });
    s.glow(m, col, halo, 0.35);
  };
  // chamfered dark panel
  const panel = (s, x0, y0, x1, y1, col, o = {}) => s.poly([[x0 + (o.c ?? 6), y0], [x1 - (o.c2 ?? 0), y0], [x1, y0 + (o.c2 ?? 0)], [x1, y1 - (o.c ?? 6)], [x1 - (o.c ?? 6), y1], [x0 + (o.c2 ?? 0), y1], [x0, y1 - (o.c2 ?? 0)], [x0, y0 + (o.c ?? 6)]], { h: o.h ?? 4, bevel: o.bevel ?? 2, op: 'set', color: col, spec: o.spec ?? 0.7 });

  // ---------------------------------------------------------------- SHIPRIB1: vertical ribs over dark recesses (ID4)
  const ribWall = (s, seed, axis) => {
    const { w, h } = s;
    s.fill([16, 16, 22]);
    // recess detail: horizontal cable runs and tiny lights
    s.each((u, v, x, y, i) => { const n = fbm(u, v, 8, 8, 4, seed); s.H[i] = -8 + n * 3; s.setC(i, [18 + n * 16, 18 + n * 14, 26 + n * 18]); });
    const r = rng(seed + 1);
    for (let k = 0; k < 4; k++) { const y = r() * h, rr = 2 + r() * 3; s.stamp((px, py) => Math.abs(py - y - Math.sin(px / w * Math.PI * 2 + k) * 4) - rr, [0, y - rr - 5, w - 1, y + rr + 5], { h: rr * 1.4 - 6, bevel: rr, prof: 'round', op: 'max', color: [44, 40, 52], spec: 0.6 }); }
    for (let k = 0; k < 40; k++) { const x = r() * w, y = r() * h; s.circle(x, y, 1.2, { E: r() < 0.7 ? A.teal : [255, 170, 60], eAlpha: 0.9, color: [120, 200, 200] }); }
    // the ribs
    s.each((u, v, x, y, i) => {
      const a = axis === 'h' ? v : u, b = axis === 'h' ? u : v, L = axis === 'h' ? h : w;
      const n = 2, t = fract(a * n + Math.sin(b * Math.PI * 2) * 0.015), d = Math.abs(t - 0.5) * L / n, rw = 40 + Math.sin(b * Math.PI * 4 + a * 7) * 4;
      if (d > rw) return;
      const prof = Math.sqrt(1 - (d / rw) ** 2), seg = fract(b * 4), groove = seg < 0.025 || seg > 0.975 ? 1 : 0;
      const ridge = Math.exp(-Math.pow((d - rw * 0.4) / 3, 2)) * 2.5 + Math.exp(-Math.pow((d - rw * 0.75) / 2, 2)) * 1.5;
      const nn = fbm(u, v, 12, 12, 3, seed + 2);
      s.H[i] = prof * 20 + ridge - groove * 4 + nn * 1.5;
      const k = 0.7 + prof * 0.35 + nn * 0.2 - groove * 0.3;
      s.setC(i, [GUN[0] * k * 1.2, GUN[1] * k * 1.2, GUN[2] * k * 1.25]); s.S[i] = 0.8;
      // glowing seam along the rib's spine at intervals
      if (d < 1.2 && fract(b * 3) < 0.55) s.addE(i, A.teal, 0.7);
    });
  };
  await T('SHIPRIB1', 'textures', 256, 256, (s) => ribWall(s, 1201, 'v'), { specK: 1.3, specPow: 22, shadow: 14, shadowK: 0.6 });
  // ---------------------------------------------------------------- SHIPRIB2: forking bone-metal ribs with membrane between
  await T('SHIPRIB2', 'textures', 256, 256, (s) => {
    s.fill([40, 26, 48]);
    hullPlates(s, { fx: 3, fy: 3, seed: 1211, glow: 0.15, base: [56, 36, 66], iri: 0.3 });
    s.tint(() => 0.8);
    const r = rng(1212);
    const rib = (x0) => {
      const pts = []; for (let y = -20; y <= 276; y += 12) pts.push([x0 + Math.sin(y / 256 * Math.PI * 2) * 8, y, 13 - Math.abs(Math.sin(y / 256 * Math.PI * 3)) * 3]);
      s.tube(pts, 12, { h: 16, bevel: 12, prof: 'round', op: 'max', color: (px, py) => { const n = fbm(px / 256, py / 256, 16, 16, 3, 1213); return [96 * (0.8 + n * 0.3), 90 * (0.8 + n * 0.3), 104 * (0.8 + n * 0.3)]; }, spec: 0.8 });
      // forks
      for (const y0 of [60, 190]) { const dir = r() < 0.5 ? -1 : 1; s.tube([[x0, y0, 8], [x0 + dir * 30, y0 + 30, 6], [x0 + dir * 50, y0 + 70, 3]], 6, { h: 12, bevel: 7, prof: 'round', op: 'max', color: [84, 78, 94], spec: 0.8 }); }
    };
    rib(64); rib(192);
    veins(s, { count: 5, seed: 1214, r0: 3, color: [50, 30, 60], stain: false });
    s.grain(0.03, 1215);
  }, { specK: 1.3, specPow: 22, shadow: 14, shadowK: 0.6 });

  // ---------------------------------------------------------------- SHIPPNL1 / SHIPPNL2: sleek dark panels with cyan strips
  await T('SHIPPNL1', 'textures', 256, 256, (s) => {
    s.fill(DARK, 0.9);
    panel(s, 3, 3, 125, 118, [38, 42, 52], { c: 10 }); panel(s, 131, 3, 253, 118, [36, 40, 50], { c: 10 });
    panel(s, 3, 138, 253, 253, [40, 44, 54], { c: 12 });
    hband(s, 122, 134, { h: 1, bevel: 1, color: [18, 20, 26] });
    strip(s, -2, 126, 258, 130);
    // small recessed details
    for (const [x, y] of [[20, 20], [148, 20]]) { s.rect(x, y, x + 30, y + 6, { h: -1.5, op: 'add', bevel: 1, color: [24, 26, 32] }); s.rect(x + 2, y + 2, x + 8, y + 4, { E: CY, eAlpha: 0.7, color: CY }); }
    for (let x = 20; x < 240; x += 12) s.rect(x, 230, x + 6, 244, { h: -2, op: 'add', bevel: 1, color: [20, 22, 28] });
    s.mottle(0.06, 6, 6, 3, 1221);
    s.each((u, v, x, y, i) => { const t = fract((x - y) / 256); s.C[i * 3] += Math.exp(-Math.pow((t - 0.3) / 0.03, 2)) * 10; s.C[i * 3 + 1] += Math.exp(-Math.pow((t - 0.3) / 0.03, 2)) * 12; s.C[i * 3 + 2] += Math.exp(-Math.pow((t - 0.3) / 0.03, 2)) * 16; });
  }, { specK: 1.5, specPow: 36, shadow: 6 });
  await T('SHIPPNL2', 'textures', 256, 256, (s) => {
    s.fill(DARK, 0.9);
    panel(s, 3, 3, 58, 253, [36, 40, 50], { c: 8, c2: 0 }); panel(s, 70, 3, 186, 253, [40, 44, 56], { c: 14 }); panel(s, 198, 3, 253, 253, [36, 40, 50], { c: 8 });
    strip(s, 62, -2, 66, 258); strip(s, 190, -2, 194, 258);
    // chevrons cut into the middle panel
    for (let k = 0; k < 3; k++) { const y = 60 + k * 18; s.poly([[90, y], [128, y + 14], [166, y], [166, y + 5], [128, y + 19], [90, y + 5]], { h: -2, op: 'add', bevel: 1, color: [22, 24, 30] }); }
    // hex vent
    for (let r2 = 0; r2 < 4; r2++) for (let c = 0; c < 5; c++) { const x = 96 + c * 16 + (r2 % 2) * 8, y = 150 + r2 * 14; s.poly(Array.from({ length: 6 }, (_, k) => [x + Math.cos(k * Math.PI / 3) * 6, y + Math.sin(k * Math.PI / 3) * 6]), { h: -3, op: 'add', bevel: 1.5, color: [14, 16, 20] }); }
    s.rect(110, 226, 146, 232, { E: CY, eAlpha: 0.6, color: CY });
    s.mottle(0.06, 6, 6, 3, 1231);
  }, { specK: 1.5, specPow: 36, shadow: 6 });

  // ---------------------------------------------------------------- SHIPGLOW: backlit light panel
  await T('SHIPGLOW', 'textures', 256, 256, (s) => {
    s.fill([20, 22, 28], 0.8);
    s.rect(-4, 20, 260, 236, { h: 1, bevel: 2, op: 'set', color: [30, 50, 60] });
    s.each((u, v, x, y, i) => {
      if (y < 24 || y > 232) return;
      const hx = x / 12, hy = y / 12 * 1.1547, cell = Math.abs(fract(hx + (Math.floor(hy) % 2) * 0.5) - 0.5) + Math.abs(fract(hy) - 0.5);
      const mid = 1 - Math.pow(Math.abs((y - 128) / 108), 1.5);
      const fx = fract(x / 64), bay = Math.min(fx, 1 - fx) * 64;
      const n = fbm(u, v, 4, 4, 3, 1236);
      const b = (0.35 + 0.5 * mid) * (0.85 + n * 0.3) * sstep(0, 8, bay) - (cell > 0.88 ? 0.12 : 0);
      s.addE(i, [110, 225, 255], b);
    });
    for (let x = 0; x < 256; x += 64) s.rect(x - 3, 20, x + 3, 236, { h: 5, bevel: 2, op: 'set', color: [40, 44, 54], spec: 0.8 });
    hband(s, 14, 24, { h: 5, bevel: 2, color: [40, 44, 54], spec: 0.8 }); hband(s, 232, 242, { h: 5, bevel: 2, color: [40, 44, 54], spec: 0.8 });
  }, { specK: 1.2, shadow: 0 });

  // ---------------------------------------------------------------- SHIPDOOR: segmented angular door with a glyph lock
  await T('SHIPDOOR', 'textures', 256, 256, (s) => {
    s.fill(DARK, 0.9);
    const segs = [[[0, 0], [128, 0], [128, 110], [60, 128], [0, 128]], [[128, 0], [256, 0], [256, 128], [196, 128], [128, 110]], [[0, 128], [60, 128], [128, 146], [128, 256], [0, 256]], [[196, 128], [256, 128], [256, 256], [128, 256], [128, 146]]];
    segs.forEach((pts, k) => s.poly(pts.map(([x, y]) => [x + (x < 128 ? 2 : -2) * (x > 0 && x < 256 ? 1 : 0), y]), { h: 6, bevel: 3, op: 'set', color: [42 + k * 3, 46 + k * 3, 58 + k * 3], spec: 0.8, grow: -2.5 }));
    // central lock
    s.circle(128, 128, 26, { h: 9, bevel: 4, prof: 'round', op: 'set', color: [30, 32, 40], spec: 0.9 });
    const gm = s.mask((g) => { g.lineWidth = 2.2; g.beginPath(); g.arc(128, 128, 18, 0.3, 5.5); g.stroke(); g.beginPath(); g.moveTo(118, 128); g.lineTo(128, 118); g.lineTo(138, 128); g.lineTo(128, 138); g.closePath(); g.stroke(); }, { wrap: false });
    s.apply(gm, { color: CY, E: CY, eAlpha: 0.9 }); s.glow(gm, CY, 5, 0.4);
    // outline strip
    const om = s.mask((g) => { g.lineWidth = 2; g.strokeRect(6, 6, 244, 244); }, { wrap: false });
    s.apply(om, { color: CY, E: CY, eAlpha: 0.7 }); s.glow(om, CY, 4, 0.3);
    s.mottle(0.06, 6, 6, 3, 1241);
  }, { specK: 1.5, specPow: 36, shadow: 6 });

  // ---------------------------------------------------------------- SHIPCONS: alien console wall
  await T('SHIPCONS', 'textures', 256, 256, (s) => {
    s.fill(DARK, 0.9);
    panel(s, 4, 4, 252, 252, [34, 38, 48], { c: 14, h: 3 });
    const r = rng(1251);
    // three glyph screens
    for (const [x0, y0, x1, y1] of [[18, 20, 120, 100], [136, 20, 238, 70], [136, 80, 238, 130]]) {
      s.rect(x0 - 3, y0 - 3, x1 + 3, y1 + 3, { h: 6, bevel: 2, op: 'set', color: [26, 28, 36] });
      s.rect(x0, y0, x1, y1, { h: 2, bevel: 1, op: 'set', color: [8, 20, 26], spec: 1 });
      const gm = s.mask((g) => {
        g.lineWidth = 1.4; g.lineCap = 'round';
        for (let row = y0 + 8; row < y1 - 6; row += 10) { let x = x0 + 6; while (x < x1 - 10) { const w2 = 3 + r() * 6; g.beginPath(); g.moveTo(x, row); g.lineTo(x + w2, row + (r() - 0.5) * 6); if (r() < 0.5) g.arc(x + w2, row, 2.5, 0, r() * 5); g.stroke(); x += w2 + 4; } }
        if (x1 - x0 > 90) { g.beginPath(); g.arc((x0 + x1) / 2, (y0 + y1) / 2, 18, 0, 7); g.stroke(); g.beginPath(); g.arc((x0 + x1) / 2, (y0 + y1) / 2, 10, 1, 5); g.stroke(); }
      }, { wrap: false });
      s.apply(gm, { color: [90, 240, 230], E: [70, 220, 230], eAlpha: 0.85 });
      s.each((u, v, x, y, i) => { if (x >= x0 && x < x1 && y >= y0 && y < y1) { s.addE(i, [10, 40, 50], 0.6); if (y % 2) s.C[i * 3 + 1] *= 0.9; } });
    }
    // control crystals / pads
    for (let k = 0; k < 8; k++) { const x = 26 + (k % 4) * 26, y = 150 + Math.floor(k / 4) * 30, on = r() < 0.6, col = r() < 0.7 ? CY : [255, 150, 60]; s.poly([[x, y - 8], [x + 8, y], [x, y + 8], [x - 8, y]], { h: 5, bevel: 3, op: 'max', color: on ? mix3(col, [255, 255, 255], 0.3) : [50, 56, 64], E: on ? col : null, eAlpha: 0.7, spec: 1 }); }
    for (let k = 0; k < 5; k++) s.rect(140, 150 + k * 18, 240, 158 + k * 18, { h: -2, op: 'add', bevel: 1, color: [22, 24, 30] });
    strip(s, 140, 244, 240, 247);
  }, { specK: 1.4, specPow: 36, shadow: 8 });

  // ---------------------------------------------------------------- SHIPPOD: wall of abduction pods
  await T('SHIPPOD', 'textures', 256, 256, (s) => {
    s.fill([26, 22, 32], 0.6);
    hullPlates(s, { fx: 4, fy: 4, seed: 1261, glow: 0.05, base: [46, 36, 58] });
    s.tint(() => 0.7);
    for (const [cx, cy] of [[64, 128], [192, 128]]) {
      const rx = 44, ry = 104;
      s.stamp((px, py) => Math.hypot((px - cx) / rx, (py - cy) / ry) * Math.min(rx, ry) - Math.min(rx, ry), [cx - rx - 8, cy - ry - 8, cx + rx + 8, cy + ry + 8], { h: 10, bevel: 16, prof: 'round', op: 'set', color: [52, 92, 88], spec: 1 });
      // backlit membrane + a human silhouette
      s.each((u, v, x, y, i) => {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d > 1) return;
        s.addE(i, [40, 200, 170], (1 - d) * 0.6 + 0.1);
        const lx = x - cx, ly = y - cy;
        const head = Math.hypot(lx, ly + 62) < 9, torso = Math.abs(lx) < 13 - Math.max(0, ly + 40) * 0.02 && ly > -52 && ly < 10, legs = Math.abs(Math.abs(lx) - 6) < 4.5 && ly >= 10 && ly < 74, arms = Math.abs(Math.abs(lx) - 17) < 3.5 - (ly + 44) * 0.01 && ly > -48 && ly < 8;
        if (head || torso || legs || arms) { s.setC(i, [16, 30, 30]); s.E[i * 3] *= 0.2; s.E[i * 3 + 1] *= 0.25; s.E[i * 3 + 2] *= 0.25; }
      });
      s.ring(cx, cy, 50, 6, { h: 14, bevel: 3, prof: 'round', color: [80, 72, 90], spec: 0.8 });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; s.circle(cx + Math.cos(a) * 46, cy + Math.sin(a) * 100, 4, { h: 15, bevel: 3, prof: 'round', op: 'max', color: [120, 110, 130], spec: 0.8 }); }
    }
  }, { specK: 1.3, specPow: 24, shadow: 10 });

  // ---------------------------------------------------------------- SW1SHIP / SW2SHIP (128 x 256)
  for (const on of [0, 1]) {
    await T(on ? 'SW2SHIP' : 'SW1SHIP', 'textures', 128, 256, (s) => {
      s.fill(DARK, 0.9);
      panel(s, 3, 3, 125, 253, [38, 42, 52], { c: 10 });
      strip(s, 8, 20, 120, 23, CY, 0.6, 3);
      const cx = 64, cy = 116;
      s.poly([[cx, cy - 40], [cx + 30, cy - 10], [cx + 30, cy + 30], [cx, cy + 50], [cx - 30, cy + 30], [cx - 30, cy - 10]], { h: 8, bevel: 3, op: 'set', color: [26, 28, 36], spec: 0.9 });
      const col = on ? [80, 255, 180] : [255, 110, 50];
      s.poly([[cx, cy - 26], [cx + 16, cy], [cx, cy + 26], [cx - 16, cy]], { h: 14, bevel: 6, op: 'set', color: mix3(col, [255, 255, 255], 0.3), spec: 1 });
      const m = s.mask((g) => { g.beginPath(); g.moveTo(cx, cy - 22); g.lineTo(cx + 13, cy); g.lineTo(cx, cy + 22); g.lineTo(cx - 13, cy); g.closePath(); g.fill(); }, { wrap: false });
      s.apply(m, { E: col, eAlpha: 0.8 }); s.glow(m, col, 8, 0.5);
      const gm = s.mask((g) => { g.lineWidth = 1.5; g.beginPath(); if (on) { g.arc(cx, cy + 40, 6, 0, 7); } else { g.moveTo(cx - 6, cy + 34); g.lineTo(cx + 6, cy + 46); g.moveTo(cx + 6, cy + 34); g.lineTo(cx - 6, cy + 46); } g.stroke(); }, { wrap: false });
      s.apply(gm, { color: col, E: col, eAlpha: 0.9 });
    }, { specK: 1.5, specPow: 36, shadow: 8 });
  }

  // ---------------------------------------------------------------- flats
  const FT = (name, paint, bake = {}) => T(name, 'flats', 128, 128, paint, { light: [-0.35, -0.55, 0.76], ...bake });
  await FT('SHIPFLR1', (s) => {
    s.fill(DARK, 0.9);
    panel(s, 2, 2, 62, 62, [40, 44, 54], { c: 8, h: 3 }); panel(s, 66, 2, 126, 62, [36, 40, 50], { c: 8, h: 3 });
    panel(s, 2, 66, 62, 126, [36, 40, 50], { c: 8, h: 3 }); panel(s, 66, 66, 126, 126, [40, 44, 54], { c: 8, h: 3 });
    for (const [x, y] of [[32, 32], [96, 96]]) { s.circle(x, y, 10, { h: -1.5, op: 'add', bevel: 2, color: [24, 26, 32] }); s.ring(x, y, 7, 1.2, { E: CY, eAlpha: 0.6, color: CY }); }
    strip(s, 62.5, -2, 65.5, 130, CY, 0.5, 3); strip(s, -2, 62.5, 130, 65.5, CY, 0.5, 3);
    s.mottle(0.06, 4, 4, 3, 1281);
  }, { specK: 1.4, specPow: 30 });
  await FT('SHIPFLR2', (s) => {
    s.each((u, v, x, y, i) => {
      const t = fract(y / 32 + Math.sin(u * Math.PI * 2) * 0.05), d = Math.abs(t - 0.5) * 32;
      const n = fbm(u, v, 8, 8, 4, 1291);
      s.H[i] = Math.max(0, 1 - d / 10) * 7 + n * 1.5;
      const k = 0.7 + Math.max(0, 1 - d / 10) * 0.35 + n * 0.2;
      s.setC(i, [GUN[0] * k, GUN[1] * k, GUN[2] * k]); s.S[i] = 0.6;
      if (d > 13 && fract(x / 64) < 0.3) s.addE(i, A.teal, 0.25);
    });
  }, { specK: 1.2, specPow: 22, shadow: 8 });
  await FT('SHIPCEIL', (s) => {
    s.fill([24, 26, 32], 0.6);
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) panel(s, gx * 32 + 2, gy * 32 + 2, gx * 32 + 30, gy * 32 + 30, mix3([30, 32, 40], [40, 42, 52], hash(gx, gy, 1301)), { c: 5, h: 2 });
    for (const [x, y] of [[16, 16], [80, 80], [16, 80], [80, 16]]) s.circle(x + 16, y + 16, 2, { E: [180, 240, 255], eAlpha: 0.9, color: [200, 240, 255] });
  }, { specK: 1.2, specPow: 30 });
  await FT('SHIPGRAT', (s) => {
    s.fill([10, 30, 34]);
    s.each((u, v, x, y, i) => { const g = 0.5 + 0.5 * Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI * 2); s.addE(i, A.teal, 0.15 + g * 0.2); s.H[i] = -12; });
    s.each((u, v, x, y, i) => {
      const hx = x / 16, hy = y / 16 * 1.1547, row = Math.floor(hy);
      const cx = fract(hx + (row % 2) * 0.5) - 0.5, cy = fract(hy) - 0.5;
      const d = Math.max(Math.abs(cx) * 0.866 + Math.abs(cy) * 0.5 * 0.866, Math.abs(cy) * 0.866);
      if (d > 0.36) { s.H[i] = 4; s.setC(i, [56, 58, 70]); s.S[i] = 0.8; s.E[i * 3] = s.E[i * 3 + 1] = s.E[i * 3 + 2] = 0; }
    });
  }, { specK: 1.2, shadow: 10, shadowK: 0.7 });
  await FT('SHIPLITE', (s) => {
    s.fill([30, 32, 40], 0.6);
    panel(s, 6, 6, 122, 122, [40, 44, 54], { c: 12, h: 3 });
    s.each((u, v, x, y, i) => {
      const d = Math.max(Math.abs(x - 64), Math.abs(y - 64));
      if (d < 50) { const hx = x / 10, hy = y / 10 * 1.1547, cell = Math.abs(fract(hx + (Math.floor(hy) % 2) * 0.5) - 0.5) + Math.abs(fract(hy) - 0.5); s.setC(i, [40, 60, 70]); s.addE(i, [150, 240, 255], 0.75 + (1 - d / 50) * 0.2 - (cell > 0.85 ? 0.2 : 0)); }
    });
  }, { specK: 1, shadow: 0 });

  // ---------------------------------------------------------------- GOO1-GOO4: glowing bio-goo, seamless 4-frame loop
  for (let f = 0; f < 4; f++) {
    await FT('GOO' + (f + 1), (s) => {
      const ph = f / 4 * Math.PI * 2;
      const ox = Math.cos(ph) * 0.06, oy = Math.sin(ph) * 0.06;   // circular drift: frame 4 wraps back to frame 1
      s.each((u, v, x, y, i) => {
        const n = fbm(u + ox, v + oy, 2, 2, 4, 1311), m = fbm(u - oy * 1.5, v + ox * 1.5, 4, 4, 3, 1312);
        const fil = ridged(u + oy * 0.8 + n * 0.15, v - ox * 0.8 + m * 0.15, 3, 3, 3, 1314);
        s.H[i] = n * 2.2 + m * 0.8;
        const hot = clamp((fil - 0.72) * 4) + clamp((n - 0.55) * 2) * 0.4;
        s.setC(i, mix3([14, 52, 40], [110, 255, 180], clamp(hot))); s.S[i] = 1;
        s.addE(i, [40, 200, 120], 0.12 + clamp(hot) * 0.6);
      });
      // bubbles: each has its own phase in the loop
      const r = rng(1313);
      for (let k = 0; k < 14; k++) {
        const bx = r() * 128, by = r() * 128, p0 = r(), t = fract(p0 + f / 4), rad = 1.5 + t * 4;
        if (t > 0.85) continue; // popped
        s.circle(bx, by, rad, { h: rad * 1.4, bevel: rad, prof: 'round', op: 'add', color: [150, 255, 200], alpha: 0.6, E: [60, 220, 140], eAlpha: 0.3 });
      }
    }, { specK: 1.2, specPow: 20, shadow: 0, ao: [[2, 0.1]] });
  }
}

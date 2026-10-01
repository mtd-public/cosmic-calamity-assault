// MAP04 Chicago, the Loop, 1997: the office tower and the street (walls and flats).
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash, textMask, textWidth } from '../lib/env/tex.js';
import { hband, vband } from '../lib/env/lab.js';
import { CH, mixc, drywall, fabricAt, graniteAt, blinds, nightView, riveted } from '../lib/env/chicago.js';

export default async function (F, params = {}) {
  const only = params.only ? params.only.split(',') : null;
  const want = (n) => !only || only.includes(n);
  const T = async (name, dir, w, h, paint, bake = {}) => {
    if (!want(name)) return;
    const s = new Surf(w, h);
    await paint(s);
    await save(F, dir, name, s.bake(bake));
  };
  const font = (px, fam = '"DejaVu Sans", sans-serif') => `bold ${px}px ${fam}`;

  // ---------------------------------------------------------------- OFFCWALL: beige drywall, chair rail, cove base
  await T('OFFCWALL', 'textures', 256, 256, (s) => { drywall(s, { seed: 2101 }); }, { amb: 0.55, shadow: 6, specK: 0.6 });

  // ---------------------------------------------------------------- OFFCWIN: ribbon window with venetian blinds over a convector
  await T('OFFCWIN', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    drywall(s, { seed: 2111, rail: false });
    const y0 = 52, y1 = 196, view = nightView(2112);
    // convector cover under the sill: beige enamel with a louvre grille
    s.rect(-2, y1 + 6, w + 2, h - 8, { h: 6, bevel: 2, op: 'set', color: [196, 188, 166], spec: 0.5 });
    for (let x = 6; x < w; x += 6) s.rect(x, y1 + 12, x + 3, y1 + 26, { h: 3, op: 'sub', bevel: 1, color: [70, 66, 58] });
    // sill and the dark-bronze window frame with a mullion every 128 px
    s.rect(-2, y1, w + 2, y1 + 6, { h: 9, bevel: 2, op: 'set', color: [214, 208, 192], spec: 0.5 });
    s.rect(-2, y0 - 8, w + 2, y1, { h: 5, bevel: 2, op: 'set', color: CH.bronze, spec: 0.6 });
    for (let k = 0; k < 2; k++) {
      const px0 = k * 128 + 6, px1 = k * 128 + 122;
      const drop = [0.62, 0.95][k], tilt = [0.25, 0.55][k];
      blinds(s, px0, y0, px1, y1, { drop, tilt, inside: (x, y) => view(x - px0 + k * 116, y - y0, 232, y1 - y0), lit: 0.15, color: [204, 196, 176] });
      s.rect(px0, y0, px1, y1, { h: 0.5, op: 'add', bevel: 1.5 });
    }
    for (const x of [0, 128]) s.rect(x - 6, y0 - 8, x + 6, y1, { h: 7, bevel: 2, op: 'set', color: CH.bronze, spec: 0.6 });
    // reflections on the exposed glass
    s.each((u, v, x, y, i) => { if (y < y0 || y >= y1 || s.H[i] > 0.6) return; const t = (x - y * 0.7) / 256; const gl = Math.exp(-Math.pow((fract(t * 2) - 0.3) / 0.04, 2)) * 0.18; s.addE(i, [150, 170, 200], gl); });
    s.grime([90, 80, 66], (u, v) => sstep(0.9, 1, v) * 0.2, { seed: 2113, fx: 16, fy: 4 });
  }, { amb: 0.55, shadow: 6, specK: 0.9 });

  // ---------------------------------------------------------------- OFFCBRK: blown-out window, frame with jagged tinted glass (alpha, mid, 256 x 288)
  await T('OFFCBRK', 'textures', 256, 288, (s) => {     // 144 units: fills MAP04's window openings
    const { w, h } = s;
    s.fill([44, 54, 58]);
    s.A.fill(0);
    const r = rng(2121);
    // jagged shards along every pane edge, a few long daggers, tinted dark glass
    const shards = [];
    const edge = (n, len, dmax) => Array.from({ length: n + 1 }, (_, k) => [k / n * len, r() < 0.22 ? dmax * (0.7 + r() * 0.7) : dmax * (0.08 + r() * 0.35)]);
    for (const px of [0, 128]) {
      const x0 = px + 5, x1 = px + 123;
      const top = edge(9, x1 - x0, 46), bot = edge(9, x1 - x0, 30), lft = edge(10, h - 12, 26), rgt = edge(10, h - 12, 26);
      shards.push([[x0, 6], ...top.map(([t, d]) => [x0 + t, 6 + d]), [x1, 6]]);
      shards.push([[x0, h - 6], ...bot.map(([t, d]) => [x0 + t, h - 6 - d]), [x1, h - 6]]);
      shards.push([[x0, 6], ...lft.map(([t, d]) => [x0 + d, 6 + t]), [x0, h - 6]]);
      shards.push([[x1, 6], ...rgt.map(([t, d]) => [x1 - d, 6 + t]), [x1, h - 6]]);
    }
    shards.push([[60, 6], [82, 6], [70, 112], [64, 80]]);
    shards.push([[200, h - 6], [228, h - 6], [214, 150]]);
    const m = s.mask((g) => { for (const p of shards) { g.beginPath(); p.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); } }, { wrap: false });
    const em = s.bevelOf(m, 3);
    for (let i = 0; i < s.n; i++) {
      if (m[i] <= 0) continue;
      const x = i % w, y = (i / w) | 0;
      const edgeHi = clamp(1 - em[i]) * m[i];
      const refl = 0.5 + 0.5 * Math.sin((x - y * 0.6) * 0.05);
      s.setC(i, mixc([40, 52, 56], [120, 140, 150], refl * 0.4));
      s.setC(i, [230, 244, 240], edgeHi * 0.8);
      s.A[i] = (130 + edgeHi * 110) / 255 * m[i];
    }
    // crack lines in the remaining pieces
    const cm = s.mask((g) => {
      g.lineWidth = 1;
      for (let k = 0; k < 22; k++) {
        const px = (k % 2) * 128, side = r.int(0, 3); let x, y;
        if (side === 0) { x = px + 5 + r() * 118; y = 6; } else if (side === 1) { x = px + 5 + r() * 118; y = h - 6; } else if (side === 2) { x = px + 5; y = r() * h; } else { x = px + 123; y = r() * h; }
        g.beginPath(); g.moveTo(x, y);
        const a = Math.atan2(h / 2 - y, px + 64 - x) + (r() - 0.5) * 1.2;
        for (let j = 0; j < 3; j++) { x += Math.cos(a + (r() - 0.5) * 0.8) * 12; y += Math.sin(a + (r() - 0.5) * 0.8) * 12; g.lineTo(x, y); }
        g.stroke();
      }
    }, { wrap: false });
    for (let i = 0; i < s.n; i++) if (m[i] > 0.5 && cm[i] > 0.1) { s.A[i] = Math.max(s.A[i], 0.85 * cm[i]); s.setC(i, [236, 250, 248], cm[i]); }
    // the frame: dark bronze aluminium, sill and head, a mullion every 128 px
    const frame = (x0, y0, x1, y1) => s.rect(x0, y0, x1, y1, { h: 6, bevel: 1.5, op: 'set', color: CH.bronze, spec: 0.7, a: 1 });
    frame(-2, 0, w + 2, 7); frame(-2, h - 7, w + 2, h);
    for (const x of [0, 128]) frame(x - 6, 0, x + 6, h);
    for (const x of [0, 128]) for (let y = 16; y < h; y += 32) s.bolt(x, y, 1.3, { h: 1, color: [96, 84, 70] });
    // a mangled blind hanging from the head in the left pane
    for (let k = 0; k < 9; k++) {
      const yy = 10 + k * 5, sag = k * k * 0.4, x0 = 24 + k * 2, x1 = 96 - k * 6;
      s.seg(x0, yy + sag * 0.3, x1, yy + sag + (k % 3) * 2, 1.4, { h: 2, op: 'set', color: [200, 192, 172], a: 1 });
    }
    s.seg(30, 7, 32, 60, 0.6, { color: [210, 204, 186], a: 1 });
    s.seg(88, 7, 70, 64, 0.6, { color: [210, 204, 186], a: 1 });
    // soot on the frame
    s.grime(CH.soot, (u, v) => 0.35, { fx: 6, fy: 6, seed: 2122, contrast: 2.4 });
  }, { ao: [[1.5, 0.15]], shadow: 0, specK: 1.0, amb: 0.6 });

  // ---------------------------------------------------------------- CUBEWALL: grey-blue fabric partition (two 2 m modules, cap at the top)
  await T('CUBEWALL', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(CH.trim, 0.3);
    for (let m = 0; m < 2; m++) {
      const y0 = m * 128;
      // fabric field
      s.rect(-2, y0 + 8, w + 2, y0 + 118, {
        h: 3, bevel: 2, prof: 'round', op: 'set',
        fn: (i, cov, t, d, px, py) => { const [c, hh] = fabricAt(mod(px, w), mod(py, h), CH.fabric, 2131); s.setC(i, c, cov); s.H[i] += hh * cov; s.S[i] = 0; },
      });
      // top cap and base trim
      s.rect(-2, y0, w + 2, y0 + 8, { h: 6, bevel: 3, prof: 'round', op: 'set', color: CH.trim, spec: 0.5 });
      s.rect(-2, y0 + 118, w + 2, y0 + 128, { h: 4, bevel: 1.5, op: 'set', color: CH.trimDk, spec: 0.3 });
      for (let x = 8; x < w; x += 16) s.rect(x, y0 + 121, x + 8, y0 + 124, { h: 2, op: 'sub', bevel: 0.5, color: [60, 62, 64] });
      // panel connector posts every 128 px
      for (const x of [0, 128]) s.rect(x - 4, y0, x + 4, y0 + 128, { h: 7, bevel: 2, prof: 'round', op: 'set', color: CH.trim, spec: 0.5 });
    }
    // pinned to the top module: a memo, sticky notes, a calendar, a snapshot
    s.art((g) => {
      const pin = (x, y, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); };
      g.save(); g.translate(26, 22); g.rotate(-0.04);
      g.fillStyle = '#f2efe4'; g.fillRect(0, 0, 44, 58);
      g.fillStyle = '#222'; g.font = font(6); g.fillText('MEMORANDUM', 4, 9);
      g.fillStyle = 'rgba(40,40,50,0.7)'; for (let y = 14; y < 54; y += 4) g.fillRect(4, y, 18 + ((y * 7) % 18), 1.4);
      g.restore(); pin(48, 24, '#d02020');
      g.fillStyle = '#f4e45a'; g.fillRect(76, 28, 18, 17); g.fillStyle = 'rgba(30,30,80,0.7)'; g.fillRect(79, 33, 11, 1.2); g.fillRect(79, 37, 8, 1.2);
      g.fillStyle = '#f4e45a'; g.fillRect(80, 52, 16, 15); g.fillStyle = '#ff9fc0'; g.fillRect(98, 30, 15, 15);
      g.save(); g.translate(150, 18); g.rotate(0.02);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 50, 66); g.fillStyle = '#3a6ab0'; g.fillRect(0, 0, 50, 26);
      g.fillStyle = '#fff'; g.font = font(8); g.fillText('JUNE', 4, 11); g.font = font(7); g.fillText('1997', 28, 11);
      g.fillStyle = '#2a4a80'; g.fillRect(4, 14, 42, 9);
      g.fillStyle = '#333'; for (let r2 = 0; r2 < 5; r2++) for (let c2 = 0; c2 < 7; c2++) g.fillRect(3 + c2 * 6.5, 30 + r2 * 7, 4, 3);
      g.fillStyle = '#c02020'; g.beginPath(); g.arc(3 + 4 * 6.5 + 2, 30 + 2 * 7 + 1.5, 3.5, 0, 7); g.strokeStyle = '#c02020'; g.lineWidth = 1; g.stroke();
      g.restore(); pin(175, 20, '#2050d0');
      g.save(); g.translate(212, 40); g.rotate(0.12); g.fillStyle = '#eee'; g.fillRect(0, 0, 26, 20); g.fillStyle = '#5a7aa0'; g.fillRect(2, 2, 22, 9); g.fillStyle = '#5a8a4a'; g.fillRect(2, 11, 22, 7); g.fillStyle = '#d8a080'; g.beginPath(); g.arc(9, 10, 3, 0, 7); g.arc(16, 9, 3, 0, 7); g.fill(); g.restore();
    });
    s.rect(24, 20, 72, 82, { h: 0.6, op: 'add', bevel: 0.5 }); s.rect(148, 16, 202, 86, { h: 0.6, op: 'add', bevel: 0.5 });
    s.grime([60, 66, 74], (u, v) => (fract(v * 2) > 0.8 ? 0.25 : 0.05), { seed: 2132, fx: 12, fy: 6, contrast: 2 });
  }, { amb: 0.55, shadow: 5, specK: 0.7 });

  // ---------------------------------------------------------------- ELEVLOBY: brass elevator doors in a green-marble surround
  await T('ELEVLOBY', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    // verde marble slabs
    s.each((u, v, x, y, i) => {
      const sx = Math.floor(x / 128), sy = Math.floor(y / 128);
      let lx = (x % 128) / 128, ly = (y % 128) / 128; if (sx % 2) lx = 1 - lx; if (sy % 2) ly = 1 - ly;
      const t = fbm(lx * 0.5 + 0.2, ly * 0.5 + 0.3, 3, 3, 6, 2141), cl = fbm(lx, ly, 5, 5, 4, 2145);
      const vein = Math.abs(Math.sin((lx * 1.3 - ly * 0.9 + t * 3.2) * Math.PI)), vein2 = Math.abs(Math.sin((lx * 0.7 + ly * 1.6 + cl * 4) * Math.PI));
      let c = mixc([20, 40, 34], [44, 76, 62], clamp((cl - 0.35) * 2.2));
      c = mixc(c, [180, 196, 180], clamp(1 - vein * 30) * 0.8);
      c = mixc(c, [120, 150, 130], clamp(1 - vein2 * 40) * 0.5);
      c = mixc(c, [12, 26, 22], clamp((0.42 - cl) * 3) * 0.6);
      s.setC(i, c); s.S[i] = 0.9;
      s.H[i] = Math.min(x % 128, 127 - (x % 128), y % 128, 127 - (y % 128)) < 1 ? -1 : 0;
    });
    const dx0 = 82, dx1 = 174, dy0 = 92, dy1 = 250;
    // brass architrave, sill, and the doors
    s.rect(dx0 - 12, dy0 - 12, dx1 + 12, h + 2, { h: 6, bevel: 3, prof: 'round', op: 'set', color: CH.brass, spec: 0.9 });
    s.rect(dx0 - 4, dy0 - 4, dx1 + 4, h + 2, { h: 4, bevel: 1.5, op: 'set', color: CH.brassDk, spec: 0.7 });
    for (const [x0, x1, flip] of [[dx0, 128, 0], [128, dx1, 1]]) {
      s.rect(x0 + 0.5, dy0, x1 - 0.5, dy1, {
        h: 5, bevel: 1, op: 'set',
        fn: (i, cov, t, d, px, py) => { const b = fbm(px / 256, py / 256, 64, 2, 2, 2142 + flip); const k = 0.92 + b * 0.16; s.setC(i, [CH.brass[0] * k, CH.brass[1] * k, CH.brass[2] * k], cov); s.S[i] = 0.9; },
      });
    }
    s.rect(127, dy0, 129, dy1, { h: 0, op: 'set', bevel: 0.5, color: [30, 22, 12] });
    // etched art deco: a sunburst at the top of each leaf, a reeded field and chevrons
    const etch = s.mask((g) => {
      g.lineWidth = 1;
      for (const [cx, dir] of [[dx0 + 23, 1], [dx1 - 23, -1]]) {
        const cy = dy0 + 44;
        for (let k = 0; k <= 10; k++) { const a = Math.PI + k / 10 * Math.PI; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 34); g.stroke(); }
        g.beginPath(); g.arc(cx, cy, 10, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(cx, cy, 20, Math.PI, 0); g.stroke();
        g.beginPath(); g.moveTo(cx - 40, cy + 2); g.lineTo(cx + 40, cy + 2); g.stroke();
        for (let y = cy + 12; y < cy + 46; y += 8) { g.beginPath(); g.moveTo(cx - 18, y + 6); g.lineTo(cx, y); g.lineTo(cx + 18, y + 6); g.stroke(); }
        for (let x = -16; x <= 16; x += 4) { g.beginPath(); g.moveTo(cx + x, cy + 56); g.lineTo(cx + x, dy1 - 14); g.stroke(); }
      }
    }, { wrap: false });
    s.apply(etch, { h: 0.8, op: 'sub', color: CH.brassDk, alpha: 0.8 });
    // floor dial above the doors
    const cx = 128, cy = 62, R = 26;
    s.rect(cx - R - 8, cy - R - 8, cx + R + 8, cy + 12, { h: 6, bevel: 2, op: 'set', color: CH.brass, spec: 0.9, r: 4 });
    const dial = s.mask((g) => { g.beginPath(); g.arc(cx, cy + 4, R, Math.PI, 0); g.closePath(); g.fill(); }, { wrap: false });
    s.apply(dial, { h: 5, op: 'set', color: [236, 196, 120], E: [255, 170, 60], eAlpha: 0.55 });
    s.glow(dial, [255, 170, 60], 5, 0.3);
    const ticks = s.mask((g) => {
      g.lineWidth = 1.2; g.font = font(7); g.textAlign = 'center';
      for (let k = 0; k <= 8; k++) { const a = Math.PI + k / 8 * Math.PI; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 6), cy + 4 + Math.sin(a) * (R - 6)); g.lineTo(cx + Math.cos(a) * (R - 2), cy + 4 + Math.sin(a) * (R - 2)); g.stroke(); }
      for (const [k, t] of [[0, 'L'], [4, '20'], [8, '40']]) { const a = Math.PI + k / 8 * Math.PI; g.fillText(t, cx + Math.cos(a) * (R - 12), cy + 7 + Math.sin(a) * (R - 12)); }
    }, { wrap: false });
    s.apply(ticks, { color: [60, 36, 14] });
    s.seg(cx, cy + 4, cx + Math.cos(-0.7) * (R - 4), cy + 4 + Math.sin(-0.7) * (R - 4), 1.2, { h: 6, op: 'set', color: [40, 24, 10] });
    s.circle(cx, cy + 4, 3, { h: 7, bevel: 2, prof: 'round', op: 'set', color: CH.brassDk, spec: 0.9 });
    // call buttons
    s.rect(196, 142, 214, 186, { h: 5, bevel: 1.5, op: 'set', color: CH.brass, spec: 0.9, r: 2 });
    for (const [y, up] of [[155, 1], [173, 0]]) {
      s.circle(205, y, 5, { h: 7, bevel: 2, prof: 'round', op: 'set', color: up ? [255, 230, 170] : [190, 170, 130], spec: 0.9 });
      if (up) { const bm = s.mask((g) => { g.beginPath(); g.arc(205, y, 4.5, 0, 7); g.fill(); }, { wrap: false }); s.apply(bm, { E: [255, 200, 110], eAlpha: 0.7 }); s.glow(bm, [255, 190, 90], 4, 0.4); }
      s.poly(up ? [[202, y + 2], [208, y + 2], [205, y - 2.5]] : [[202, y - 2], [208, y - 2], [205, y + 2.5]], { color: [80, 50, 20] });
    }
    s.grain(0.015, 2143);
    s.grime([20, 16, 10], (u, v, x, y) => (x > dx0 && x < dx1 && y > 200 ? 0.2 : 0), { seed: 2144, fx: 12, fy: 6 });
  }, { specK: 1.1, specPow: 30, shadow: 6, amb: 0.5 });

  // ---------------------------------------------------------------- SCORCH: fire-blackened office wall
  await T('SCORCH', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    const { railY } = drywall(s, { seed: 2101 });
    // heat field: smoke layer under the ceiling plus plumes rising from three fires
    const heat = (u, v) => {
      const top = sstep(0.55, 0.0, v) * 0.9;
      let pl = 0;
      for (const [c, wd] of [[0.18, 0.1], [0.62, 0.14], [0.92, 0.07]]) {
        const d = Math.abs(mod(u - c + 0.5, 1) - 0.5);
        pl = Math.max(pl, clamp(1.1 - d / (wd * (0.25 + Math.pow(1 - v, 1.3) * 2.6))) * (0.5 + 0.5 * sstep(1, 0.5, v)));   // V widening upward
        pl = Math.max(pl, clamp(1 - d / (wd * 0.8)) * sstep(0.84, 0.97, v));                                                // charred base where it burned
      }
      return clamp(Math.max(top, pl) + (fbm(u, v, 6, 6, 4, 2151) - 0.5) * 0.7);
    };
    s.each((u, v, x, y, i) => {
      const k = heat(u, v), n = fbm(u, v, 24, 24, 3, 2152);
      if (k <= 0.05) return;
      const brown = mixc(s.getC(i), [120, 84, 50], sstep(0.05, 0.35, k) * 0.8);
      const black = mixc(brown, CH.soot, sstep(0.3, 0.75, k) * (0.85 + n * 0.15));
      s.setC(i, black);
      // blistered, peeling paint where it got hot
      if (k > 0.5 && n > 0.62) { s.H[i] += (n - 0.62) * 9; s.setC(i, mixc(s.getC(i), [80, 66, 52], 0.4)); }
      if (k > 0.9 && v > 0.8 && hash(x >> 1, y >> 1, 2153) < 0.03) s.setC(i, [255, 120, 30], 0.6);   // embers at the base
    });
    // a hole burnt through to the metal studs
    const hole = (px, py) => { const a = Math.atan2(py - 160, px - 168), rr = 30 + Math.sin(a * 3 + 1) * 6 + Math.sin(a * 7) * 3 + Math.sin(a * 11 + 2) * 2; return Math.hypot((px - 168) / 1.15, py - 160) - rr; };
    s.stamp(hole, [120, 110, 216, 210], { h: -6, op: 'add', bevel: 1, color: [14, 12, 12] });
    s.stamp((px, py) => Math.abs(hole(px, py) - 2.5) - 2.5, [116, 106, 220, 214], { fn: (i, cov) => s.setC(i, mixc(s.getC(i), [40, 30, 24], 0.7), cov) });
    for (const sx of [150, 190]) s.stamp((px, py) => Math.max(Math.abs(px - sx) - 4, hole(px, py)), [sx - 4, 110, sx + 4, 210], { h: 5, op: 'set', bevel: 1, color: [120, 122, 124], spec: 0.8 });
    s.stamp((px, py) => Math.max(Math.abs(px - 170) - 14, hole(px, py) + 2), [150, 110, 190, 210], { fn: (i, cov, t, d, px, py) => { if (hash(px, py >> 1, 2154) < 0.5) s.setC(i, [150, 120, 70], cov * 0.7); } });   // charred insulation
    s.rect(-2, railY, w + 2, railY + 7, { fn: (i, cov, t, d, px) => s.setC(i, mixc(s.getC(i), CH.char, clamp(heat(mod(px, w) / w, (railY + 3) / h) * 1.2)), cov) });
    s.grain(0.03, 2155);
  }, { amb: 0.5, shadow: 8, specK: 0.6 });

  // ---------------------------------------------------------------- LTRACK: the "L" structure, riveted green lattice (alpha, mid)
  await T('LTRACK', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(CH.lgreen, 0.35);
    s.A.fill(0);
    const G = CH.lgreen, A1 = { a: 1 };
    // tie ends and the guard timber along the top
    // the deck edge is solid (the map uses the top 16 units as a 3D-floor side): dark stringer, tie ends, guard timber
    s.rect(-2, 0, w + 2, 10, { h: 3, bevel: 0.5, op: 'max', color: [34, 28, 24], a: 1 });
    for (let x = 0; x < w; x += 16) s.rect(x + 2, 0, x + 13, 9, { h: 5, bevel: 1.5, op: 'max', color: [74, 56, 42], a: 1 });
    s.rect(-2, 3, w + 2, 7, { h: 6, bevel: 1, op: 'max', color: [62, 48, 36], a: 1 });
    // top and bottom chords
    riveted(s, -2, 9, w + 2, 32, { h: 7, color: G, pitch: 8, inset: 3.5, a: 1 });
    s.rect(-2, 18, w + 2, 20, { h: 7.5, bevel: 0.6, op: 'max', color: mixc(G, [0, 0, 0], 0.2), a: 1 });
    riveted(s, -2, 92, w + 2, 106, { h: 7, color: G, pitch: 8, inset: 3.5, a: 1 });
    // lattice web: posts every 64 px, double diagonal lacing
    for (let x = 0; x <= w; x += 64) riveted(s, x - 5, 32, x + 5, 92, { h: 8, color: CH.lgreenDk, pitch: 9, inset: 2.5, a: 1 });
    for (let x = 0; x < w; x += 32) {
      s.seg(x + 2, 34, x + 30, 90, 3, { h: 5, bevel: 1, op: 'max', color: G, a: 1 });
      s.seg(x + 30, 34, x + 2, 90, 3, { h: 4.5, bevel: 1, op: 'max', color: mixc(G, [0, 0, 0], 0.12), a: 1 });
      s.bolt(x + 16, 62, 1.8, { h: 1.2, color: G });
    }
    // lattice column under the girder: two channels with zigzag lacing and batten plates
    const cx = 128;
    for (const x of [cx - 22, cx + 12]) riveted(s, x, 106, x + 10, h + 2, { h: 9, color: G, pitch: 10, inset: 2.5, a: 1 });
    for (let y = 120; y < h; y += 26) { s.seg(cx - 13, y, cx + 13, y + 13, 2.4, { h: 6, bevel: 1, op: 'max', color: G, a: 1 }); s.seg(cx + 13, y + 13, cx - 13, y + 26, 2.4, { h: 6, bevel: 1, op: 'max', color: G, a: 1 }); }
    riveted(s, cx - 24, 106, cx + 24, 126, { h: 10, color: G, pitch: 8, inset: 3, a: 1 });
    riveted(s, cx - 24, 210, cx + 24, 224, { h: 10, color: G, pitch: 8, inset: 3, a: 1 });
    // knee braces with gusset plates
    for (const sg of [-1, 1]) {
      const bx = cx + sg * 22, by = 176, tx = cx + sg * 86;
      s.seg(bx, by, tx, 104, 4.5, { h: 7, bevel: 1.5, op: 'max', color: G, a: 1 });
      s.seg(bx, by - 8, tx - sg * 8, 104, 2.5, { h: 6.5, bevel: 1, op: 'max', color: mixc(G, [0, 0, 0], 0.1), a: 1 });
      for (let t = 0.15; t < 0.95; t += 0.14) s.bolt(bx + (tx - bx) * t, by + (104 - by) * t, 1.5, { h: 1.2, color: G });
      s.poly([[tx - sg * 22, 104], [tx + sg * 10, 104], [tx - sg * 6, 120]], { h: 7.5, bevel: 1, op: 'max', color: G, a: 1 });
      s.poly([[bx, by - 26], [bx, by + 10], [bx + sg * 16, by - 14]], { h: 9.5, bevel: 1, op: 'max', color: G, a: 1 });
    }
    // paint wear, rust and pigeon-grime
    s.each((u, v, x, y, i) => {
      if (s.A[i] < 0.01) return;
      const n = fbm(u, v, 8, 8, 4, 2161), r2 = fbm(u, v, 24, 24, 3, 2162);
      const k = 0.82 + n * 0.3;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
      if (r2 > 0.64) s.setC(i, mixc([120, 66, 36], [80, 46, 30], hash(x, y, 2163)), sstep(0.64, 0.72, r2) * 0.85);
    });
    s.streaks([110, 62, 34], { amount: 0.45, fx: 32, seed: 2164, len: 0.2, start: () => 32 / 256 });
    s.edgeWear([90, 120, 100], 0.6, 1, 2165);
  }, { ao: [[1.5, 0.25], [4, 0.1]], shadow: 6, shadowK: 0.5, specK: 0.8, amb: 0.5 });

  // ---------------------------------------------------------------- LTRAIN: a CTA "L" car side (512 x 288 = 144 units, the MAP04 slab sides), lit inside
  await T('LTRAIN', 'textures', 512, 288, (s) => {
    const { w, h } = s, dy = 32;              // the extra 16 units go into a taller roof and letterboard
    const steel = [176, 180, 182];
    s.fill([22, 22, 24], 0.2);
    // body shell (car from x = 6 to 486; the gap between cars to 512)
    const bx0 = 6, bx1 = 486, roof = 10, floor = 206 + dy;
    s.rect(bx0, roof, bx1, floor, { h: 8, bevel: 4, op: 'set', color: steel, spec: 0.8, r: 8 });
    s.each((u, v, x, y, i) => {
      if (x < bx0 || x >= bx1 || y < roof || y >= floor) return;
      const b = fbm(u, v, 128, 2, 2, 2171), k = 0.9 + b * 0.12 - (y < roof + 24 ? (roof + 24 - y) * 0.012 : 0);
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
      if (y > 138 + dy && y < floor - 6) { const f = mod(x, 6); s.H[i] += f < 3 ? 1.2 : 0; if (f === 0 || f === 3) { s.C[i * 3] *= 0.85; s.C[i * 3 + 1] *= 0.85; s.C[i * 3 + 2] *= 0.85; } }
    });
    // roof cove, rain gutter, letterboard
    hband(s, roof + 22, roof + 25, { h: 10, bevel: 1, op: 'max', color: [130, 134, 136], spec: 0.8 });
    hband(s, roof + 50, roof + 52, { h: 9, bevel: 0.8, op: 'max', color: [150, 154, 156], spec: 0.8 });
    for (let x = 40; x < bx1 - 20; x += 110) s.rect(x, roof + 4, x + 40, roof + 14, { h: 9, bevel: 2, op: 'max', color: [120, 124, 126], spec: 0.6 });   // roof vents
    // interior seen through the windows: lit fluorescent ceiling, seats, poles, a passenger or two
    const interior = (x, y, x0, y0, x1, y1) => {
      const ly = (y - y0) / (y1 - y0);
      let c = mixc([220, 228, 210], [120, 126, 116], sstep(0, 0.4, ly));
      if (ly < 0.1) c = [250, 252, 236];
      if (ly > 0.62) c = mixc([150, 90, 60], [110, 66, 44], hash(x >> 3, 1, 3));            // seat backs
      if (mod(x, 37) < 2) c = [200, 200, 196];                                                  // stanchions
      if (ly > 0.2 && ly < 0.62) c = mixc(c, [150, 156, 150], 0.25 + 0.1 * Math.sin(x * 0.3));                 // far-side windows
      return c;
    };
    const win = (x0, y0, x1, y1) => {
      s.rect(x0 - 3, y0 - 3, x1 + 3, y1 + 3, { h: 6, bevel: 2, op: 'set', color: [26, 26, 26], r: 5 });
      s.rect(x0, y0, x1, y1, { h: 3, bevel: 1, op: 'set', r: 4, fn: (i, cov, t, d, px, py) => { const c = interior(px, py, x0, y0, x1, y1); s.setC(i, c, cov); s.addE(i, c, cov * 0.45); s.S[i] = 1; } });
    };
    for (const [x0, x1] of [[24, 98], [106, 180], [296, 370], [378, 452]]) win(x0, 62 + dy, x1, 120 + dy);
    // the doors (bi-parting) with their windows and an indicator light
    const d0 = 196, d1 = 278;
    s.rect(d0 - 4, 40 + dy, d1 + 4, floor, { h: 5, bevel: 2, op: 'set', color: [40, 40, 42] });
    for (const [x0, x1] of [[d0, (d0 + d1) / 2 - 1], [(d0 + d1) / 2 + 1, d1]]) {
      s.rect(x0, 44 + dy, x1, floor - 2, { h: 7, bevel: 1.5, op: 'set', color: mixc(steel, [0, 0, 0], 0.06), spec: 0.8 });
      win(x0 + 6, 62 + dy, x1 - 6, 126 + dy);
    }
    const lm = s.mask((g) => { g.fillRect((d0 + d1) / 2 - 8, 30 + dy, 16, 6); }, { wrap: false });
    s.apply(lm, { h: 9, op: 'set', color: [255, 190, 80], E: [255, 160, 40], eAlpha: 0.8 }); s.glow(lm, [255, 160, 40], 4, 0.4);
    // stripes and lettering
    hband(s, 128 + dy, 132 + dy, { op: 'set', h: 8, color: [180, 30, 36] });
    hband(s, 133 + dy, 136 + dy, { op: 'set', h: 8, color: [30, 60, 150] });
    for (const [x0, x1] of [[bx1, w + 2], [-2, bx0]]) s.rect(x0, 0, x1, h, { h: 0, op: 'set', color: [10, 10, 12] });
    hband(s, 0, roof, { op: 'set', h: 0, color: [12, 12, 14] });
    s.apply(textMask(s, '2731', 452, 160 + dy, { font: font(12), align: 'right' }), { color: [24, 24, 26] });
    // route sign in the first window
    s.rect(30, 66 + dy, 92, 82 + dy, { h: 4, op: 'set', color: [20, 20, 20] });
    s.rect(32, 68 + dy, 42, 80 + dy, { h: 4, op: 'set', color: [120, 72, 40] });
    const rs = textMask(s, 'LOOP', 68, 79 + dy, { font: font(11), align: 'center' }); s.apply(rs, { color: [255, 230, 160], E: [255, 210, 120], eAlpha: 0.7 });
    // underframe, trucks and wheels
    s.rect(bx0 + 4, floor, bx1 - 4, floor + 18, { h: 5, bevel: 1.5, op: 'set', color: [36, 36, 38] });
    for (const tx of [70, 400]) {
      s.rect(tx - 50, floor + 14, tx + 50, floor + 34, { h: 7, bevel: 2, op: 'set', color: [44, 42, 40] });
      for (const wx of [tx - 30, tx + 30]) { s.circle(wx, h - 18, 16, { h: 9, bevel: 3, op: 'max', color: [56, 52, 48], spec: 0.5 }); s.circle(wx, h - 18, 5, { h: 11, bevel: 2, op: 'max', color: [90, 86, 80], spec: 0.6 }); }
    }
    s.rect(-2, h - 4, w + 2, h, { h: 1, op: 'set', color: [100, 100, 104], spec: 0.9 });          // the running rail
    // grime: road dirt low on the body, streaks from the roof
    s.grime([90, 84, 72], (u, v) => sstep(0.6, 0.82, v) * 0.35, { seed: 2173, fx: 16, fy: 4 });
    s.streaks([120, 112, 96], { amount: 0.3, fx: 48, seed: 2174, len: 0.3, start: () => (36 + dy) / h });
  }, { specK: 1.1, shadow: 6, amb: 0.5 });

  // ---------------------------------------------------------------- GRANITE: Loop granite ashlar (pink-grey, 2 m x 1 m blocks)
  await T('GRANITE', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    s.each((u, v, x, y, i) => {
      const row = Math.floor(y / 64), off = (row % 2) * 64, bx = mod(x + off, 256), col = Math.floor(bx / 128);
      const fx = bx - col * 128, fy = y - row * 64, d = Math.min(fx, 127 - fx, fy, 63 - fy);
      const tone = 0.92 + hash(col, row, 2181) * 0.12;
      const c = graniteAt(u, v, x, y, 2182);
      s.setC(i, [c[0] * tone, c[1] * tone, c[2] * tone]); s.S[i] = 0.35;
      s.H[i] = d < 2 ? -2 + d * 0.5 : 2 * clamp(d / 3) + hash(x, y, 2183) * 0.3;
      if (d < 1.5) s.setC(i, [70, 62, 60]);
    });
    // weathering: soot washing down from the joints, a little efflorescence
    s.streaks([64, 58, 56], { amount: 0.45, fx: 32, seed: 2184, len: 0.15, start: () => 2 / 256 });
    s.streaks([64, 58, 56], { amount: 0.4, fx: 32, seed: 2185, len: 0.15, start: () => 66 / 256 });
    s.grime([60, 54, 52], (u, v) => 0.15 + sstep(0.7, 1, v) * 0.2, { seed: 2186, fx: 8, fy: 8, contrast: 2 });
  }, { specK: 0.7, specPow: 30, shadow: 5, amb: 0.5 });

  // ---------------------------------------------------------------- TERRACTA: white glazed terracotta facade (Wrigley style), one floor
  await T('TERRACTA', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    const glaze = CH.terra;
    s.fill(glaze, 0.7);
    // terracotta blocks with fine joints, glaze crazing
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 4, 2191), k = 0.93 + n * 0.08 + (hash(x >> 4, y >> 4, 2192) - 0.5) * 0.04;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k * 0.98;
      const [f1, f2] = worley(u, v, 40, 40, 2193);
      if (f2 - f1 < 0.03) { s.C[i * 3] *= 0.93; s.C[i * 3 + 1] *= 0.93; s.C[i * 3 + 2] *= 0.93; }
      if (mod(y, 32) === 0 || mod(x + (Math.floor(y / 32) % 2) * 16, 32) === 0) { s.H[i] -= 0.8; s.setC(i, [150, 144, 128], 0.6); }
    });
    // piers with fluting
    for (const px of [0, 128]) {
      s.rect(px - 14, -2, px + 14, h + 2, { h: 9, bevel: 3, op: 'max', fn: (i, cov) => s.setC(i, mixc(s.getC(i), [236, 232, 216], 0.4), cov) });
      for (const f of [-8, -3, 2, 7]) s.rect(px + f, -2, px + f + 2, h + 2, { h: 1.6, op: 'sub', bevel: 1 });
    }
    // windows: recessed double-hung sash, some lit
    for (const [bx, lit] of [[64, 0], [192, 1]]) {
      const x0 = bx - 44, x1 = bx + 44, y0 = 34, y1 = 168;
      s.rect(x0 - 4, y0 - 4, x1 + 4, y1 + 2, { h: -2, op: 'add', bevel: 2, color: [200, 192, 172] });
      const view = nightView(2194 + bx);
      s.rect(x0, y0, x1, y1, {
        h: -6, op: 'set', bevel: 1, fn: (i, cov, t, d, px, py) => {
          const lx = px - x0, ly = py - y0;
          let c = lit ? mixc([236, 210, 150], [170, 140, 96], ly / (y1 - y0)) : view(lx, ly, x1 - x0, y1 - y0);
          if (lit && ly > 90 && lx > 20 && lx < 60) c = [90, 70, 50];
          s.setC(i, c, cov); s.S[i] = 1; if (lit) s.addE(i, c, cov * 0.5);
        },
      });
      // sash frames (cream painted)
      const fr = (a, b, c2, d) => s.rect(a, b, c2, d, { h: -3, op: 'set', bevel: 1, color: [222, 214, 190], spec: 0.4 });
      fr(x0, y0, x1, y0 + 4); fr(x0, y1 - 4, x1, y1); fr(x0, y0, x0 + 4, y1); fr(x1 - 4, y0, x1, y1); fr(x0, 98, x1, 104); fr(bx - 2, y0, bx + 2, y1);
    }
    // sill band, spandrel ornament, lintel band with dentils
    s.rect(-2, 168, w + 2, 178, { h: 12, bevel: 3, prof: 'round', op: 'max', color: [238, 234, 220], spec: 0.8 });
    s.rect(-2, 12, w + 2, 22, { h: 10, bevel: 2, op: 'max', color: [236, 232, 218] });
    for (let x = 2; x < w; x += 8) s.rect(x, 22, x + 5, 28, { h: 8, bevel: 1, op: 'max', color: [230, 226, 210] });
    for (const bx of [64, 192]) {
      const y0 = 186, y1 = 246;
      s.rect(bx - 46, y0, bx + 46, y1, { h: 2, bevel: 2, op: 'add', color: [228, 222, 204] });
      s.rect(bx - 40, y0 + 6, bx + 40, y1 - 6, { h: -1.5, bevel: 1.5, op: 'add' });
      const orn = s.mask((g) => {
        g.lineWidth = 2.4; const cy = (y0 + y1) / 2;
        g.beginPath(); g.arc(bx, cy, 12, 0, 7); g.stroke();
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.ellipse(bx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 4, 1.6, a, 0, 7); g.fill(); }
        for (const sg of [-1, 1]) {
          g.beginPath(); g.moveTo(bx + sg * 14, cy); g.bezierCurveTo(bx + sg * 22, cy - 14, bx + sg * 32, cy - 2, bx + sg * 26, cy + 6); g.stroke();
          g.beginPath(); g.moveTo(bx + sg * 26, cy + 6); g.bezierCurveTo(bx + sg * 20, cy + 12, bx + sg * 34, cy + 16, bx + sg * 36, cy + 4); g.stroke();
          g.beginPath(); g.ellipse(bx + sg * 30, cy - 10, 5, 2.4, sg * 0.6, 0, 7); g.fill();
        }
      }, { wrap: false });
      s.apply(orn, { h: 3, bevel: 1.2, op: 'add', color: [240, 236, 224] });
    }
    // soot streaks under the sills, grime collected on ledges
    s.streaks([110, 104, 92], { amount: 0.4, fx: 32, seed: 2195, len: 0.25, start: () => 178 / 256 });
    s.streaks([120, 114, 100], { amount: 0.3, fx: 24, seed: 2196, len: 0.3, start: () => 28 / 256 });
  }, { specK: 1.0, specPow: 28, shadow: 10, amb: 0.5 });

  // ---------------------------------------------------------------- TOWERWIN: dark glass curtain wall, a few offices still lit
  await T('TOWERWIN', 'textures', 256, 256, (s) => {
    const { w, h } = s;
    const sp1 = 56, sp2 = 212;                      // opaque spandrel bands at the floor slab
    const refl = nightView(2206);
    s.each((u, v, x, y, i) => {
      const col = Math.floor(x / 64), lx = mod(x, 64), ly = y;
      if (ly < sp1 || ly >= sp2) {
        const k = 0.85 + fbm(u, v, 8, 2, 2, 2201) * 0.12 + (ly > sp1 - 8 && ly < sp1 ? -0.15 : 0);
        s.setC(i, [34 * k, 40 * k, 46 * k]); s.S[i] = 0.8; s.H[i] = 0;
        return;
      }
      const t = (ly - sp1) / (sp2 - sp1);
      // reflection of the burning skyline, darkened and tinted by the glass
      let c = refl(x * 0.8, (ly - sp1) * 1.1, 205, (sp2 - sp1) * 1.1).map((q, k2) => q * [0.75, 0.85, 0.92][k2] + [10, 16, 20][k2]);
      const gl = fract((x - y * 0.55) / 180);
      c = mixc(c, [120, 140, 160], Math.exp(-Math.pow((gl - 0.3) / 0.035, 2)) * 0.35);
      const lit = hash(col, 1, 2202) < 0.3, warm = hash(col, 2, 2203) < 0.6;
      if (lit) {
        const room = warm ? [196, 178, 140] : [160, 176, 186];
        let r2 = mixc(room, mixc(room, [0, 0, 0], 0.6), sstep(0, 1, t));
        if (ly < sp1 + 8) r2 = mod(lx, 32) < 20 ? [252, 252, 240] : [200, 200, 190];   // ceiling troffers
        const bl = hash(col, 3, 2204);
        if (t < bl * 0.6 && mod(ly, 3) === 0) r2 = mixc(r2, [130, 120, 100], 0.6);  // blinds
        if (t > 0.68) r2 = mixc(r2, [70, 80, 96], 0.7);                               // cubicle partitions
        c = mixc(r2, c, 0.3); s.addE(i, c, 0.35);
      }
      s.setC(i, c); s.S[i] = 1; s.H[i] = 0;
    });
    // mullions and transoms, with pressure caps
    for (let x = 0; x <= w; x += 64) s.rect(x - 3, -2, x + 3, h + 2, { h: 6, bevel: 2, prof: 'round', op: 'set', color: [26, 26, 28], spec: 0.8 });
    for (const y of [0, sp1, sp2]) s.rect(-2, y - 3, w + 2, y + 3, { h: 6, bevel: 2, prof: 'round', op: 'set', color: [26, 26, 28], spec: 0.8 });
    s.grain(0.015, 2205);
  }, { specK: 1.2, specPow: 30, shadow: 3, amb: 0.6 });

  // ---------------------------------------------------------------- CHITHEA: the Chicago Theatre, one facade for MAP04's 640-unit wall (512 x 1280,
  // top-pegged: y = 0 is the wall top at 640, the bottom is the street). The marquee and the doors fill the bottom ~140
  // units; the six-storey vertical C-H-I-C-A-G-O sign runs up the terracotta front in front of the great arch.
  await T('CHITHEA', 'textures', 512, 1280, (s) => {
    const { w, h } = s;
    // cream terracotta blocks
    s.fill([214, 204, 180], 0.4);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 15, 4, 2211), k = 0.88 + n * 0.14;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
      if (mod(y, 24) === 0 || mod(x + (Math.floor(y / 24) % 2) * 24, 48) === 0) { s.H[i] -= 0.6; s.setC(i, [150, 140, 120], 0.5); }
    });
    // cornice, dentils and parapet at the top
    s.rect(-2, 0, w + 2, 30, { h: 6, bevel: 2, op: 'max', color: [222, 212, 188] });
    s.rect(-2, 30, w + 2, 46, { h: 12, bevel: 3, prof: 'round', op: 'max', color: [230, 220, 196], spec: 0.5 });
    for (let x = 2; x < w; x += 10) s.rect(x, 46, x + 6, 54, { h: 9, bevel: 1, op: 'max', color: [220, 210, 186] });
    s.rect(-2, 54, w + 2, 60, { h: 7, bevel: 1, op: 'max', color: [206, 196, 172] });
    // side bays: a window per storey, lit here and there
    const bays = [[14, 82], [430, 498]];
    for (const [x0, x1] of bays) for (let k = 0; k < 5; k++) {
      const y0 = 110 + k * 180, y1 = y0 + 116, lit = hash(x0, k, 2216) < 0.45;
      s.rect(x0 - 4, y0 - 4, x1 + 4, y1 + 4, { h: -2, op: 'add', bevel: 2, color: [196, 186, 162] });
      s.rect(x0, y0, x1, y1, {
        h: -5, op: 'set', bevel: 1, fn: (i, cov, t, d, px, py) => {
          const ly = (py - y0) / (y1 - y0), bar = Math.abs(px - (x0 + x1) / 2) < 1.5 || Math.abs(py - (y0 + y1) / 2) < 1.5;
          const c = bar ? [210, 200, 176] : lit ? mixc([236, 200, 130], [150, 110, 70], ly) : mixc([40, 46, 60], [18, 20, 28], ly);
          s.setC(i, c, cov); s.S[i] = 1; if (lit && !bar) s.addE(i, c, cov * 0.4);
        },
      });
      s.rect(x0 - 6, y1 + 4, x1 + 6, y1 + 12, { h: 8, bevel: 2, op: 'max', color: [230, 220, 196] });   // sill
    }
    // fluted pilasters framing the arch
    for (const x of [108, 404]) { s.rect(x - 14, 60, x + 14, 1000, { h: 9, bevel: 3, op: 'max', color: [224, 214, 190] }); for (const f of [-8, -2, 4]) s.rect(x + f, 60, x + f + 2, 1000, { h: 1.6, op: 'sub', bevel: 1 }); s.rect(x - 18, 60, x + 18, 84, { h: 12, bevel: 3, op: 'max', color: [230, 220, 196] }); }
    // the great arch: mullioned glazing, warm-lit, with the round window near the top
    const ax = 256, ay = 300, aR = 130, aBot = 990;
    const archD = (px, py) => Math.max(py < ay ? Math.hypot(px - ax, py - ay) - aR : Math.abs(px - ax) - aR, py - aBot);
    s.stamp((px, py) => archD(px, py) - 12, [ax - aR - 14, ay - aR - 14, ax + aR + 14, aBot], { h: 8, bevel: 3, op: 'max', color: [228, 218, 194] });
    s.stamp(archD, [ax - aR, ay - aR, ax + aR, aBot], {
      h: -8, bevel: 2, op: 'set', fn: (i, cov, t, d, px, py) => {
        const rr = Math.hypot(px - ax, py - 250);
        let bar = mod(px - ax, 34) < 3 || mod(py, 46) < 3, c;
        if (rr < 92) { const a = Math.atan2(py - 250, px - ax); bar = rr > 86 || rr < 18 || Math.abs(mod(a * 12 / Math.PI + 0.5, 1) - 0.5) < 0.09; c = bar ? [60, 44, 30] : mixc([255, 214, 140], [210, 120, 60], rr / 92); }
        else c = bar ? [46, 34, 26] : mixc([196, 136, 76], [92, 54, 34], clamp((py - 120) / 900)).map((q) => q * (0.85 + hash(Math.floor((px - ax) / 34), Math.floor(py / 46), 2213) * 0.3));
        s.setC(i, c, cov); if (!bar) s.addE(i, c, cov * 0.25);
      },
    });
    s.ring(ax, 250, 96, 10, { h: 6, bevel: 3, prof: 'round', op: 'max', color: [226, 216, 190] });
    s.poly([[ax - 18, ay - aR - 16], [ax + 18, ay - aR - 16], [ax + 12, ay - aR + 14], [ax - 12, ay - aR + 14]], { h: 12, bevel: 2, op: 'max', color: [232, 222, 198] });   // keystone
    // ---- the vertical sign: red-orange, chaser-bulb border, C-H-I-C-A-G-O in white bulbs, a crown on top
    const sx0 = 200, sx1 = 312, sy0 = 112, sy1 = 990;
    s.rect(sx0 - 6, sy0 - 6, sx1 + 6, sy1, { h: 18, bevel: 3, op: 'max', color: [120, 36, 20], r: 6 });
    s.rect(sx0, sy0, sx1, sy1, { h: 19, bevel: 1.5, op: 'max', color: [222, 84, 30], r: 4 });
    s.poly([[sx0 - 8, sy0 - 4], [sx0 + 10, sy0 - 30], [(sx0 + sx1) / 2, sy0 - 52], [sx1 - 10, sy0 - 30], [sx1 + 8, sy0 - 4]], { h: 19, bevel: 2, op: 'max', color: [206, 160, 60], spec: 0.6 });
    s.circle((sx0 + sx1) / 2, sy0 - 26, 10, { h: 21, bevel: 4, prof: 'round', op: 'max', color: [230, 70, 30] });
    const bulbs = (draw) => s.mask(draw, { wrap: false });
    const border = bulbs((g) => { for (let y = sy0 + 8; y < sy1 - 4; y += 9) for (const x of [sx0 + 7, sx1 - 7]) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); } for (let x = sx0 + 16; x < sx1 - 8; x += 9) for (const y of [sy0 + 7]) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); } });
    s.apply(border, { h: 20, op: 'max', color: [255, 236, 170], E: [255, 210, 120], eAlpha: 0.9 });
    s.glow(border, [255, 170, 60], 4, 0.35);
    const letters = 'CHICAGO', lh = (sy1 - sy0 - 24) / 7;
    const lm = s.mask((g) => {
      g.font = `bold ${Math.round(lh * 0.86)}px "DejaVu Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...letters].forEach((c, k) => { g.save(); g.translate((sx0 + sx1) / 2, sy0 + 16 + lh * (k + 0.5)); g.scale(1.0, 1); g.fillText(c, 0, 3); g.restore(); });
    }, { wrap: false });
    s.apply(lm, { h: 20, bevel: 1.5, op: 'max', color: [255, 248, 222], E: [255, 236, 190], eAlpha: 0.75 });
    s.each((u, v, x, y, i) => { if (lm[i] > 0.5 && mod(x, 4) === 1 && mod(y, 4) === 1) s.addE(i, [255, 255, 230], 0.55); });
    s.glow(lm, [255, 200, 120], 7, 0.5);
    // ---- the marquee over the sidewalk: pediment with CHICAGO, a backlit letter board, chaser bulbs, bulb soffit
    const my0 = 1010, my1 = 1104, mx0 = 26, mx1 = 486;
    s.poly([[mx0 + 110, my0], [256, 976], [mx1 - 110, my0]], { h: 22, bevel: 2, op: 'max', color: [196, 120, 40] });
    s.rect(mx0, my0, mx1, my1, { h: 22, bevel: 2, op: 'max', color: [150, 96, 40], spec: 0.6 });
    const ped = textMask(s, 'CHICAGO', 256, 1004, { font: font(18), align: 'center', spacing: 3 });
    s.apply(ped, { h: 23, op: 'max', color: [255, 244, 210], E: [255, 220, 150], eAlpha: 0.85 }); s.glow(ped, [255, 190, 90], 3, 0.4);
    const bx0 = mx0 + 12, bx1 = mx1 - 12, by0 = my0 + 10, by1 = my1 - 12;
    s.rect(bx0, by0, bx1, by1, { h: 23, bevel: 1, op: 'max', color: [244, 240, 226], E: [130, 126, 110], eAlpha: 0.6 });
    const t1 = textMask(s, 'EVACUATION CENTER', 256, by0 + 30, { font: font(24), align: 'center', spacing: 3, sx: 0.9 });
    const t2 = textMask(s, 'STAY CALM  •  STAY INDOORS', 256, by0 + 60, { font: font(17), align: 'center', spacing: 2, sx: 0.9 });
    s.apply(t1, { color: [20, 20, 22] }); s.apply(t2, { color: [150, 24, 20] });
    const chase = bulbs((g) => { for (let x = mx0 + 5; x < mx1; x += 8) for (const y of [my0 + 4, my1 - 5]) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } });
    s.apply(chase, { h: 24, op: 'max', color: [255, 240, 190], E: [255, 210, 130], eAlpha: 0.9 }); s.glow(chase, [255, 180, 80], 3, 0.3);
    s.rect(mx0 + 6, my1, mx1 - 6, my1 + 14, { h: 20, bevel: 1, op: 'max', color: [70, 52, 34] });
    const sof = bulbs((g) => { for (let x = mx0 + 12; x < mx1 - 8; x += 10) { g.beginPath(); g.arc(x, my1 + 7, 3, 0, 7); g.fill(); } });
    s.apply(sof, { h: 21, op: 'max', color: [255, 250, 220], E: [255, 236, 180], eAlpha: 1 }); s.glow(sof, [255, 210, 140], 8, 0.6);
    // ---- street level: brass-framed glass doors into the lit lobby, poster cases either side, a granite base
    const ey0 = 1124;
    s.rect(-2, my1 + 14, w + 2, h + 2, { fn: (i, cov, t, d, px, py) => { const k = 1 + 0.35 * Math.exp(-(py - my1 - 14) / 60); s.C[i * 3] = Math.min(255, s.C[i * 3] * k); s.C[i * 3 + 1] = Math.min(255, s.C[i * 3 + 1] * k * 0.95); s.C[i * 3 + 2] *= k * 0.85; } });   // soffit light on the wall
    for (let k = 0; k < 6; k++) {
      const x0 = 104 + k * 52, x1 = x0 + 48;
      s.rect(x0, ey0, x1, h - 16, { h: 6, bevel: 2, op: 'set', color: CH.brass, spec: 0.9 });
      s.rect(x0 + 5, ey0 + 6, x1 - 5, h - 34, {
        h: 3, bevel: 1, op: 'set', fn: (i, cov, t, d, px, py) => { const ly = (py - ey0) / (h - ey0); const c = mixc([255, 214, 150], [170, 110, 60], ly); s.setC(i, c, cov); s.addE(i, c, cov * 0.45); s.S[i] = 1; },
      });
      s.rect(x0 + (k % 2 ? 6 : x1 - x0 - 12), ey0 + 70, x0 + (k % 2 ? 12 : x1 - x0 - 6), ey0 + 100, { h: 8, bevel: 1.5, prof: 'round', op: 'max', color: CH.brassLt, spec: 1 });
    }
    for (const [x0, x1] of [[26, 88], [424, 486]]) {
      s.rect(x0, ey0 + 8, x1, ey0 + 112, { h: 6, bevel: 2, op: 'set', color: CH.brass, spec: 0.9 });
      s.art((g) => { g.fillStyle = '#1a1a2a'; g.fillRect(x0 + 5, ey0 + 13, x1 - x0 - 10, 94); g.fillStyle = '#c03020'; g.font = font(11); g.textAlign = 'center'; g.fillText('CLOSED', (x0 + x1) / 2, ey0 + 45); g.fillStyle = '#f0e0b0'; g.font = font(6); g.fillText('BY ORDER OF', (x0 + x1) / 2, ey0 + 62); g.fillText('CIVIL', (x0 + x1) / 2, ey0 + 74); g.fillText('DEFENSE', (x0 + x1) / 2, ey0 + 84); }, { emissive: 0.3 });
    }
    s.rect(-2, h - 16, w + 2, h + 2, { h: 4, bevel: 1.5, op: 'set', color: [70, 64, 62], spec: 0.5 });
    // soot and grime, heavier low down and under the cornice
    s.grime([60, 50, 40], (u, v, x) => (x < 190 || x > 322 ? 0.1 + sstep(0.9, 1, v) * 0.2 : 0), { seed: 2212, fx: 8, fy: 20, contrast: 2 });
    s.streaks([110, 100, 86], { amount: 0.35, fx: 32, seed: 2214, len: 0.12, start: () => 60 / 1280 });
  }, { specK: 0.9, shadow: 8, amb: 0.5 });

  // ---------------------------------------------------------------- SW1OFFC / SW2OFFC: fire alarm pull station and strobe (128 x 256)
  for (const on of [0, 1]) {
    await T(on ? 'SW2OFFC' : 'SW1OFFC', 'textures', 128, 256, (s) => {
      drywall(s, { seed: 2101 });
      const cx = 64, y0 = 112, y1 = 172;
      // strobe/horn above
      s.rect(cx - 18, 54, cx + 18, 90, { h: 7, bevel: 2, op: 'set', color: [196, 30, 24], r: 3, spec: 0.5 });
      for (let x = cx - 12; x <= cx + 12; x += 4) s.rect(x, 58, x + 2, 70, { h: 4, op: 'sub', bevel: 0.6, color: [100, 16, 12] });
      s.apply(textMask(s, 'FIRE', cx, 80, { font: font(8), align: 'center', spacing: 1 }), { color: [255, 255, 255] });
      const lens = s.mask((g) => { g.fillRect(cx - 10, 82, 20, 6); }, { wrap: false });
      s.apply(lens, { h: 9, op: 'set', color: on ? [255, 255, 255] : [210, 214, 220], E: on ? [255, 255, 255] : null, eAlpha: 1, spec: 1 });
      if (on) { s.glow(lens, [255, 255, 255], 8, 0.8); s.glow(lens, [255, 220, 220], 20, 0.35); }
      // pull station
      s.rect(cx - 20, y0, cx + 20, y1, { h: 8, bevel: 3, op: 'set', color: [200, 30, 24], r: 3, spec: 0.6 });
      s.apply(textMask(s, 'FIRE', cx, y0 + 13, { font: font(10), align: 'center', spacing: 1 }), { color: [255, 255, 255] });
      s.rect(cx - 12, y0 + 18, cx + 12, y1 - 6, { h: 6, op: 'set', bevel: 1, color: [150, 18, 14] });
      const hy = on ? y1 - 18 : y0 + 22;
      s.rect(cx - 11, hy, cx + 11, hy + 11, { h: 12, bevel: 2, prof: 'round', op: 'set', color: [240, 236, 228], spec: 0.7 });
      s.apply(textMask(s, 'PULL', cx, hy + 9, { font: font(7), align: 'center' }), { color: [180, 20, 16] });
      if (!on) s.apply(textMask(s, 'DOWN', cx, y1 - 9, { font: font(6), align: 'center' }), { color: [255, 240, 230] });
      s.bolt(cx, y1 - 3, 1.2, { h: 1 });
    }, { amb: 0.55, shadow: 8, specK: 0.9 });
  }

  // ---------------------------------------------------------------- flats (128 x 128)
  const FB = { light: [-0.35, -0.55, 0.76] };
  await T('OFFCCARP', 'flats', 128, 128, (s) => {
    s.each((u, v, x, y, i) => {
      // quarter-turned carpet tiles (50 cm) with directional loop pile and coloured flecks
      const tx = Math.floor(x / 32), ty = Math.floor(y / 32), turn = (tx + ty) % 2;
      const along = turn ? x : y, across = turn ? y : x;
      const row = mod(along, 3) === 0 ? 0.9 : 1, loop = hash(across, Math.floor(along / 3), 2221);
      const n = fbm(u, v, 4, 4, 3, 2222);
      let k = row * (0.88 + loop * 0.14) * (0.9 + n * 0.14) * (turn ? 0.97 : 1.02);
      let c = [CH.carpet[0] * k, CH.carpet[1] * k, CH.carpet[2] * k];
      const f = hash(x, y, 2223);
      if (f < 0.04) c = mixc(c, [150, 160, 170], 0.5); else if (f > 0.975) c = mixc(c, [40, 70, 90], 0.6); else if (f > 0.96) c = mixc(c, [120, 60, 70], 0.4);
      s.setC(i, c); s.H[i] = loop * 0.6 + (row < 1 ? -0.3 : 0);
    });
    s.grime([60, 64, 70], (u, v) => clamp(0.35 - Math.hypot(u - 0.6, v - 0.5) * 2.5), { seed: 2224, fx: 6, fy: 6 });   // traffic wear
    s.grime([90, 70, 50], (u, v) => clamp(0.3 - Math.hypot(u - 0.2, v - 0.25) * 6), { seed: 2225, fx: 10, fy: 10 });   // coffee
  }, { amb: 0.6, shadow: 0, ...FB });

  await T('OFFCCEIL', 'flats', 128, 128, (s) => {
    s.fill([222, 218, 206], 0.05);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 8, 8, 3, 2231), g = hash(x, y, 2232);
      // mineral-fibre fissures and pinholes
      const fis = ridged(u, v, 16, 16, 3, 2233), fis2 = fbm(u * 1, v, 24, 24, 2, 2234);
      let k = 0.94 + n * 0.06 + (g - 0.5) * 0.04;
      let H = 0.8;
      if (fis > 0.9 && fis2 > 0.45) { k *= 0.88; H -= 0.6; }
      if (g < 0.012) { k *= 0.82; H -= 0.5; }
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; s.H[i] = H;
    });
    // T-bar grid every 64 px (1 m)
    for (const p of [0, 64]) { s.rect(p - 1.5, -2, p + 1.5, 130, { h: 2, bevel: 0.8, op: 'set', color: [236, 234, 228], spec: 0.5 }); s.rect(-2, p - 1.5, 130, p + 1.5, { h: 2, bevel: 0.8, op: 'set', color: [236, 234, 228], spec: 0.5 }); }
    // a water stain on one tile
    s.grime([196, 180, 150], (u, v) => clamp(0.35 - Math.hypot(u - 0.73, v - 0.28) * 6), { seed: 2235, fx: 12, fy: 12, contrast: 1.8 });
  }, { amb: 0.65, shadow: 2, ...FB });

  await T('OFFCLITE', 'flats', 128, 128, (s) => {
    s.fill([236, 234, 228], 0.4);
    // enamel troffer frame and a prismatic acrylic lens, three tubes glowing behind it
    s.rect(6, 6, 122, 122, { h: 2, bevel: 2, op: 'set', color: [214, 212, 206], spec: 0.6 });
    s.rect(12, 12, 116, 116, {
      h: 1, op: 'set', bevel: 1, fn: (i, cov, t, d, px, py) => {
        const pr = (mod(px + py, 4) < 2 ? 1 : 0.94) * (mod(px - py, 4) < 2 ? 1 : 0.95);
        let tube = 0; for (const tx of [34, 64, 94]) tube = Math.max(tube, Math.exp(-Math.pow((px - tx) / 9, 2)));
        const k = (0.72 + tube * 0.22) * pr;
        const c = [232 * k, 238 * k, 242 * k];
        s.setC(i, c, cov); s.addE(i, [120, 126, 130], cov * (0.25 + tube * 0.35));
      },
    });
    s.rect(-2, -2, 130, 3, { h: 2, op: 'set', color: [236, 234, 228] }); s.rect(-2, 125, 130, 130, { h: 2, op: 'set', color: [236, 234, 228] });
    s.rect(-2, -2, 3, 130, { h: 2, op: 'set', color: [236, 234, 228] }); s.rect(125, -2, 130, 130, { h: 2, op: 'set', color: [236, 234, 228] });
    s.grime([150, 140, 120], (u, v, x, y) => (x > 12 && x < 116 && y > 12 && y < 116 ? 0.06 : 0), { seed: 2241, fx: 8, fy: 8, contrast: 2 });   // dead flies in the lens
  }, { amb: 0.8, shadow: 0, ...FB });

  await T('PLAZAFLR', 'flats', 128, 128, (s) => {
    s.each((u, v, x, y, i) => {
      const row = Math.floor(y / 64), col = Math.floor(x / 64);
      const fx = x - col * 64, fy = y - row * 64, d = Math.min(fx, 63 - fx, fy, 63 - fy);
      const tone = 0.88 + hash(col, row, 2251) * 0.16;
      const c = graniteAt(u, v, x, y, 2252, { pink: [164, 114, 104], grey: [128, 116, 112], soft: 0.6 });
      s.setC(i, [c[0] * tone, c[1] * tone, c[2] * tone]); s.S[i] = 0.3;
      s.H[i] = d < 1 ? -0.8 : 0.6 + hash(x, y, 2253) * 0.3;
      if (d < 1) s.setC(i, [86, 78, 74]);
    });
    s.tube([[70, 40], [78, 48], [84, 50], [92, 62]], 0.5, { h: -1.2, op: 'add', color: [70, 60, 58] });
    s.grime([60, 54, 52], () => 0.22, { fx: 4, fy: 4, seed: 2254, contrast: 2.4 });
    const r = rng(2255); for (let k = 0; k < 8; k++) s.circle(r() * 128, r() * 128, 0.8 + r(), { color: [50, 48, 46], alpha: 0.6 });   // gum
  }, { amb: 0.5, shadow: 2, specK: 0.6, ...FB });

  await T('LTRKFLR', 'flats', 128, 128, (s) => {
    // the street far below, seen between the ties
    s.each((u, v, x, y, i) => { const n = fbm(u, v, 4, 4, 3, 2261); s.setC(i, [18 + n * 10, 18 + n * 9, 20 + n * 8]); s.H[i] = -6; });
    // creosoted ties every 32 px (rails run along y)
    for (let y = 0; y < 128; y += 32) {
      s.rect(-2, y + 4, 130, y + 22, {
        h: 6, bevel: 1.5, op: 'set', fn: (i, cov, t, d, px, py) => {
          const gr = fbm(mod(px, 128) / 128, mod(py, 128) / 128, 4, 32, 3, 2262 + y), k = 0.75 + gr * 0.35;
          s.setC(i, [70 * k, 54 * k, 42 * k], cov);
          if (hash(px >> 2, py, 2263) < 0.04) s.H[i] -= 0.8 * cov;
        },
      });
      // tie plates and spikes at both rails
      for (const rx of [18, 110]) { s.rect(rx - 8, y + 6, rx + 8, y + 20, { h: 8, bevel: 1, op: 'set', color: [74, 66, 60], spec: 0.4 }); for (const sx of [rx - 6, rx + 6]) s.bolt(sx, y + 13, 1.4, { h: 1, color: [90, 84, 76] }); }
    }
    // the running rails: worn bright heads
    for (const rx of [18, 110]) {
      s.rect(rx - 4, -2, rx + 4, 130, { h: 12, bevel: 1.5, op: 'set', color: [96, 70, 50], spec: 0.3 });
      s.rect(rx - 2, -2, rx + 2, 130, { h: 13, bevel: 1, op: 'set', color: [200, 200, 204], spec: 1 });
    }
    s.grime([60, 40, 30], () => 0.18, { fx: 4, fy: 4, seed: 2264, contrast: 2.2 });
  }, { amb: 0.5, shadow: 6, shadowK: 0.6, specK: 1, ...FB });
}

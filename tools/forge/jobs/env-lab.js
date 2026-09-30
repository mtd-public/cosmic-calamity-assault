// MAP01 Area 51 / S-4 lab: wall textures (Half-Life 1 Black Mesa, gone wrong).
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash, sdSeg, textMask, textWidth, hazard } from '../lib/env/tex.js';
import { P, labWall, labWeather, hband, vband, mix3 } from '../lib/env/lab.js';
import { A, hullPlates, boneRibs, veins } from '../lib/env/alien.js';

export default async function (F) {
  const T = async (name, w, h, paint, bake = {}) => {
    const s = new Surf(w, h);
    const r = await paint(s);
    await save(F, 'textures', name, (r && r.data) ? r : s.bake(bake));
  };

  // ---------------------------------------------------------------- LABWALL1 / LABWALL2
  await T('LABWALL1', 256, 256, (s) => { labWall(s, { seed: 3 }); });
  await T('LABWALL2', 256, 256, (s) => { labWall(s, { seed: 5, stripe: true }); });

  // ---------------------------------------------------------------- LABBASE: dark kick trim
  await T('LABBASE', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(P.base, 0.15);
    // aluminium cap strip at the top, then dark kick panels with horizontal ribs
    hband(s, 0, 14, { h: 6, bevel: 3, prof: 'round', color: P.alu, spec: 0.7 });
    hband(s, 14, 18, { h: 1, bevel: 1, color: P.baseDk });
    for (let x = 0; x < w; x += 128) {
      s.rect(x + 2, 20, x + 126, h - 2, { h: 3, bevel: 2, op: 'set', color: mix3(P.base, P.steelDk, hash(x, 2, 9) * 0.4) });
      for (let y = 40; y < h - 20; y += 24) s.rect(x + 12, y, x + 116, y + 10, { h: 1.6, bevel: 1.5, op: 'add', prof: 'round' });
      for (const [bx, by] of [[x + 6, 26], [x + 122, 26], [x + 6, h - 8], [x + 122, h - 8]]) s.bolt(bx, by, 2.2, { h: 1.4, color: P.steelLo, hex: true, spec: 0.5 });
    }
    s.mottle(0.08, 6, 6, 4, 41);
    s.grain(0.03, 42);
    // boot scuffs: lighter scratches
    const r = rng(43);
    for (let k = 0; k < 40; k++) {
      const x = r() * w, y = 60 + r() * (h - 70), L = 3 + r() * 20, a = (r() - 0.5) * 0.4;
      s.seg(x, y, x + L, y + L * a, 0.4 + r() * 0.6, { color: [120, 116, 110], alpha: 0.35 + r() * 0.3 });
    }
    s.grime(P.soot, (u, v) => sstep(0.75, 1, v) * 0.5, { fx: 16, fy: 4, seed: 44 });
    s.edgeWear([150, 146, 140], 0.4, 2, 45);
  }, { specK: 1.0 });

  // ---------------------------------------------------------------- CONCWALL: poured concrete
  await T('CONCWALL', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(P.conc, 0);
    // form-board lines every 64 px, tie-rod holes, pitting
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 5, 51), m = fbm(u, v, 32, 32, 2, 52);
      const k = 0.86 + n * 0.22 + (m - 0.5) * 0.08;
      const board = hash(0, Math.floor(y / 64), 53) * 0.05;
      s.C[i * 3] *= k + board; s.C[i * 3 + 1] *= k + board; s.C[i * 3 + 2] *= (k + board) * 0.985;
      s.H[i] = n * 2.5 + m * 0.8;
    });
    for (let y = 0; y < h; y += 64) {
      hband(s, y - 1, y + 1, { h: -0.8, op: 'add', bevel: 1 });
      // board edge lips: slight step
      s.stamp((px, py) => Math.max(y + 1 - py, py - (y + 3)), [0, y + 1, w - 1, y + 3], { h: 0.8, op: 'add', bevel: 1, color: [160, 156, 148], alpha: 0.3 });
    }
    for (let y = 32; y < h; y += 64) for (let x = (y % 128 === 32 ? 64 : 0); x < w; x += 128) {
      s.circle(x, y, 5.5, { h: -3, op: 'add', bevel: 3, color: [98, 95, 90], alpha: 0.8 });
      s.circle(x, y, 2.4, { h: -1.5, op: 'add', bevel: 1, color: [60, 58, 55] });
    }
    // pits and air bubbles
    const r = rng(54);
    for (let k = 0; k < 120; k++) s.circle(r() * w, r() * h, 0.6 + r() * 1.6, { h: -1.2, op: 'add', bevel: 1, color: [104, 100, 94], alpha: 0.6 });
    // hairline cracks
    for (let k = 0; k < 3; k++) {
      let x = r() * w, y = r() * h; const pts = [[x, y]];
      for (let j = 0; j < 12; j++) { x += (r() - 0.5) * 14; y += 4 + r() * 8; pts.push([x, y]); }
      s.tube(pts, 0.45, { h: -1.2, op: 'add', bevel: 0.6, color: [90, 86, 80], alpha: 0.7 });
    }
    // water stains running down from the form lines
    s.streaks([110, 104, 92], { amount: 0.4, fx: 24, seed: 55, len: 0.35, start: () => 0 });
    s.grime([96, 92, 84], (u, v) => sstep(0.7, 1, v) * 0.45 + sstep(0.12, 0, v) * 0.18, { fx: 12, fy: 4, seed: 56 });
  }, { amb: 0.5, shadow: 6 });

  // ---------------------------------------------------------------- METLWALL: large steel plates
  await T('METLWALL', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(P.steelLo, 0.35);
    const plates = [[0, 0, 128, 96], [128, 0, 256, 96], [0, 96, 96, 256], [96, 96, 256, 176], [96, 176, 256, 256]];
    for (const [x0, y0, x1, y1] of plates) {
      const k = 0.92 + hash(x0, y0, 61) * 0.14;
      s.rect(x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, { h: 2.5, bevel: 1.5, op: 'set', color: [P.steelLo[0] * k, P.steelLo[1] * k, P.steelLo[2] * k * 1.02] });
      // rivet rows along the plate edges
      for (let x = x0 + 8; x <= x1 - 8; x += 12) { s.bolt(x, y0 + 6, 1.8, { h: 1.3, spec: 0.6 }); s.bolt(x, y1 - 6, 1.8, { h: 1.3, spec: 0.6 }); }
      for (let y = y0 + 18; y <= y1 - 18; y += 12) { s.bolt(x0 + 6, y, 1.8, { h: 1.3, spec: 0.6 }); s.bolt(x1 - 6, y, 1.8, { h: 1.3, spec: 0.6 }); }
    }
    // brushed grain + dents
    s.each((u, v, x, y, i) => {
      const b = fbm(u, v, 64, 4, 2, 62), g = fbm(u, v, 5, 5, 4, 63);
      const k = 0.9 + b * 0.1 + g * 0.1; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
      s.H[i] += (g - 0.5) * 1.2;
    });
    s.streaks(P.rust, { amount: 0.35, fx: 32, seed: 64, len: 0.25, start: (u) => (u < 0.375 ? 96 / 256 : 176 / 256) });
    s.streaks([60, 58, 56], { amount: 0.3, fx: 20, seed: 65, len: 0.4 });
    s.edgeWear([190, 194, 196], 0.5, 1, 66);
    s.grime(P.soot, (u, v) => sstep(0.8, 1, v) * 0.35, { seed: 67 });
  }, { specK: 1.2 });

  // ---------------------------------------------------------------- METLPANL: detailed tech panels
  await T('METLPANL', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(P.steelDk, 0.3);
    const cells = [[0, 0, 128, 128], [128, 0, 256, 64], [128, 64, 256, 128], [0, 128, 64, 256], [64, 128, 192, 192], [64, 192, 192, 256], [192, 128, 256, 256]];
    cells.forEach(([x0, y0, x1, y1], k) => {
      const tone = mix3(P.steel, P.steelDk, 0.3 + hash(k, 3, 71) * 0.4);
      s.rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2, { h: 3, bevel: 2, op: 'set', color: tone, r: 2 });
      for (const [bx, by] of [[x0 + 7, y0 + 7], [x1 - 7, y0 + 7], [x0 + 7, y1 - 7], [x1 - 7, y1 - 7]]) s.bolt(bx, by, 2, { h: 1.4, hex: true, spec: 0.6 });
    });
    // big panel: vent slots
    for (let y = 22; y < 106; y += 10) s.rect(20, y, 108, y + 5, { h: 3.5, op: 'sub', bevel: 1.5, color: [24, 25, 27], r: 2.5 });
    // right top: label plate + indicator
    s.rect(140, 14, 214, 34, { h: 1.2, bevel: 1, color: [200, 196, 180], r: 1 });
    s.art((g) => { g.fillStyle = '#222'; g.font = 'bold 12px "DejaVu Sans", sans-serif'; g.fillText('PWR  B-12', 146, 29); });
    s.circle(232, 24, 5, { h: 2.5, bevel: 2, prof: 'round', color: [60, 200, 90], E: [40, 150, 60], spec: 0.8 });
    // right middle: conduit clamps
    for (let y = 80; y < 120; y += 18) { s.rect(136, y, 248, y + 8, { h: 4, bevel: 3, prof: 'round', color: [90, 94, 98], spec: 0.5 }); }
    // left bottom: hinge column
    for (let y = 150; y < 240; y += 30) s.rect(24, y, 40, y + 18, { h: 3, bevel: 2, prof: 'round', color: [100, 104, 106], spec: 0.5 });
    // middle: a recessed square with a hazard warning triangle
    s.rect(80, 140, 176, 180, { h: 2, op: 'sub', bevel: 1.5, color: [48, 50, 54] });
    s.poly([[100, 175], [112, 146], [124, 175]], { color: P.hazard, h: 0.6, bevel: 0.6 });
    s.art((g) => { g.fillStyle = '#1a1a1a'; g.font = 'bold 20px "DejaVu Sans", sans-serif'; g.fillText('!', 108, 173); g.font = 'bold 11px "DejaVu Sans", sans-serif'; g.fillStyle = '#d8c070'; g.fillText('HIGH', 134, 156); g.fillText('VOLTAGE', 134, 170); });
    // bottom middle: grille
    for (let x = 76; x < 180; x += 7) s.rect(x, 204, x + 3, 246, { h: 2.5, op: 'sub', bevel: 1, color: [30, 30, 32] });
    // right column: pipe run behind a bracket
    s.rect(206, 136, 244, 250, { h: 1.5, op: 'sub', bevel: 1, color: [40, 42, 44] });
    s.rect(218, 136, 232, 250, { h: 6, bevel: 7, prof: 'round', color: [150, 120, 70], spec: 0.8 });
    s.rect(210, 180, 240, 190, { h: 8, bevel: 2, color: [70, 72, 76], spec: 0.4 });
    s.each((u, v, x, y, i) => { const g = fbm(u, v, 6, 6, 4, 72); const k = 0.9 + g * 0.18; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; });
    s.grain(0.025, 73);
    s.edgeWear([176, 180, 184], 0.6, 1, 74);
    s.streaks([50, 48, 44], { amount: 0.25, fx: 24, seed: 75, len: 0.3 });
  }, { specK: 1.1 });

  // ---------------------------------------------------------------- LABDOOR: steel door with a wired-glass slot
  await T('LABDOOR', 256, 256, (s) => {
    const { w, h } = s;
    const door = [122, 130, 138];
    s.fill(door, 0.3);
    s.rect(0, 0, w, h, { h: 2, bevel: 1, op: 'set' });
    // outer frame + inner recessed field
    s.rect(4, 4, w - 4, h - 4, { h: 5, bevel: 3, op: 'set', color: door, r: 2 });
    s.rect(18, 18, w - 18, h - 18, { h: 3, bevel: 2, op: 'set', color: mix3(door, P.steel, 0.3) });
    // window
    s.rect(88, 30, 168, 104, { h: 7, bevel: 3, op: 'set', color: [96, 100, 104], r: 3 });
    s.rect(96, 38, 160, 96, { h: 0.5, bevel: 1.5, op: 'set', color: [30, 44, 48], spec: 1 });
    s.each((u, v, x, y, i) => {
      if (x < 96 || x > 160 || y < 38 || y > 96) return;
      const wire = Math.min(Math.abs(fract((x - 96) / 10) - 0.5), Math.abs(fract((y - 38) / 10) - 0.5)) > 0.44;
      const glare = clamp(1 - Math.abs((x - 96) - (y - 38) * 0.9 - 14) / 7) * 0.5 + clamp(1 - Math.abs((x - 96) - (y - 38) * 0.9 - 30) / 3) * 0.3;
      const c = wire ? [120, 124, 120] : [34 + glare * 90, 50 + glare * 100, 56 + glare * 100];
      s.setC(i, c, 1);
    });
    // push bar recess + handle
    s.rect(30, 132, 226, 150, { h: 2, op: 'sub', bevel: 1.5, color: [70, 74, 80] });
    s.rect(40, 135, 216, 147, { h: 6, bevel: 5, prof: 'round', color: P.alu, spec: 0.9, op: 'add' });
    // kick band: hazard stripes
    s.rect(18, 196, w - 18, 238, { h: 1, bevel: 1, op: 'add', color: (px, py) => hazard(px, py, 28) });
    s.art((g) => {
      g.fillStyle = 'rgba(20,20,20,0.85)'; g.font = 'bold 13px "DejaVu Sans", sans-serif'; g.textAlign = 'center';
      g.fillText('AUTHORIZED', 128, 122); g.font = 'bold 26px "DejaVu Sans", sans-serif'; g.fillStyle = 'rgba(230,226,210,0.9)'; g.fillText('S-4', 128, 184);
    });
    for (const [bx, by] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10], [10, 128], [w - 10, 128]]) s.bolt(bx, by, 2.4, { h: 1.6, hex: true, spec: 0.6 });
    s.mottle(0.07, 5, 5, 4, 81); s.grain(0.02, 82);
    s.edgeWear([190, 196, 200], 0.6, 1, 83);
    s.grime(P.soot, (u, v) => sstep(0.8, 1, v) * 0.35, { seed: 84 });
  }, { specK: 1.1 });

  // ---------------------------------------------------------------- BLSTDOOR: blast door
  await T('BLSTDOOR', 256, 256, (s) => {
    const { w, h } = s;
    const steel = [98, 102, 106];
    s.fill(steel, 0.35);
    // hazard bands top and bottom
    for (const [y0, y1] of [[0, 30], [226, 256]]) s.rect(-4, y0, w + 4, y1, { h: 4, bevel: 2, op: 'set', color: (px, py) => hazard(px, py, 40) });
    // main slab with vertical reinforcement ribs
    s.rect(-4, 34, w + 4, 222, { h: 3, bevel: 2, op: 'set', color: steel });
    for (let x = 16; x < w; x += 64) s.rect(x, 36, x + 20, 220, { h: 7, bevel: 4, op: 'max', color: mix3(steel, P.steelDk, 0.25) });
    // interlocking teeth seam across the middle
    const zig = (px, py) => { const t = fract(px / 32); const tri = Math.abs(t - 0.5) * 2; const y = 128 + (tri - 0.5) * 20; return Math.abs(py - y) * 0.7 - 1.3; };
    s.stamp(zig, [0, 112, w - 1, 144], { h: -5, op: 'set', bevel: 1.5, color: [22, 22, 24] });
    hband(s, 104, 108, { h: 1, bevel: 1, color: [70, 72, 76] }); hband(s, 148, 152, { h: 1, bevel: 1, color: [70, 72, 76] });
    // bolts
    for (let x = 8; x < w; x += 32) { s.bolt(x, 44, 3, { h: 2.2, hex: true, spec: 0.6 }); s.bolt(x, 212, 3, { h: 2.2, hex: true, spec: 0.6 }); }
    s.art((g) => {
      g.fillStyle = 'rgba(214,168,40,0.9)'; g.font = 'bold 22px "DejaVu Sans Mono", monospace'; g.textAlign = 'center';
      g.font = 'bold 30px "DejaVu Sans Mono", monospace'; g.fillText('B-7', 64, 88); g.fillText('B-7', 192, 88);
      g.font = 'bold 11px "DejaVu Sans", sans-serif'; g.fillStyle = 'rgba(220,210,190,0.75)';
      g.fillText('CONTAINMENT', 64, 190); g.fillText('CONTAINMENT', 192, 190);
    });
    s.each((u, v, x, y, i) => { const g = fbm(u, v, 6, 6, 4, 91); const k = 0.86 + g * 0.24; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; s.H[i] += (g - 0.5) * 1.5; });
    s.grain(0.03, 92);
    s.edgeWear([176, 176, 170], 0.8, 1, 93);
    s.streaks(P.rust, { amount: 0.3, fx: 32, seed: 94, len: 0.3, start: () => 44 / 256 });
    s.grime(P.soot, (u, v) => sstep(0.82, 1, v) * 0.4, { seed: 95 });
  }, { specK: 1.2 });

  // ---------------------------------------------------------------- LABCOMP: computer bank wall
  await T('LABCOMP', 256, 256, (s) => {
    const { w, h } = s;
    const cab = [176, 170, 152], trim = [70, 70, 72];
    s.fill(trim, 0.2);
    const r = rng(101);
    for (let bay = 0; bay < 2; bay++) {
      const x0 = bay * 128;
      s.rect(x0 + 3, 3, x0 + 125, h - 3, { h: 4, bevel: 2, op: 'set', color: cab, r: 2 });
      if (bay === 0) {
        // tape reels behind a smoked window
        s.rect(x0 + 12, 14, x0 + 116, 104, { h: 1, op: 'sub', bevel: 2, color: [36, 38, 40] });
        for (const cx of [x0 + 38, x0 + 90]) {
          s.circle(cx, 52, 22, { h: 2.5, bevel: 1, color: [60, 62, 66], spec: 0.5 });
          s.ring(cx, 52, 16, 6, { h: 1, bevel: 1, color: [120, 84, 50] });
          s.circle(cx, 52, 7, { h: 3, bevel: 2, color: [150, 150, 150], spec: 0.8 });
          for (let k = 0; k < 3; k++) { const a = k * 2.094 + cx; s.circle(cx + Math.cos(a) * 13, 52 + Math.sin(a) * 13, 3.2, { h: -2, op: 'add', bevel: 1, color: [30, 30, 30] }); }
        }
        s.rect(x0 + 24, 84, x0 + 104, 96, { h: 2, bevel: 1, color: [90, 92, 96], spec: 0.5 });
        s.each((u, v, x, y, i) => { if (x < x0 + 12 || x > x0 + 116 || y < 14 || y > 104) return; const gl = clamp(1 - Math.abs((x - x0) - (y - 14) * 0.7 - 30) / 12) * 0.25; s.addE(i, [120, 140, 150], gl * 0.5); });
      } else {
        // green CRT readout
        s.rect(x0 + 14, 14, x0 + 114, 86, { h: 3, bevel: 2, op: 'sub', color: [40, 42, 44], r: 6 });
        s.rect(x0 + 20, 20, x0 + 108, 80, { h: 0.5, bevel: 3, color: [12, 26, 16], r: 8, spec: 1 });
        s.each((u, v, x, y, i) => {
          if (x < x0 + 22 || x > x0 + 106 || y < 22 || y > 78) return;
          const row = Math.floor((y - 24) / 7), fy = (y - 24) % 7;
          const col = Math.floor((x - x0 - 26) / 5);
          const on = fy < 4 && col >= 0 && col < hash(row, 5, 7) * 16 && hash(col, row, 102) > 0.3 && row < 8;
          const scan = y % 2 ? 0.8 : 1;
          if (on) s.addE(i, [70, 255, 120], 0.85 * scan);
          s.addE(i, [10, 40, 20], 0.5);
        });
      }
      // indicator light rows
      for (let row = 0; row < 3; row++) for (let k = 0; k < 8; k++) {
        const cx = x0 + 20 + k * 12, cy = 118 + row * 14, on = r() < 0.55, col = r.pick([[255, 60, 40], [80, 255, 90], [255, 190, 50], [255, 255, 220]]);
        s.circle(cx, cy, 3.4, { h: 1.5, bevel: 1.5, prof: 'round', color: on ? col : mix3(col, [40, 40, 40], 0.7), E: on ? col : null, eAlpha: 0.7, spec: 0.8 });
      }
      // toggle switches
      for (let k = 0; k < 6; k++) {
        const cx = x0 + 22 + k * 16, up = r() < 0.5;
        s.circle(cx, 172, 4, { h: 2, bevel: 1.5, color: [150, 150, 150], spec: 0.6 });
        s.seg(cx, 172, cx, up ? 164 : 180, 1.6, { h: 5, bevel: 1.6, prof: 'round', color: [200, 200, 200], spec: 0.9, op: 'max' });
      }
      // label strip + vent
      s.rect(x0 + 14, 190, x0 + 114, 200, { h: 1, bevel: 1, color: [220, 216, 200] });
      s.art((g) => { g.fillStyle = '#333'; g.font = 'bold 8px "DejaVu Sans Mono", monospace'; g.fillText(bay ? 'XB-2 TELEMETRY' : 'XB-1 DATA STORE', x0 + 18, 198); });
      for (let y = 208; y < 246; y += 6) s.rect(x0 + 14, y, x0 + 114, y + 3, { h: 2.5, op: 'sub', bevel: 1, color: [30, 30, 32] });
      for (const [bx, by] of [[x0 + 8, 8], [x0 + 120, 8], [x0 + 8, h - 8], [x0 + 120, h - 8]]) s.bolt(bx, by, 1.8, { h: 1.2, slot: true });
    }
    s.mottle(0.05, 6, 6, 4, 103); s.grain(0.02, 104);
    s.grime(P.grime, (u, v) => sstep(0.85, 1, v) * 0.3, { seed: 105 });
  }, { specK: 1 });

  // ---------------------------------------------------------------- HAZSTRIP: hazard trim
  await T('HAZSTRIP', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(P.steelDk, 0.3);
    s.each((u, v, x, y, i) => {
      const c = hazard(x, y, 64);
      // chipped paint: steel shows through where noise dips
      const chip = fbm(u, v, 16, 16, 4, 111);
      const edge = fract((x + y) / 32); const nearEdge = Math.min(edge, 1 - edge);
      const chip2 = fbm(u, v, 48, 48, 2, 115);
      if (chip < 0.3 + (nearEdge < 0.06 ? 0.12 : 0) && chip2 < 0.5) { s.setC(i, [118, 120, 122], 1); s.H[i] -= 0.6; s.S[i] = 0.6; }
      else s.setC(i, c, 1);
    });
    for (const y of [0, 128]) {
      s.stamp((px, py) => Math.abs(py - y) - 1, [0, y - 3, w - 1, y + 3], { h: 2, op: 'sub', bevel: 1, color: [20, 20, 20] });
      for (let x = 16; x < w; x += 32) { s.bolt(x, y + 8, 2.4, { h: 1.6, hex: true, spec: 0.7 }); s.bolt(x, y - 8, 2.4, { h: 1.6, hex: true, spec: 0.7 }); }
    }
    s.mottle(0.1, 8, 8, 4, 112); s.grain(0.04, 113);
    s.grime(P.soot, (u, v) => 0.25, { seed: 114, fx: 10, fy: 10, contrast: 2.5 });
  }, { specK: 1.1 });

  // ---------------------------------------------------------------- VENTWALL: louvred vents
  await T('VENTWALL', 256, 256, (s) => {
    const { w, h } = s;
    s.fill(P.steelLo, 0.3);
    for (let bay = 0; bay < 2; bay++) {
      const x0 = bay * 128;
      s.rect(x0 + 2, 2, x0 + 126, h - 2, { h: 6, bevel: 4, op: 'set', color: mix3(P.steelLo, P.beigeLo, 0.35), r: 3 });
      s.rect(x0 + 14, 14, x0 + 114, h - 14, { h: 0, bevel: 1, op: 'set', color: [18, 18, 20] });
      // angled louvres: height ramps from the top of each slat down to its lip
      for (let y = 18; y < h - 16; y += 12) {
        s.stamp((px, py) => sdBox(px, py, x0 + 64, y + 4, 50, 4.5), [x0 + 14, y, x0 + 114, y + 9], {
          h: 1, op: 'set', fn: (i, cov, t, d, px, py) => { s.H[i] = mix(s.H[i], (py - y) * 0.7 + 1, cov); s.setC(i, mix3([60, 62, 66], P.steel, (py - y) / 9), cov); s.S[i] = 0.4; },
        });
      }
      for (const [bx, by] of [[x0 + 7, 7], [x0 + 121, 7], [x0 + 7, h - 7], [x0 + 121, h - 7]]) s.bolt(bx, by, 2, { h: 1.4, slot: true });
    }
    s.mottle(0.06, 6, 6, 4, 121); s.grain(0.02, 122);
    s.grime([40, 38, 34], (u, v) => 0.15 + sstep(0.8, 1, v) * 0.2, { seed: 123, fx: 12, fy: 12 });
    s.streaks([50, 46, 40], { amount: 0.4, fx: 24, seed: 124, len: 0.3, start: () => 0.9 });
  }, { specK: 1.0, shadow: 12, shadowK: 0.6 });

  // ---------------------------------------------------------------- PIPEWALL: pipe runs on a dark wall
  await T('PIPEWALL', 256, 256, (s) => {
    const { w, h } = s;
    s.fill([74, 74, 72], 0.1);
    // wall: dark painted block
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < w + 64; x += 64)
      s.rect(x + 1, y + 1, x + 63, y + 31, { h: 1.5, bevel: 1.5, op: 'set', color: mix3([80, 80, 76], [66, 66, 64], hash(x, y, 131)) });
    const pipe = (y, r, col, spec) => {
      hband(s, y - r, y + r, { h: 14 + r, bevel: r, prof: 'round', color: col, spec, op: 'set' });
    };
    pipe(40, 16, [150, 150, 146], 0.8);          // big steel main
    pipe(86, 9, [52, 110, 70], 0.5);             // green process line
    pipe(116, 9, [170, 60, 40], 0.5);            // red fire line
    pipe(200, 20, [120, 116, 104], 0.6);         // lagged steam line
    // lagging bands on the steam line
    for (let x = 0; x < w; x += 32) s.rect(x, 180, x + 3, 220, { h: 36, bevel: 2, op: 'max', color: [90, 88, 80] });
    // flanges + brackets every 128 px
    for (let x = 60; x < w; x += 128) {
      s.rect(x, 20, x + 8, 60, { h: 34, bevel: 3, prof: 'round', op: 'max', color: [130, 130, 126], spec: 0.8 });
      for (const by of [22, 58]) s.bolt(x + 4, by, 1.8, { h: 1.5, spec: 0.8 });
      s.rect(x + 40, 74, x + 50, 128, { h: 30, bevel: 2, op: 'max', color: [60, 60, 62], spec: 0.4 });
      s.rect(x + 34, 172, x + 46, 228, { h: 44, bevel: 2, op: 'max', color: [60, 60, 62], spec: 0.4 });
    }
    // valve wheel on the green line
    s.ring(120, 86, 13, 3.4, { h: 30, bevel: 2, prof: 'round', op: 'max', color: [190, 40, 30], spec: 0.6 });
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.4; s.seg(120, 86, 120 + Math.cos(a) * 12, 86 + Math.sin(a) * 12, 1.6, { h: 29, op: 'max', bevel: 1, color: [170, 36, 28] }); }
    s.circle(120, 86, 4, { h: 31, op: 'max', bevel: 2, prof: 'round', color: [120, 120, 120], spec: 0.9 });
    // stencil labels on the pipes
    s.art((g) => {
      g.font = 'bold 10px "DejaVu Sans", sans-serif'; g.fillStyle = 'rgba(240,230,60,0.9)';
      g.fillRect(170, 80, 50, 12); g.fillStyle = '#111'; g.fillText('N₂ ▶', 176, 90);
      g.fillStyle = 'rgba(245,245,240,0.85)'; g.fillText('FIRE WATER', 150, 120);
      g.fillStyle = 'rgba(20,20,20,0.8)'; g.font = 'bold 12px "DejaVu Sans", sans-serif'; g.fillText('STEAM 250 PSI', 20, 205);
    });
    s.mottle(0.08, 8, 8, 4, 132); s.grain(0.03, 133);
    s.streaks(P.rust, { amount: 0.5, fx: 20, seed: 134, len: 0.2, start: (u) => 60 / 256 });
    s.streaks([40, 38, 36], { amount: 0.3, fx: 16, seed: 135, len: 0.25, start: () => 228 / 256 });
    s.edgeWear([190, 190, 186], 0.3, 2, 136);
  }, { specK: 1.1, shadow: 16, shadowK: 0.55, ao: [[2, 0.2], [6, 0.08], [16, 0.03]] });

  // ---------------------------------------------------------------- SUPPORT: steel I-beam face (64 x 256)
  await T('SUPPORT', 64, 256, (s) => {
    const { w, h } = s;
    const paint = [104, 100, 92];
    s.fill(paint, 0.3);
    vband(s, 0, 11, { h: 8, bevel: 3, prof: 'smooth', color: mix3(paint, P.steel, 0.2) });
    vband(s, 53, 64, { h: 8, bevel: 3, prof: 'smooth', color: mix3(paint, P.steel, 0.2) });
    vband(s, 13, 51, { h: 0, bevel: 1, color: mix3(paint, [60, 58, 54], 0.4) });
    for (const y0 of [0, 128]) {
      s.rect(12, y0 - 7, 52, y0 + 7, { h: 6, bevel: 2, op: 'max', color: mix3(paint, P.steel, 0.3) });
      for (const bx of [20, 32, 44]) { s.bolt(bx, y0 - 3, 2, { h: 1.5, hex: true, spec: 0.6 }); }
    }
    for (let y = 8; y < h; y += 16) { s.bolt(5.5, y, 1.6, { h: 1.2, spec: 0.6 }); s.bolt(58.5, y, 1.6, { h: 1.2, spec: 0.6 }); }
    s.art((g) => { g.save(); g.translate(36, 90); g.rotate(-Math.PI / 2); g.font = 'bold 12px "DejaVu Sans", sans-serif'; g.fillStyle = 'rgba(230,220,200,0.55)'; g.textAlign = 'center'; g.fillText('C-14', 0, 0); g.restore(); });
    s.each((u, v, x, y, i) => { const g = fbm(u, v, 2, 8, 4, 141); const k = 0.85 + g * 0.25; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; });
    s.grain(0.03, 142);
    s.streaks(P.rust, { amount: 0.55, fx: 8, seed: 143, len: 0.3, start: () => 8 / 256 });
    s.edgeWear([170, 166, 158], 0.6, 1, 144);
  }, { specK: 1.1 });

  // ---------------------------------------------------------------- ELEVDOOR: freight lift door
  await T('ELEVDOOR', 256, 256, (s) => {
    const { w, h } = s;
    s.fill([150, 154, 156], 0.6);
    s.each((u, v, x, y, i) => { const b = fbm(u, v, 128, 3, 2, 151); const k = 0.9 + b * 0.14; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; });
    s.rect(0, 0, 128, 256, { h: 3, bevel: 1.2, op: 'set' }); s.rect(128, 0, 256, 256, { h: 3, bevel: 1.2, op: 'set' });
    vband(s, 126, 130, { h: 0, bevel: 1, color: [22, 22, 24] });
    // header plate
    s.rect(0, 0, 256, 26, { h: 5, bevel: 2, op: 'set', color: [80, 84, 88] });
    s.art((g) => { g.font = 'bold 14px "DejaVu Sans", sans-serif'; g.fillStyle = 'rgba(226,180,40,0.95)'; g.textAlign = 'center'; g.fillText('FREIGHT LIFT 2', 128, 18); });
    // horizontal stiffener ribs
    for (const y of [70, 128, 186]) for (const x0 of [0, 128]) s.rect(x0 + 12, y - 5, x0 + 116, y + 5, { h: 6, bevel: 3, prof: 'round', op: 'max', color: [170, 174, 176], spec: 0.9 });
    // hazard foot
    s.rect(-2, 228, 258, 256, { h: 4, bevel: 1.5, op: 'set', color: (px, py) => hazard(px, py, 28) });
    for (let x = 8; x < w; x += 24) s.bolt(x, 13, 2, { h: 1.2, hex: true });
    s.grain(0.02, 152);
    s.edgeWear([210, 214, 216], 0.5, 1, 153);
    s.grime(P.soot, (u, v) => sstep(0.75, 1, v) * 0.35, { seed: 154 });
  }, { specK: 1.4 });

  // ---------------------------------------------------------------- EXITSIGN (128 x 64 = 64 x 32 units)
  await T('EXITSIGN', 128, 64, (s) => {
    const { w, h } = s;
    s.fill([58, 58, 60], 0.3);
    s.rect(0, 0, w, h, { h: 4, bevel: 3, op: 'set', color: [70, 70, 72], r: 3 });
    s.rect(8, 8, w - 8, h - 8, { h: 1, bevel: 1.5, op: 'set', color: [70, 10, 8], spec: 1 });
    const m = textMask(s, 'EXIT', 64, 46, { font: 'bold 34px "DejaVu Sans", sans-serif', align: 'center', sx: 0.95, spacing: 2 });
    s.apply(m, { color: [255, 90, 70], E: [255, 40, 20], eAlpha: 0.9 });
    s.glow(m, [255, 30, 10], 4, 0.45);
    for (const [bx, by] of [[4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]]) s.bolt(bx, by, 1.6, { h: 1 });
    s.grain(0.02, 161);
  }, { specK: 1.2, shadow: 4 });

  // ---------------------------------------------------------------- SW1LAB / SW2LAB (128 x 256)
  for (const on of [0, 1]) {
    await T(on ? 'SW2LAB' : 'SW1LAB', 128, 256, (s) => {
      labWall(s, { seed: 7, pw: 128 });
      const cx = 64, cy = 104;
      // label plate
      s.rect(cx - 26, cy - 58, cx + 26, cy - 44, { h: 2, bevel: 1, op: 'set', color: [214, 208, 186] });
      s.art((g) => { g.font = 'bold 9px "DejaVu Sans", sans-serif'; g.fillStyle = '#2a2a2a'; g.textAlign = 'center'; g.fillText('DOOR CTRL', cx, cy - 48); });
      // housing
      s.rect(cx - 26, cy - 38, cx + 26, cy + 38, { h: 10, bevel: 4, op: 'set', color: [92, 96, 100], r: 4, spec: 0.4 });
      s.rect(cx - 19, cy - 31, cx + 19, cy + 13, { h: 7, bevel: 1.5, op: 'set', color: [52, 54, 58] });
      s.rect(cx - 3.5, cy - 26, cx + 3.5, cy + 8, { h: 3, op: 'set', bevel: 1, color: [14, 14, 16] });
      // lever: up = off, down = on
      const ly = on ? cy + 4 : cy - 22;
      s.seg(cx, cy - 9, cx, ly, 2.6, { h: 14, op: 'max', bevel: 2.6, prof: 'round', color: [170, 172, 174], spec: 0.9 });
      s.rect(cx - 12, ly - 5, cx + 12, ly + 5, { h: 18, op: 'max', bevel: 5, prof: 'round', color: [196, 36, 28], spec: 0.9, r: 4 });
      // indicator lamp
      const lamp = on ? P.green : P.red;
      s.circle(cx, cy + 25, 7, { h: 13, op: 'set', bevel: 4, prof: 'round', color: mix3(lamp, [255, 255, 255], 0.35), spec: 1 });
      const lm = s.mask((g) => { g.beginPath(); g.arc(cx, cy + 25, 6, 0, 7); g.fill(); }, { wrap: false });
      s.apply(lm, { E: lamp, eAlpha: 0.9 }); s.glow(lm, lamp, 5, 0.5);
      if (!on) s.circle(cx, cy + 25, 7, { color: [90, 20, 16], alpha: 0.0 });
      for (const [bx, by] of [[cx - 21, cy - 33], [cx + 21, cy - 33], [cx - 21, cy + 33], [cx + 21, cy + 33]]) s.bolt(bx, by, 2, { h: 1.4, hex: true, spec: 0.6 });
    }, { specK: 1.1, shadow: 12 });
  }

  // ---------------------------------------------------------------- WINFRAME: window frame trim
  await T('WINFRAME', 256, 256, (s) => {
    const { w, h } = s;
    const paint = [112, 108, 100];
    s.fill(paint, 0.4);
    for (const y0 of [0, 128]) {
      s.rect(-4, y0 + 2, w + 4, y0 + 30, { h: 6, bevel: 3, op: 'set', color: mix3(paint, P.steel, 0.3), prof: 'smooth' });
      s.rect(-4, y0 + 30, w + 4, y0 + 36, { h: 2, bevel: 1, op: 'set', color: [30, 30, 30] });  // rubber gasket
      s.rect(-4, y0 + 36, w + 4, y0 + 126, { h: 4, bevel: 2, op: 'set', color: paint });
      for (let x = 16; x < w; x += 32) s.bolt(x, y0 + 16, 2, { h: 1.3, slot: true, spec: 0.7 });
    }
    for (let x = 0; x < w; x += 64) s.rect(x - 1, 36, x + 1, 126, { h: 1.5, op: 'sub', bevel: 1 });
    for (let x = 0; x < w; x += 64) s.rect(x - 1, 164, x + 1, 254, { h: 1.5, op: 'sub', bevel: 1 });
    s.each((u, v, x, y, i) => { const b = fbm(u, v, 64, 4, 2, 171); const k = 0.9 + b * 0.12; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; });
    s.mottle(0.06, 6, 6, 4, 172); s.grain(0.02, 173);
    s.edgeWear([180, 178, 170], 0.6, 1, 174);
  }, { specK: 1.2 });

  // ---------------------------------------------------------------- GLASS1 (alpha mid texture)
  await T('GLASS1', 256, 256, (s) => {
    s.fill([150, 196, 190]);
    s.each((u, v, x, y, i) => {
      const t = fract((x - y * 0.6) / 256);
      const d1 = Math.abs(t - 0.3), d2 = Math.abs(t - 0.38), d3 = Math.abs(t - 0.8);
      const streak = clamp(1 - d1 / 0.06) * 0.55 + clamp(1 - d2 / 0.012) * 0.5 + clamp(1 - d3 / 0.03) * 0.35;
      const smudge = fbm(u, v, 4, 4, 4, 181);
      const dirt = sstep(0.75, 1, v) * 0.5 + clamp((smudge - 0.6) * 2) * 0.4;
      const a = 88 + streak * 60 + dirt * 40;
      s.setC(i, mix3([150, 196, 190], [235, 250, 250], streak * 0.8), 1);
      s.setC(i, [120, 126, 110], dirt * 0.5);
      s.A[i] = a / 255;
    });
  }, { ao: [], shadow: 0, specK: 0 });

  // ---------------------------------------------------------------- GLASSBRK: shards around the frame
  await T('GLASSBRK', 256, 256, (s) => {
    const { w, h } = s;
    s.fill([150, 196, 190]);
    s.A.fill(0);
    const r = rng(191);
    const shards = [];
    // jagged edge profile along each side: depth varies, some deep daggers
    const edge = (n, len, depthMax) => Array.from({ length: n + 1 }, (_, k) => [k / n * len, r() < 0.2 ? depthMax * (0.7 + r() * 0.6) : depthMax * (0.1 + r() * 0.35)]);
    const top = edge(14, w, 70), bot = edge(12, w, 40), left = edge(10, h, 44), right = edge(10, h, 44);
    shards.push([[0, 0], ...top.map(([t, d]) => [t, d]), [w, 0]]);
    shards.push([[0, h], ...bot.map(([t, d]) => [t, h - d]), [w, h]]);
    shards.push([[0, 0], ...left.map(([t, d]) => [d, t]), [0, h]]);
    shards.push([[w, 0], ...right.map(([t, d]) => [w - d, t]), [w, h]]);
    // a loose hanging dagger and a corner piece still in place
    shards.push([[150, 0], [176, 0], [166, 118], [158, 96]]);
    shards.push([[w, h], [w - 90, h], [w - 60, h - 70], [w, h - 110]]);
    const m = s.mask((g) => { for (const p of shards) { g.beginPath(); p.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); } }, { wrap: false });
    // bright edges of the break
    const em = s.bevelOf(m, 3);
    for (let i = 0; i < s.n; i++) {
      if (m[i] <= 0) continue;
      const edgeHi = clamp(1 - em[i]) * m[i];
      s.A[i] = (96 + edgeHi * 130) / 255 * m[i];
      s.setC(i, [240, 252, 250], edgeHi * 0.85);
    }
    // crack lines inside the remaining pieces
    const cm = s.mask((g) => {
      g.lineWidth = 1; g.strokeStyle = '#fff';
      for (let k = 0; k < 26; k++) {
        const side = r.int(0, 3); let x, y;
        if (side === 0) { x = r() * w; y = 0; } else if (side === 1) { x = r() * w; y = h; } else if (side === 2) { x = 0; y = r() * h; } else { x = w; y = r() * h; }
        g.beginPath(); g.moveTo(x, y);
        const a = Math.atan2(h / 2 - y, w / 2 - x) + (r() - 0.5) * 1.2;
        for (let j = 0; j < 4; j++) { x += Math.cos(a + (r() - 0.5) * 0.8) * 14; y += Math.sin(a + (r() - 0.5) * 0.8) * 14; g.lineTo(x, y); }
        g.stroke();
      }
    }, { wrap: false });
    for (let i = 0; i < s.n; i++) if (m[i] > 0.5 && cm[i] > 0.1) { s.A[i] = Math.max(s.A[i], 0.85 * cm[i]); s.setC(i, [245, 255, 255], cm[i]); }
  }, { ao: [], shadow: 0, specK: 0 });

  // ---------------------------------------------------------------- FENCEMID: chain-link, top rail, barbed wire (alpha)
  await T('FENCEMID', 256, 256, (s) => {
    const { w, h } = s;
    s.A.fill(0);
    const P2 = 32, meshTop = 58;
    // chain-link diamonds below the top rail, with twisted knuckles at the top edge
    s.each((u, v, x, y, i) => {
      if (y < meshTop - 3) return;
      const a = fract((x + y) / P2), b = fract((x - y) / P2);
      const d1 = Math.abs(a - 0.5) * P2 * 0.7071, d2 = Math.abs(b - 0.5) * P2 * 0.7071, r = 1.35;
      const ci = Math.floor((x + y) / P2) + Math.floor((x - y + 1024) / P2);
      const onTopA = ci % 2 === 0;
      let hgt = -1, cov = 0;
      for (const [d, top] of [[d1, onTopA], [d2, !onTopA]]) {
        if (d < r + 0.8) { const c = clamp(r + 0.5 - d); const hh = Math.sqrt(Math.max(0, r * r - d * d)) + (top ? 1.5 : 0); if (hh > hgt) hgt = hh; cov = Math.max(cov, c); }
      }
      if (y < meshTop) cov *= clamp((y - (meshTop - 3)) / 3);
      if (cov > 0) { s.A[i] = cov; s.H[i] = hgt * 1.6; }
    });
    // top rail pipe with sleeve couplings
    const rail = (y0, r0) => s.stamp((px, py) => Math.abs(py - y0) - r0, [0, y0 - r0, w - 1, y0 + r0], { h: r0 * 2, bevel: r0, prof: 'round', op: 'set', a: 1 });
    rail(meshTop - 4, 4.5);
    for (const x of [96]) s.rect(x, meshTop - 10, x + 12, meshTop + 2, { h: 11, bevel: 5, prof: 'round', op: 'set', a: 1 });
    // barbed wire: three twisted strands with four-point barbs every 24 px
    const strands = [10, 24, 38];
    strands.forEach((y0, k) => {
      const ph = k * 1.7;
      s.each((u, v, x, y, i) => {
        if (Math.abs(y - y0) > 5) return;
        const sag = Math.sin(x / w * Math.PI * 2 + ph) * 1.2;
        let cov = 0, hh = 0;
        for (const q of [0, Math.PI]) { // two twisted wires
          const yy = y0 + sag + Math.sin(x / 5 + q + ph) * 1.1;
          const d = Math.abs(y - yy); const c = clamp(1.4 - d);
          if (c > cov) { cov = c; hh = 1.2 + Math.cos(x / 5 + q + ph) * 0.8; }
        }
        if (cov > 0) { s.A[i] = Math.max(s.A[i], cov); s.H[i] = Math.max(s.H[i], hh * 1.5); }
      });
      for (let x = 6 + k * 8; x < w; x += 24) {
        const yy = y0 + Math.sin(x / w * Math.PI * 2 + ph) * 1.2;
        for (const [dx, dy] of [[-3.5, -3.5], [3.5, 3.5], [-3.5, 3.5], [3.5, -3.5]]) s.seg(x, yy, x + dx, yy + dy, 0.6, { h: 2.2, bevel: 0.6, op: 'max', a: 1 });
        s.circle(x, yy, 1.6, { h: 2.6, bevel: 1.2, prof: 'round', op: 'max', a: 1 });
      }
    });
    // bleed colour everywhere so filtering never fringes; galvanised with a little rust
    s.fill([176, 182, 186], 0.9);
    s.mottle(0.12, 8, 8, 3, 201);
    s.grime(P.rust, (u, v) => (v < 0.2 ? 0.3 : 0.12), { seed: 202, fx: 6, fy: 6, contrast: 3 });
  }, { ao: [[1.5, 0.2]], shadow: 0, specK: 1.2, specPow: 16, amb: 0.5 });

  // ---------------------------------------------------------------- ALNHULL1: alien hull grown into the wall
  await T('ALNHULL1', 256, 256, (s) => {
    s.fill(A.violet);
    hullPlates(s, { fx: 2, fy: 3, seed: 211, glow: 0.4 });
    boneRibs(s, { n: 2, width: 22, h: 14, seed: 212, sway: 0.015 });
    // tendons: thin horizontal sinews between the ribs
    const r = rng(213);
    for (let k = 0; k < 6; k++) {
      const y = r() * 256, x0 = r() * 256; const pts = [];
      for (let j = 0; j <= 8; j++) pts.push([x0 + j * 10, y + Math.sin(j * 0.8 + k) * 4, 2.2 - j * 0.12]);
      s.tube(pts, 2, { h: 5, bevel: 2, prof: 'round', op: 'max', color: A.plum, spec: 0.6 });
    }
    s.grain(0.03, 214);
  }, { specK: 1.2, specPow: 18, amb: 0.4 });

  // ---------------------------------------------------------------- ALNVEIN: teal-veined growth over the lab panels
  await T('ALNVEIN', 256, 256, (s) => {
    labWall(s, { seed: 9 });
    veins(s, { count: 6, seed: 221, r0: 7 });
    // a spreading dark bruise from the upper left
    s.grime([60, 40, 66], (u, v) => clamp(0.6 - Math.hypot(mod(u - 0.2 + 0.5, 1) - 0.5, mod(v - 0.3 + 0.5, 1) - 0.5) * 2.2), { seed: 222, fx: 8, fy: 8, contrast: 2 });
  }, { specK: 1.1 });

  // ---------------------------------------------------------------- LABSIGN1: department sign on the panels (512 x 256)
  await T('LABSIGN1', 512, 256, (s) => {
    labWall(s, { seed: 11 });
    const x0 = 64, x1 = 448, y0 = 30, y1 = 122;
    s.rect(x0, y0, x1, y1, { h: 6, bevel: 2, op: 'set', color: [40, 50, 64], r: 3, spec: 0.3 });
    s.rect(x0 + 6, y0 + 6, x0 + 96, y1 - 6, { h: 6.5, bevel: 1, op: 'set', color: P.orange });
    const big = textMask(s, 'S-4', x0 + 51, y0 + 62, { font: 'bold 44px "DejaVu Sans", sans-serif', align: 'center', sx: 0.9 });
    s.apply(big, { color: [24, 22, 20] });
    const fit = (str, font, avail, sp = 0) => Math.min(1, avail / textWidth(str, font, 1, sp));
    const tx = x0 + 108, avail = x1 - 56 - tx;
    const f1 = 'bold 30px "DejaVu Sans", sans-serif', f2 = 'bold 11px "DejaVu Sans", sans-serif', f3 = 'bold 10px "DejaVu Sans", sans-serif';
    s.apply(textMask(s, 'XENOBIOLOGY', tx, y0 + 44, { font: f1, sx: fit('XENOBIOLOGY', f1, avail) }), { color: [236, 232, 220] });
    s.apply(textMask(s, 'LEVEL 3 \u2022 SPECIMEN CONTAINMENT', tx + 1, y0 + 64, { font: f2, sx: fit('LEVEL 3 \u2022 SPECIMEN CONTAINMENT', f2, avail, 0.5), spacing: 0.5 }), { color: [200, 196, 186] });
    s.apply(textMask(s, 'AUTHORIZED PERSONNEL ONLY', tx + 1, y0 + 80, { font: f3, sx: fit('AUTHORIZED PERSONNEL ONLY', f3, avail, 0.5), spacing: 0.5 }), { color: P.orange });
    s.rect(x1 - 50, y0 + 10, x1 - 48, y1 - 10, { color: [90, 100, 114] });
    s.poly([[x1 - 42, y0 + 38], [x1 - 26, y0 + 38], [x1 - 26, y0 + 28], [x1 - 10, y0 + 46], [x1 - 26, y0 + 64], [x1 - 26, y0 + 54], [x1 - 42, y0 + 54]], { color: [236, 232, 220], h: 0.5, bevel: 0.5 });
    for (const [bx, by] of [[x0 + 5, y0 + 5], [x1 - 5, y0 + 5], [x0 + 5, y1 - 5], [x1 - 5, y1 - 5]]) s.bolt(bx, by, 2, { h: 1.2, hex: true });
    s.grain(0.015, 231);
  }, { specK: 1 });

  // ---------------------------------------------------------------- POSTER1: "THEY'RE ALREADY HERE"
  await T('POSTER1', 256, 256, (s) => {
    labWall(s, { seed: 13 });
    const x0 = 72, x1 = 184, y0 = 10, y1 = 144;
    // photo + headline painted with canvas
    s.art((g) => {
      g.fillStyle = '#e8e2d2'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = '#16181c'; g.fillRect(x0 + 5, y0 + 5, x1 - x0 - 10, 76);
      const px0 = x0 + 5, py0 = y0 + 5, pw = x1 - x0 - 10, ph = 76;
      const grd = g.createLinearGradient(0, py0, 0, py0 + ph); grd.addColorStop(0, '#0b1020'); grd.addColorStop(0.7, '#27344a'); grd.addColorStop(1, '#3a4252');
      g.fillStyle = grd; g.fillRect(px0, py0, pw, ph);
      // light cone under the craft
      g.save(); g.beginPath(); g.rect(px0, py0, pw, ph); g.clip();
      const cone = g.createLinearGradient(0, py0 + 30, 0, py0 + ph); cone.addColorStop(0, 'rgba(210,230,255,0.55)'); cone.addColorStop(1, 'rgba(210,230,255,0.05)');
      g.fillStyle = cone; g.beginPath(); g.moveTo(px0 + pw * 0.5 - 8, py0 + 32); g.lineTo(px0 + pw * 0.5 + 8, py0 + 32); g.lineTo(px0 + pw * 0.5 + 30, py0 + ph); g.lineTo(px0 + pw * 0.5 - 30, py0 + ph); g.fill();
      // the disc (slightly blurred, tilted)
      g.translate(px0 + pw * 0.52, py0 + 28); g.rotate(-0.12);
      g.filter = 'blur(0.6px)';
      g.fillStyle = '#9aa4b0'; g.beginPath(); g.ellipse(0, 0, 30, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#c8d0da'; g.beginPath(); g.ellipse(0, -5, 12, 7, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#5a6068'; g.beginPath(); g.ellipse(0, 2, 30, 4, 0, 0, Math.PI); g.fill();
      for (let k = -3; k <= 3; k++) { g.fillStyle = k % 2 ? '#ffd27a' : '#ff6a4a'; g.beginPath(); g.arc(k * 8, 3, 1.6, 0, 7); g.fill(); }
      g.restore();
      // treeline + film grain
      g.fillStyle = '#07090c'; g.beginPath(); g.moveTo(px0, py0 + ph);
      for (let x = 0; x <= pw; x += 3) g.lineTo(px0 + x, py0 + ph - 8 - Math.abs(Math.sin(x * 0.7) * 6) - (x % 9 === 0 ? 6 : 0));
      g.lineTo(px0 + pw, py0 + ph); g.fill();
      // headline
      g.fillStyle = '#1b1b1b'; g.textAlign = 'center';
      g.font = 'bold 21px "DejaVu Sans", sans-serif';
      g.save(); g.translate(x0 + (x1 - x0) / 2, y0 + 102); g.scale(0.78, 1); g.fillText("THEY'RE", 0, 0); g.restore();
      g.save(); g.translate(x0 + (x1 - x0) / 2, y0 + 123); g.scale(0.78, 1); g.fillStyle = '#b3261e'; g.fillText('ALREADY HERE', 0, 0); g.restore();
      g.font = 'bold 7px "DejaVu Sans", sans-serif'; g.fillStyle = '#333'; g.fillText('REPORT EVERY LIGHT IN THE SKY', x0 + (x1 - x0) / 2, y0 + 132);
    });
    // grain on the photo area
    s.each((u, v, x, y, i) => { if (x > x0 + 5 && x < x1 - 5 && y > y0 + 5 && y < y0 + 81) { const k = 0.8 + hash(x, y, 241) * 0.4; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; } });
    // paper relief: slight lift, wrinkles, a curled corner, tape
    s.rect(x0, y0, x1, y1, { h: 1.2, bevel: 0.8, op: 'add' });
    s.each((u, v, x, y, i) => { if (x >= x0 && x < x1 && y >= y0 && y < y1) { s.H[i] += (ridged(u, v, 6, 6, 3, 242) - 0.6) * 1.6; } });
    s.poly([[x1 - 16, y1], [x1, y1], [x1, y1 - 18]], { color: [150, 140, 118], h: 3, bevel: 3 });
    for (const [tx, ty, a] of [[x0 + 2, y0 + 2, -0.6], [x1 - 2, y0 + 2, 0.6], [x0 + 2, y1 - 2, 0.6]]) {
      s.stamp((px, py) => { const dx = px - tx, dy = py - ty, c = Math.cos(a), sn = Math.sin(a); return Math.max(Math.abs(dx * c + dy * sn) - 9, Math.abs(-dx * sn + dy * c) - 3.5); }, [tx - 11, ty - 11, tx + 11, ty + 11], { h: 0.6, bevel: 0.5, color: [226, 214, 170], alpha: 0.75, spec: 0.5 });
    }
    s.grime(P.grime, (u, v, x, y) => (x >= x0 && x < x1 && y >= y0 && y < y1 ? 0.12 : 0), { seed: 243, fx: 12, fy: 12, contrast: 2 });
  }, { specK: 0.8, shadow: 6 });
}

function sdBox(px, py, cx, cy, hx, hy, r = 0) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

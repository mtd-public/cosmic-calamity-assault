// MAP02 Washington D.C. at night (Duke Nukem 3D seedy): wall textures.
import { Surf, save, clamp, mix, sstep, fbm, vn, ridged, worley, fract, mod, rng, hash, textMask, textWidth } from '../lib/env/tex.js';
import { hband, vband, mix3, P } from '../lib/env/lab.js';
import { CP, bricks, spray, poster } from '../lib/env/city.js';
import { strokes, neon } from '../lib/env/neon.js';

export default async function (F) {
  const T = async (name, w, h, paint, bake = {}) => {
    const s = new Surf(w, h);
    await paint(s);
    await save(F, 'textures', name, s.bake(bake));
  };
  const sootUp = (s, k = 0.35, seed = 1) => s.grime(CP.soot, (u, v) => sstep(0.7, 1, v) * k + sstep(0.15, 0, v) * k * 0.4, { seed, fx: 12, fy: 4 });

  // ---------------------------------------------------------------- bricks
  await T('BRICKRED', 256, 256, (s) => {
    bricks(s, { seed: 501 });
    s.streaks([60, 40, 34], { amount: 0.3, fx: 16, seed: 502, len: 0.5 });
    s.grime([200, 196, 184], () => 0.08, { seed: 503, fx: 6, fy: 6, contrast: 3 }); // efflorescence
    sootUp(s, 0.3, 504);
  }, { shadow: 5, amb: 0.45 });
  await T('BRICKDRK', 256, 256, (s) => {
    bricks(s, { seed: 511, col: [96, 62, 52], mortar: [86, 80, 74], vari: 0.25, burnt: 0.2 });
    s.streaks([30, 26, 24], { amount: 0.5, fx: 16, seed: 512, len: 0.6 });
    s.grime([40, 36, 34], () => 0.22, { seed: 513, fx: 8, fy: 8, contrast: 2.4 });
    sootUp(s, 0.4, 514);
  }, { shadow: 5, amb: 0.45 });

  // ---------------------------------------------------------------- storefronts (512 x 256)
  const shopFrame = (s, { seed, sign, signCol, text }) => {
    const { w, h } = s;
    bricks(s, { seed, rect: [0, 0, w, h], col: [120, 58, 44] });
    // pilasters are the brick at the sides; sign board across the top
    s.rect(0, 0, w, 44, { h: 7, bevel: 2, op: 'set', color: signCol });
    hband(s, 44, 50, { h: 8, bevel: 2, color: [60, 60, 62], spec: 0.6 });
    if (text) s.apply(textMask(s, text, w / 2, 31, { font: 'bold 21px "DejaVu Sans", sans-serif', align: 'center', sx: 0.9, spacing: 3 }), { color: sign });
  };
  const glassPane = (s, x0, y0, x1, y1, inside, o = {}) => {
    s.rect(x0 - 5, y0 - 5, x1 + 5, y1 + 5, { h: 6, bevel: 2, op: 'set', color: [150, 152, 150], spec: 0.8 });
    s.rect(x0, y0, x1, y1, { h: 1, bevel: 1, op: 'set', color: [20, 24, 30], spec: 1 });
    s.art((g) => { g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); inside(g, x0, y0, x1 - x0, y1 - y0); g.restore(); });
    // reflections: street-light gradient and a diagonal glare
    s.each((u, v, x, y, i) => {
      if (x < x0 || x >= x1 || y < y0 || y >= y1) return;
      const t = (x - x0 - (y - y0) * 0.8) / (x1 - x0);
      const glare = Math.exp(-Math.pow((fract(t * 1.3) - 0.3) / 0.05, 2)) * 0.35 + Math.exp(-Math.pow((fract(t * 1.3) - 0.42) / 0.015, 2)) * 0.3;
      s.setC(i, [140, 160, 190], glare);
      s.S[i] = 1;
      if (o.lit) s.addE(i, s.getC(i), o.lit);
    });
  };
  await T('STOREFR1', 512, 256, (s) => {
    const { w, h } = s;
    shopFrame(s, { seed: 521, sign: [236, 200, 90], signCol: [36, 30, 44], text: 'LOANS • GOLD • GUITARS • TV' });
    // display window: TVs glowing on shelves, guitars hanging
    glassPane(s, 40, 66, 300, 196, (g, x, y, W, H) => {
      g.fillStyle = '#2a2622'; g.fillRect(x, y, W, H);
      g.fillStyle = '#4a3a2a'; g.fillRect(x, y + 70, W, 5); g.fillRect(x, y + 118, W, 5);
      for (let k = 0; k < 5; k++) { const tx = x + 12 + k * 50, ty = y + 36; g.fillStyle = '#151515'; g.fillRect(tx, ty, 40, 32); g.fillStyle = ['#5a8ad8', '#7aa0ff', '#3a6ac0', '#9ab8ff', '#4a7ae0'][k]; g.fillRect(tx + 4, ty + 4, 26, 22); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(tx + 4, ty + 4, 26, 3); }
      for (let k = 0; k < 4; k++) { const gx = x + 30 + k * 62, gy = y + 80; g.fillStyle = ['#8a3a1a', '#1a1a1a', '#c8a050', '#6a2020'][k]; g.beginPath(); g.ellipse(gx, gy + 26, 10, 12, 0, 0, 7); g.fill(); g.fillRect(gx - 2, gy - 6, 4, 26); }
      g.fillStyle = '#d8c070'; g.font = 'bold 12px "DejaVu Sans", sans-serif'; g.fillText('WE BUY GOLD', x + 150, y + 112);
    }, { lit: 0.35 });
    // security bars
    for (let x = 48; x < 300; x += 14) s.rect(x, 62, x + 3, 200, { h: 12, bevel: 1.5, prof: 'round', op: 'max', color: [70, 72, 74], spec: 0.7 });
    s.rect(38, 100, 302, 104, { h: 12, bevel: 1.5, op: 'max', color: [70, 72, 74] }); s.rect(38, 170, 302, 174, { h: 12, bevel: 1.5, op: 'max', color: [70, 72, 74] });
    // door with a glass panel and a small OPEN neon
    s.rect(322, 60, 424, h, { h: 6, bevel: 2, op: 'set', color: [60, 64, 66], spec: 0.5 });
    glassPane(s, 334, 72, 412, 196, (g, x, y, W, H) => { g.fillStyle = '#3a342c'; g.fillRect(x, y, W, H); g.fillStyle = '#6a5a40'; g.fillRect(x + 10, y + 60, 40, 60); }, { lit: 0.3 });
    neon(s, strokes('OPEN', 373, 100, 14, { align: 'center', spacing: 1.2 }), { color: [255, 50, 40], width: 2.2, halo: 6 });
    s.rect(340, 206, 406, 214, { h: 9, bevel: 3, prof: 'round', color: P.alu, spec: 0.9 });
    // kick plate + side window
    s.rect(40, 204, 300, h, { h: 4, bevel: 2, op: 'set', color: [44, 40, 38] });
    glassPane(s, 440, 66, 492, 196, (g, x, y, W, H) => { g.fillStyle = '#1a1612'; g.fillRect(x, y, W, H); }, {});
    s.mottle(0.06, 8, 4, 4, 522); s.grain(0.02, 523);
    sootUp(s, 0.35, 524);
  }, { shadow: 8, specK: 1.1 });

  await T('STOREFR2', 512, 256, (s) => {
    const { w, h } = s;
    shopFrame(s, { seed: 531, sign: [240, 240, 230], signCol: [120, 24, 20], text: 'BEER • WINE • SPIRITS • LOTTO' });
    const inside = (g, x, y, W, H) => {
      g.fillStyle = '#b8c8b0'; g.fillRect(x, y, W, H);                          // fluorescent-lit interior
      for (let k = 0; k < 4; k++) { g.fillStyle = '#6a7a64'; g.fillRect(x, y + 20 + k * 30, W, 4); for (let b = 0; b < W; b += 7) { g.fillStyle = ['#3a5a2a', '#6a2a1a', '#c8b060', '#2a3a6a'][(b + k) % 4]; g.fillRect(x + b, y + 6 + k * 30, 5, 14); } }
      const post = (px, py, pw, ph, bg, fg, t1, t2) => { g.fillStyle = bg; g.fillRect(px, py, pw, ph); g.fillStyle = fg; g.textAlign = 'center'; g.font = 'bold 15px "DejaVu Sans", sans-serif'; g.fillText(t1, px + pw / 2, py + ph / 2 + 2); g.font = 'bold 9px "DejaVu Sans", sans-serif'; if (t2) g.fillText(t2, px + pw / 2, py + ph / 2 + 16); g.textAlign = 'left'; };
      post(x + 10, y + 12, 70, 44, '#f0e020', '#c01010', 'COLD', 'BEER');
      post(x + 96, y + 20, 64, 40, '#ffffff', '#1a3aa0', 'LOTTO', 'PLAY HERE');
      post(x + 170, y + 8, 60, 50, '#e02020', '#ffffff', 'ICE', '$1.99');
      post(x + 20, y + 80, 90, 34, '#1a1a1a', '#f0f0f0', 'CHECKS', 'CASHED');
    };
    glassPane(s, 36, 66, 290, 196, inside, { lit: 0.25 });
    // smashed: crack web and a hole
    const cm = s.mask((g) => {
      g.lineWidth = 1.2; const cx = 210, cy = 150, r = rng(533);
      for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(cx, cy); let x = cx, y = cy; const a = k / 14 * 6.28 + r() * 0.3; for (let j = 0; j < 6; j++) { x += Math.cos(a + (r() - 0.5) * 0.6) * (8 + r() * 10); y += Math.sin(a + (r() - 0.5) * 0.6) * (8 + r() * 10); g.lineTo(x, y); } g.stroke(); }
      for (const rr of [10, 22, 36]) { g.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * 6.28; g.lineTo(cx + Math.cos(a) * rr * (0.8 + r() * 0.4), cy + Math.sin(a) * rr * (0.8 + r() * 0.4)); } g.stroke(); }
    }, { wrap: false });
    s.apply(cm, { color: [230, 240, 240], alpha: 0.8 });
    s.poly([[200, 140], [214, 136], [222, 150], [210, 162], [198, 154]], { color: [10, 10, 12], h: -1, op: 'set' });
    // door under a half-lowered security grille
    s.rect(320, 60, 440, h, { h: 1, bevel: 1, op: 'set', color: [16, 14, 12] });
    glassPane(s, 330, 150, 430, 250, (g, x, y, W, H) => { g.fillStyle = '#a0b098'; g.fillRect(x, y, W, H); }, { lit: 0.2 });
    s.each((u, v, x, y, i) => {
      if (x < 320 || x >= 440 || y < 60 || y >= 150) return;
      const lx = x - 320, ly = y - 60;
      const link = Math.abs(fract((lx + ly * 0.5) / 12) - 0.5) < 0.12 || Math.abs(fract((lx - ly * 0.5) / 12) - 0.5) < 0.12 || fract(ly / 10) < 0.18;
      if (link) { s.setC(i, [140, 142, 144]); s.H[i] = 8; s.S[i] = 0.8; }
    });
    s.rect(318, 146, 442, 154, { h: 10, bevel: 2, op: 'set', color: [110, 112, 114], spec: 0.7 });
    glassPane(s, 456, 66, 500, 196, (g, x, y, W, H) => { g.fillStyle = '#90a088'; g.fillRect(x, y, W, H); }, { lit: 0.2 });
    s.rect(36, 204, 290, h, { h: 4, bevel: 2, op: 'set', color: [120, 24, 20] });
    s.mottle(0.06, 8, 4, 4, 534); s.grain(0.02, 535);
    sootUp(s, 0.35, 536);
  }, { shadow: 8, specK: 1.1 });

  // ---------------------------------------------------------------- OFFICEWN: tower windows
  await T('OFFICEWN', 256, 256, (s) => {
    const { w, h } = s;
    const stone = [128, 124, 116];
    s.fill(stone, 0.2);
    s.each((u, v, x, y, i) => { const n = fbm(u, v, 8, 8, 4, 541); const k = 0.85 + n * 0.25; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; s.H[i] = n; });
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x0 = col * 64 + 10, y0 = row * 64 + 10, x1 = x0 + 44, y1 = y0 + 42;
      const lit = hash(col, row, 542) < 0.4, warm = hash(col, row, 543) < 0.7, blind = hash(col, row, 544);
      s.rect(x0 - 3, y0 - 3, x1 + 3, y1 + 3, { h: -2, op: 'add', bevel: 1.5, color: [70, 72, 76] });
      s.each((u, v, x, y, i) => {
        if (x < x0 || x >= x1 || y < y0 || y >= y1) return;
        const ly = (y - y0) / (y1 - y0), lx = (x - x0) / (x1 - x0);
        let c;
        if (lit) {
          c = warm ? [230, 190, 120] : [190, 214, 230];
          if (ly < blind * 0.8 && (y - y0) % 3 === 0) c = mix3(c, [120, 100, 70], 0.6);       // venetian blind
          if (ly > 0.7 && lx > 0.2 && lx < 0.6) c = mix3(c, [60, 50, 40], 0.7);             // a desk / chair silhouette
          s.setC(i, c); s.addE(i, c, 0.55);
        } else {
          const refl = 0.3 + 0.7 * (1 - ly) * 0.4 + (fract(lx * 0.7 - ly * 0.5) < 0.1 ? 0.3 : 0);
          c = [22 + refl * 30, 30 + refl * 40, 46 + refl * 60];
          if (ly < blind * 0.5 && (y - y0) % 3 === 0) c = mix3(c, [60, 60, 64], 0.5);
          s.setC(i, c); s.S[i] = 1;
        }
        s.H[i] = -3;
      });
      s.rect(x0 + 21, y0, x0 + 23, y1, { h: -1, op: 'set', color: [70, 72, 76] }); // mullion
    }
    // spandrel ledges
    for (let y = 0; y < h; y += 64) hband(s, y + 56, y + 60, { h: 2, bevel: 1, color: [150, 146, 136] });
    s.streaks([60, 58, 56], { amount: 0.35, fx: 16, seed: 545, len: 0.2, start: () => 60 / 256 });
    s.grain(0.02, 546);
  }, { shadow: 5, specK: 0.8 });

  // ---------------------------------------------------------------- MARBLE: polished slabs (Bureau lobby)
  await T('MARBLE', 256, 256, (s) => {
    s.each((u, v, x, y, i) => {
      const sx = Math.floor(x / 128), sy = Math.floor(y / 128);
      // bookmatched: mirror alternate slabs
      let lx = (x % 128) / 128, ly = (y % 128) / 128; if (sx % 2) lx = 1 - lx; if (sy % 2) ly = 1 - ly;
      const t = fbm(lx * 0.5 + 0.25, ly * 0.5 + 0.25, 4, 4, 5, 551), t2 = fbm(lx, ly, 6, 6, 5, 553);
      const vein = Math.abs(Math.sin((lx * 2 + ly * 3.5 + t * 7) * Math.PI));
      const fine = Math.abs(Math.sin((lx * 9 - ly * 6 + fbm(lx, ly, 8, 8, 4, 552) * 10) * Math.PI));
      let c = mix3([206, 196, 176], [228, 222, 208], clamp((t2 - 0.4) * 2));
      c = mix3(c, [168, 150, 112], clamp(1 - vein * 7) * 0.55);
      c = mix3(c, [96, 88, 80], clamp(1 - vein * 30) * 0.8);
      c = mix3(c, [130, 120, 104], clamp(1 - fine * 22) * 0.6);
      c = mix3(c, [186, 176, 160], clamp((0.45 - t2) * 3) * 0.5);
      s.setC(i, c); s.S[i] = 0.9;
      const fx = x % 128, fy = y % 128;
      s.H[i] = Math.min(fx, 127 - fx, fy, 127 - fy) < 1 ? -1 : 0;
    });
  }, { specK: 0.6, specPow: 40, shadow: 0, ao: [[1, 0.3]] });

  // ---------------------------------------------------------------- WOODPANL: walnut panelling
  await T('WOODPANL', 256, 256, (s) => {
    s.each((u, v, x, y, i) => {
      const b = Math.floor(x / 32), fx = x % 32;
      const tone = 0.85 + hash(b, 1, 561) * 0.25;
      const grain = fbm((x + b * 13) / 256, v, 64, 3, 4, 562 + b), ring = Math.sin((grain * 12 + fx * 0.06) * Math.PI);
      const k = tone * (0.8 + grain * 0.3 + ring * 0.06);
      s.setC(i, [104 * k, 64 * k, 38 * k]); s.S[i] = 0.35;
      s.H[i] = (fx < 1.5 || fx > 30.5 ? -2 : 0) + ring * 0.2;
      if (fx < 1.5 || fx > 30.5) s.setC(i, [40, 24, 16]);
    });
  }, { specK: 0.8, specPow: 20 });

  // ---------------------------------------------------------------- subway tile + station sign
  const subwayTile = (s, seed) => {
    const { w, h } = s;
    s.each((u, v, x, y, i) => {
      const row = Math.floor(y / 16), off = (row % 2) * 16, bx = x + off, c = Math.floor(bx / 32);
      const fx = bx - c * 32, fy = y - row * 16, d = Math.min(fx, 32 - fx, fy, 16 - fy);
      const band = row >= 9 && row <= 10;
      const n = fbm(u, v, 12, 12, 3, seed);
      if (d < 1.2) { s.setC(i, [96, 94, 88]); s.H[i] = 0; return; }
      let c0 = band ? [118, 34, 30] : [214, 212, 200];
      const k = 0.94 + hash(mod(c, 8), row, seed) * 0.08 - n * 0.06;
      s.setC(i, [c0[0] * k, c0[1] * k, c0[2] * k]); s.S[i] = 0.8;
      s.H[i] = 2 * clamp(d / 2.5);
    });
    // cracked and missing tiles
    const r = rng(seed + 1);
    for (let k = 0; k < 3; k++) { const row = r.int(0, 15), c = r.int(0, 7), off = (row % 2) * 16; const x0 = c * 32 - off, y0 = row * 16; s.rect(x0 + 1, y0 + 1, x0 + 31, y0 + 15, { h: -1, op: 'set', color: [120, 116, 104] }); }
    s.grime([90, 80, 60], (u, v) => sstep(0.6, 1, v) * 0.3 + sstep(0.1, 0, v) * 0.12 + 0.05, { seed: seed + 2, fx: 10, fy: 6, contrast: 2 });
    s.streaks([110, 96, 70], { amount: 0.3, fx: 24, seed: seed + 3, len: 0.4 });
  };
  await T('SUBWAYTL', 256, 256, (s) => subwayTile(s, 571), { specK: 0.9, specPow: 30, shadow: 3 });
  await T('SUBWAYSN', 512, 256, (s) => {
    subwayTile(s, 581);
    // mosaic name band with a border
    const x0 = 48, x1 = 464, y0 = 40, y1 = 124;
    s.rect(x0, y0, x1, y1, { h: 2.5, op: 'set', bevel: 1 });
    const tm = textMask(s, 'FEDERAL PLAZA', 256, 97, { font: 'bold 40px "DejaVu Sans", sans-serif', align: 'center', sx: 0.86, spacing: 2 });
    s.each((u, v, x, y, i) => {
      if (x < x0 || x >= x1 || y < y0 || y >= y1) return;
      const tx = Math.floor(x / 4), ty = Math.floor(y / 4), fx = x % 4, fy = y % 4;
      const border = x < x0 + 12 || x >= x1 - 12 || y < y0 + 12 || y >= y1 - 12;
      const inner = x < x0 + 16 || x >= x1 - 16 || y < y0 + 16 || y >= y1 - 16;
      let c;
      if (border) c = ((tx + ty) % 3 === 0) ? [180, 130, 40] : [110, 30, 26];
      else if (inner) c = [40, 36, 34];
      else {
        const cx = tx * 4 + 2, cy = ty * 4 + 2, on = tm[cy * s.w + cx] > 0.5;
        c = on ? [30, 30, 32] : [226, 222, 206];
      }
      const k = 0.9 + hash(tx, ty, 582) * 0.14;
      s.setC(i, [c[0] * k, c[1] * k, c[2] * k]);
      s.H[i] = fx === 0 || fy === 0 ? 1.2 : 2.4; s.S[i] = 0.7;
    });
    // hanging enamel direction sign
    s.rect(160, 150, 352, 186, { h: 5, bevel: 1.5, op: 'set', color: [20, 22, 26], r: 3, spec: 0.6 });
    s.apply(textMask(s, 'TO TRAINS →', 256, 175, { font: 'bold 18px "DejaVu Sans", sans-serif', align: 'center', sx: 0.9 }), { color: [240, 240, 236] });
    for (const x of [176, 336]) { s.circle(x, 168, 6, { color: x < 200 ? [200, 40, 30] : [40, 90, 200], h: 6, bevel: 2 }); }
    s.apply(textMask(s, 'R', 176, 172, { font: 'bold 9px "DejaVu Sans", sans-serif', align: 'center' }), { color: [255, 255, 255] });
    s.apply(textMask(s, 'B', 336, 172, { font: 'bold 9px "DejaVu Sans", sans-serif', align: 'center' }), { color: [255, 255, 255] });
  }, { specK: 0.9, specPow: 30, shadow: 3 });

  // ---------------------------------------------------------------- ROLLDOOR: roll-down shutter
  await T('ROLLDOOR', 256, 256, (s) => {
    const { w, h } = s;
    s.fill([138, 140, 140], 0.6);
    s.each((u, v, x, y, i) => {
      const ly = y % 12;
      s.H[i] = Math.sin(ly / 12 * Math.PI) * 3 + (ly < 1 ? -2 : 0);
      const n = fbm(u, v, 6, 6, 4, 591), b = fbm(u, v, 96, 2, 2, 592);
      const k = 0.8 + n * 0.3 + b * 0.08; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k;
    });
    s.grime(P.rust, () => 0.3, { seed: 593, fx: 8, fy: 8, contrast: 2.5 });
    // tags
    spray(s, (g) => { g.lineWidth = 3; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(40, 120); g.bezierCurveTo(60, 60, 80, 150, 100, 90); g.bezierCurveTo(110, 60, 130, 140, 150, 100); g.lineTo(170, 80); g.moveTo(120, 130); g.lineTo(200, 118); g.stroke(); }, [30, 30, 36], { seed: 594, drips: 4 });
    spray(s, (g) => { g.font = 'bold 34px "DejaVu Sans", sans-serif'; g.fillText('K-RAD', 70, 190); }, [200, 30, 110], { seed: 595, drips: 6, alpha: 0.85 });
    // bottom bar, handle and padlock
    s.rect(-2, h - 16, w + 2, h - 4, { h: 6, bevel: 2, op: 'set', color: [90, 92, 94], spec: 0.8 });
    s.rect(118, h - 24, 138, h - 12, { h: 9, bevel: 2, prof: 'round', color: [150, 150, 150], spec: 0.9 });
    s.rect(122, h - 12, 134, h - 2, { h: 11, bevel: 2, color: [170, 140, 60], spec: 0.9 });
    s.ring(128, h - 14, 4, 2, { h: 11, color: [180, 180, 180], spec: 0.9 });
    sootUp(s, 0.3, 596);
  }, { specK: 1, shadow: 4 });

  // ---------------------------------------------------------------- graffiti walls
  await T('GRAFFIT1', 256, 256, (s) => {
    bricks(s, { seed: 601 });
    // a bubble-letter piece: fill, outline, highlight
    const piece = (g) => { g.font = 'bold 70px "DejaVu Sans", sans-serif'; g.save(); g.translate(128, 150); g.rotate(-0.08); g.scale(1.05, 1); g.textAlign = 'center'; g.fillText('EBE', 0, 0); g.restore(); };
    spray(s, (g) => { g.lineWidth = 12; g.lineJoin = 'round'; g.font = 'bold 70px "DejaVu Sans", sans-serif'; g.save(); g.translate(128, 150); g.rotate(-0.08); g.scale(1.05, 1); g.textAlign = 'center'; g.strokeText('EBE', 0, 0); g.restore(); }, [20, 20, 24], { seed: 602 });
    spray(s, piece, [60, 210, 90], { seed: 603, drips: 8 });
    spray(s, (g) => { g.font = 'bold 70px "DejaVu Sans", sans-serif'; g.save(); g.translate(126, 146); g.rotate(-0.08); g.scale(1.05, 0.45); g.textAlign = 'center'; g.fillText('EBE', 0, -60); g.restore(); }, [190, 255, 190], { seed: 604, alpha: 0.5 });
    // stencilled alien head
    spray(s, (g) => { g.save(); g.translate(206, 60); g.beginPath(); g.ellipse(0, 0, 18, 24, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(-8, 2, 6, 10, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(8, 2, 6, 10, 0.5, 0, 7); g.fill(); g.restore(); }, [236, 236, 230], { seed: 605, soft: 1, alpha: 0.8 });
    spray(s, (g) => { g.font = 'bold 14px "DejaVu Sans Mono", monospace'; g.fillText('WE ARE NOT ALONE', 22, 228); }, [236, 60, 40], { seed: 606, drips: 3 });
    spray(s, (g) => { g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(20, 40); g.bezierCurveTo(30, 10, 60, 60, 70, 30); g.moveTo(40, 50); g.lineTo(90, 44); g.stroke(); }, [40, 40, 200], { seed: 607 });
    sootUp(s, 0.3, 608);
  }, { shadow: 5, amb: 0.45 });

  await T('GRAFFIT2', 256, 256, (s) => {
    // stucco / concrete wall
    s.fill(CP.stucco);
    s.each((u, v, x, y, i) => { const n = fbm(u, v, 8, 8, 5, 611), m = fbm(u, v, 48, 48, 2, 612); const k = 0.82 + n * 0.28 + (m - 0.5) * 0.12; s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k; s.H[i] = n * 2 + m; });
    // older buffed-out paint patches
    for (const [x, y, ww, hh, c] of [[20, 30, 90, 60, [120, 116, 104]], [150, 150, 80, 70, [134, 128, 116]]]) s.rect(x, y, x + ww, y + hh, { color: c, alpha: 0.6 });
    // UFO doodle with a beam and a stick figure
    spray(s, (g) => { g.lineWidth = 3; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.ellipse(70, 60, 40, 10, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(70, 52, 16, 12, 0, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(50, 70); g.lineTo(30, 130); g.moveTo(90, 70); g.lineTo(110, 130); g.stroke(); g.beginPath(); g.arc(70, 104, 4, 0, 7); g.moveTo(70, 108); g.lineTo(70, 122); g.moveTo(62, 112); g.lineTo(78, 112); g.moveTo(70, 122); g.lineTo(64, 130); g.moveTo(70, 122); g.lineTo(76, 130); g.stroke(); }, [30, 30, 30], { seed: 613 });
    spray(s, (g) => { g.font = 'bold 44px "DejaVu Sans", sans-serif'; g.save(); g.translate(128, 200); g.rotate(0.05); g.textAlign = 'center'; g.fillText('THEY LIE', 0, 0); g.restore(); }, [200, 26, 26], { seed: 614, drips: 10 });
    spray(s, (g) => { g.lineWidth = 3; g.beginPath(); g.arc(200, 70, 26, 0, 7); g.stroke(); g.font = 'bold 26px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('51', 200, 80); }, [236, 200, 40], { seed: 615, drips: 3 });
    spray(s, (g) => { g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(150, 130); g.bezierCurveTo(170, 100, 180, 150, 200, 120); g.bezierCurveTo(210, 100, 230, 140, 246, 118); g.stroke(); }, [40, 60, 200], { seed: 616 });
    s.grime([60, 56, 50], (u, v) => sstep(0.75, 1, v) * 0.4 + sstep(0.15, 0, v) * 0.3 + 0.05, { seed: 617, fx: 10, fy: 6 });
  }, { shadow: 4, amb: 0.5 });

  // ---------------------------------------------------------------- POSTERS: brick plastered with torn bills
  await T('POSTERS', 256, 256, (s) => {
    bricks(s, { seed: 621, col: [110, 60, 48] });
    const r = rng(622);
    const kinds = [
      (g, w, h) => { g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 20px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('MISSING', w / 2, 24); g.fillStyle = '#555'; g.fillRect(w / 2 - 22, 32, 44, 50); g.font = 'bold 9px "DejaVu Sans", sans-serif'; g.fillStyle = '#111'; g.fillText('LAST SEEN 11/3', w / 2, 96); g.fillText('ROUTE 29', w / 2, 108); },
      (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff4fa0'); gr.addColorStop(1, '#ffb030'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 22px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('LIVE!', w / 2, 30); g.font = 'bold 12px "DejaVu Sans", sans-serif'; g.fillText('THE GREYS', w / 2, 52); g.fillText('FRI • 9PM', w / 2, 70); g.fillText('9:30 CLUB', w / 2, 86); },
      (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e8e0'; g.font = 'bold 16px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('THE END', w / 2, 30); g.fillText('IS NEAR', w / 2, 50); g.fillStyle = '#c8261e'; g.beginPath(); g.arc(w / 2, 80, 14, 0, 7); g.fill(); },
      (g, w, h) => { g.fillStyle = '#f4f0e0'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a3a8a'; g.fillRect(0, 0, w, 24); g.fillStyle = '#fff'; g.font = 'bold 13px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('VOTE', w / 2, 17); g.fillStyle = '#b01818'; g.font = 'bold 18px "DejaVu Sans", sans-serif'; g.fillText('KEEP DC', w / 2, 50); g.fillText('SAFE', w / 2, 72); },
      (g, w, h) => { g.fillStyle = '#d8d020'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 14px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('CURFEW', w / 2, 22); g.font = 'bold 9px "DejaVu Sans", sans-serif'; g.fillText('BY ORDER OF THE', w / 2, 40); g.fillText('DISTRICT OF COLUMBIA', w / 2, 52); g.fillText('10PM - 6AM', w / 2, 70); },
    ];
    const spots = [[4, 8, 70, 100], [70, 20, 76, 110], [150, 4, 70, 96], [210, 60, 70, 100], [20, 120, 64, 96], [96, 136, 72, 100], [176, 150, 70, 100], [-30, 170, 60, 90]];
    spots.forEach(([x, y, w2, h2], k) => poster(s, x, y, w2, h2, kinds[k % kinds.length], { seed: 630 + k, torn: 0.6, fade: 0.15 + r() * 0.2 }));
    // scraps of older posters
    for (let k = 0; k < 6; k++) { const x = r() * 256, y = r() * 256; s.poly([[x, y], [x + 10 + r() * 20, y + r() * 6], [x + 8 + r() * 10, y + 12 + r() * 16], [x - 4, y + 10 + r() * 8]], { color: [210, 204, 186], alpha: 0.8, h: 0.6 }); }
    sootUp(s, 0.3, 623);
  }, { shadow: 5, amb: 0.45 });

  // ---------------------------------------------------------------- SW1CITY / SW2CITY: breaker box on brick (128 x 256)
  for (const on of [0, 1]) {
    await T(on ? 'SW2CITY' : 'SW1CITY', 128, 256, (s) => {
      bricks(s, { seed: 641 });
      const cx = 64, cy = 110;
      s.rect(cx - 30, cy - 44, cx + 30, cy + 44, { h: 9, bevel: 3, op: 'set', color: [110, 118, 104], r: 3, spec: 0.4 });
      s.rect(cx - 26, cy - 40, cx + 26, cy + 40, { h: 10, bevel: 1, op: 'set', color: [120, 128, 112], r: 2 });
      s.apply(textMask(s, 'DANGER', cx, cy - 26, { font: 'bold 10px "DejaVu Sans", sans-serif', align: 'center' }), { color: [200, 30, 20] });
      s.apply(textMask(s, '480 V', cx, cy - 15, { font: 'bold 9px "DejaVu Sans", sans-serif', align: 'center' }), { color: [30, 30, 30] });
      // throw lever on the side and a lamp
      s.rect(cx + 30, cy - 6, cx + 36, cy + 6, { h: 10, bevel: 2, color: [60, 60, 60] });
      const tip = on ? [cx + 44, cy + 26] : [cx + 44, cy - 26];
      s.seg(cx + 34, cy, tip[0], tip[1], 2.4, { h: 14, bevel: 2.4, prof: 'round', op: 'max', color: [160, 160, 160], spec: 0.9 });
      s.circle(tip[0], tip[1], 4.5, { h: 16, bevel: 4, prof: 'round', op: 'max', color: [200, 30, 20], spec: 0.9 });
      const lamp = on ? P.green : P.red;
      const lm = s.mask((g) => { g.beginPath(); g.arc(cx, cy + 16, 6, 0, 7); g.fill(); }, { wrap: false });
      s.circle(cx, cy + 16, 7, { h: 13, bevel: 4, prof: 'round', op: 'set', color: mix3(lamp, [255, 255, 255], 0.35), spec: 1 });
      s.apply(lm, { E: lamp, eAlpha: 0.9 }); s.glow(lm, lamp, 5, 0.5);
      for (const [bx, by] of [[cx - 24, cy - 38], [cx + 24, cy - 38], [cx - 24, cy + 38], [cx + 24, cy + 38]]) s.bolt(bx, by, 1.8, { h: 1.2, hex: true });
      s.streaks(P.rust, { amount: 0.4, fx: 8, seed: 642, len: 0.1, start: () => (cy + 44) / 256 });
      sootUp(s, 0.3, 643);
    }, { shadow: 10, specK: 1 });
  }
}

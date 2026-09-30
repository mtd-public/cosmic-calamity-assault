// MAP02 neon signs: bright saturated tubes with a soft halo on a dark wall.
// Signs are 256 x 128 (128 x 64 units); the LATE SHOW marquee is 512 x 256.
import { Surf, save, clamp, mix, sstep, fbm, rng, hash, textMask } from '../lib/env/tex.js';
import { hband, mix3, P } from '../lib/env/lab.js';
import { CP, bricks } from '../lib/env/city.js';
import { strokes, strokeWidth, neon } from '../lib/env/neon.js';

export default async function (F) {
  const T = async (name, w, h, paint, bake = {}) => { const s = new Surf(w, h); await paint(s); await save(F, 'textures', name, s.bake({ shadow: 6, ...bake })); };
  const darkBrick = (s, seed) => { bricks(s, { seed, col: [70, 48, 42], mortar: [60, 56, 52], vari: 0.25, burnt: 0.2 }); s.tint(() => 0.7); };
  const board = (s, x0, y0, x1, y1, col = [22, 20, 26]) => {
    s.rect(x0, y0, x1, y1, { h: 6, bevel: 2.5, op: 'set', color: col, r: 3, spec: 0.3 });
    s.rect(x0 + 4, y0 + 4, x1 - 4, y1 - 4, { h: 5, bevel: 1, op: 'set', color: mix3(col, [0, 0, 0], 0.3) });
    for (const [bx, by] of [[x0 + 6, y0 + 6], [x1 - 6, y0 + 6], [x0 + 6, y1 - 6], [x1 - 6, y1 - 6]]) s.bolt(bx, by, 1.6, { h: 1 });
    s.streaks(P.rust, { amount: 0.3, fx: 16, seed: x0 + y0, len: 0.15, start: () => y1 / s.h });
  };
  const PINK = [255, 60, 170], BLUE = [60, 150, 255], CYAN = [60, 240, 255], RED = [255, 40, 30], GREEN = [60, 255, 90], YEL = [255, 200, 40], ORNG = [255, 120, 30], PURP = [190, 80, 255];
  const unlit = (s, paths, w = 3) => s.apply(s.mask((g) => { g.lineCap = g.lineJoin = 'round'; g.lineWidth = w; for (const p of paths) { g.beginPath(); p.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } }, { wrap: false }), { color: [70, 66, 72], h: 1.5, spec: 0.8 });

  // BAR: a martini glass and "BAR"
  await T('NEONBAR', 256, 128, (s) => {
    darkBrick(s, 701);
    const glass = [[[20, 30], [70, 30], [45, 64], [20, 30]], [[45, 64], [45, 96]], [[30, 98], [60, 98]], [[40, 38], [60, 18]]];
    neon(s, glass, { color: CYAN, width: 3.2 });
    neon(s, [[[49, 40], [50, 40]]], { color: GREEN, width: 7 });
    neon(s, strokes('BAR', 88, 82, 46, { spacing: 1.8, wide: 1.1 }), { color: PINK, width: 4, halo: 11 });
    neon(s, strokes('COCKTAILS', 92, 110, 11, { spacing: 1.4 }), { color: BLUE, width: 2, halo: 6 });
  });

  // PAWN: three balls and "PAWN / LOANS"
  await T('NEONPAWN', 256, 128, (s) => {
    darkBrick(s, 711);
    board(s, 6, 8, 250, 120);
    neon(s, [[[26, 22], [66, 22]], [[36, 22], [34, 44]], [[56, 22], [58, 44]], [[46, 22], [46, 70]]], { color: YEL, width: 2.6 });
    for (const [cx, cy] of [[33, 54], [59, 54], [46, 80]]) neon(s, [Array.from({ length: 17 }, (_, k) => [cx + Math.cos(k / 16 * 6.283) * 10, cy + Math.sin(k / 16 * 6.283) * 10])], { color: YEL, width: 3 });
    neon(s, strokes('PAWN', 86, 72, 44, { spacing: 1.7 }), { color: ORNG, width: 4, halo: 11 });
    neon(s, strokes('LOANS', 100, 104, 16, { spacing: 1.6 }), { color: RED, width: 2.6 });
    neon(s, strokes('GOLD', 180, 104, 16, { spacing: 1.6 }), { color: YEL, width: 2.6 });
  });

  // LIQUOR / COLD BEER
  await T('NEONLIQ', 256, 128, (s) => {
    darkBrick(s, 721);
    neon(s, strokes('LIQUOR', 128, 66, 42, { align: 'center', spacing: 1.5, slant: 0.18 }), { color: RED, width: 4, halo: 12 });
    neon(s, [[[20, 78], [236, 78]]], { color: RED, width: 2.2 });
    neon(s, strokes('COLD BEER', 128, 108, 18, { align: 'center', spacing: 1.5 }), { color: GREEN, width: 2.8, halo: 8 });
  });

  // MOTEL with an arrow and (NO) VACANCY
  await T('NEONMOTL', 256, 128, (s) => {
    darkBrick(s, 731);
    board(s, 4, 6, 252, 122, [30, 24, 30]);
    const arrow = [[14, 30], [150, 30], [150, 16], [180, 44], [150, 72], [150, 58], [14, 58], [14, 30]];
    neon(s, [arrow], { color: YEL, width: 2.6, halo: 8 });
    neon(s, strokes('MOTEL', 22, 54, 20, { spacing: 1.8 }), { color: ORNG, width: 3, halo: 9 });
    unlit(s, strokes('NO', 22, 106, 16, { spacing: 1.5 }), 2.6);
    neon(s, strokes('VACANCY', 70, 106, 16, { spacing: 1.5 }), { color: GREEN, width: 2.6, halo: 8 });
    // chaser bulbs along the arrow's right edge
    for (let k = 0; k < 6; k++) { const x = 190 + k * 10, y = 44; const on = k % 2 === 0; s.circle(x, y, 3, { h: 3, bevel: 2, prof: 'round', color: on ? [255, 240, 190] : [90, 80, 60], E: on ? [255, 220, 150] : null, eAlpha: 0.9, spec: 0.8 }); }
  });

  // ARCADE: multicoloured letters and a pixel invader of our own
  await T('NEONARCD', 256, 128, (s) => {
    darkBrick(s, 741);
    board(s, 4, 6, 252, 122, [18, 14, 30]);
    const cols = [PINK, YEL, CYAN, GREEN, ORNG, PURP];
    'ARCADE'.split('').forEach((ch, k) => neon(s, strokes(ch, 78 + k * 27, 74, 38, { spacing: 1 }), { color: cols[k], width: 3.4, halo: 10 }));
    // pixel critter: drawn as tube outline blocks
    const px = [[0, 1, 1, 0, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1], [1, 0, 1, 1, 1, 1, 0, 1], [1, 1, 1, 1, 1, 1, 1, 1], [0, 1, 0, 1, 1, 0, 1, 0], [1, 0, 0, 0, 0, 0, 0, 1]];
    const m = s.mask((g) => { px.forEach((row, y) => row.forEach((on, x) => { if (on) g.fillRect(16 + x * 6, 40 + y * 6, 5, 5); })); }, { wrap: false });
    s.glow(m, GREEN, 8, 0.6); s.apply(m, { color: [40, 200, 70], E: [60, 230, 90], eAlpha: 0.7, h: 1.5 });
    neon(s, strokes('GAMES', 128, 108, 14, { align: 'center', spacing: 2 }), { color: CYAN, width: 2.2, halo: 6 });
  });

  // LATE SHOW marquee (512 x 256): neon title, chaser bulbs, a letter board
  await T('NEONSHOW', 512, 256, (s) => {
    darkBrick(s, 751);
    // the marquee box
    s.rect(8, 4, 504, 252, { h: 10, bevel: 4, op: 'set', color: [60, 20, 26], r: 6, spec: 0.5 });
    s.rect(20, 16, 492, 240, { h: 8, bevel: 2, op: 'set', color: [26, 12, 16] });
    // chaser bulbs around the frame
    const bulbs = [];
    for (let x = 22; x <= 490; x += 13) bulbs.push([x, 10], [x, 246]);
    for (let y = 23; y <= 234; y += 13) bulbs.push([14, y], [498, y]);
    bulbs.forEach(([x, y], k) => { const on = k % 3 !== 0; s.circle(x, y, 3.4, { h: 13, bevel: 2.5, prof: 'round', op: 'max', color: on ? [255, 244, 200] : [110, 90, 60], spec: 0.9 }); if (on) { const lm = s.mask((g) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }, { wrap: false }); s.apply(lm, { E: [255, 220, 150], eAlpha: 0.8 }); s.glow(lm, [255, 190, 90], 5, 0.35); } });
    // neon title
    neon(s, strokes('LATE SHOW', 256, 92, 56, { align: 'center', spacing: 1.6, slant: 0.15 }), { color: PINK, width: 4.6, halo: 14, glowK: 0.6 });
    neon(s, [[[60, 106], [452, 106]]], { color: [255, 60, 60], width: 2.5 });
    // back-lit letter board
    s.rect(52, 124, 460, 226, { h: 9, bevel: 2, op: 'set', color: [236, 232, 214] });
    s.each((u, v, x, y, i) => { if (x >= 52 && x < 460 && y >= 124 && y < 226) { s.addE(i, [220, 214, 190], 0.45); if ((y - 124) % 34 === 33) s.setC(i, [120, 116, 104]); } });
    const line = (t, y, col) => s.apply(textMask(s, t, 256, y, { font: 'bold 25px "DejaVu Sans", sans-serif', align: 'center', sx: 0.85, spacing: 3 }), { color: col, E: [-100, -96, -86] });
    line('ADULTS ONLY 18+', 152, [26, 22, 22]);
    line('MIDNIGHT DOUBLE BILL', 186, [150, 20, 24]);
    line('ALL NITE • $5', 220, [26, 22, 22]);
  });
}

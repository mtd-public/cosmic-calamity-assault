// Painted FX sprites (docs/ASSETS.md §3), rotation 0, sizes and anchors as in
// the stand-ins so actor scales stay valid. Glows are premultiplied (black
// edges add nothing under Add/Bright styles) with alpha from brightness.
import { Raster, ramp, FIRE_RAMP, fbm, vnoise, hash, clamp, sstep, lerp } from '../lib/wpn/paint.js';

const TAU = Math.PI * 2;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// A looping flame: tongues cut from a narrowing column by noise scrolling upward.
export function paintFire(S, t, seed = 17) {
  const R = new Raster(S, S);
  R.each((x, y) => {
    const u = x / S, v = y / S, h = 1 - v;
    const n = fbm(u * 3, (v + t) * 3, 3, 4, seed), n2 = fbm(u * 9 + 1.7, (v + t) * 5, 9, 4, seed + 5), n3 = fbm(u * 12, (v + t * 2) * 12, 12, 2, seed + 9);
    const sway = (n - 0.5) * 0.42 * h;
    const dx = Math.abs(u - 0.5 + sway);
    const w = 0.38 * Math.pow(1 - h, 0.6) + 0.02;
    const core = sstep(w, 0, dx);
    let heat = (core * (1.1 - 0.4 * h) - (1 - n2) * h * 1.25 - (1 - n3) * 0.14 + 0.1) * 0.88;
    heat *= sstep(0.0, 0.06, h) * sstep(1.0, 0.85, h);
    heat = clamp(heat);
    if (heat < 0.05) return null;
    const c = ramp(FIRE_RAMP, Math.pow(heat, 0.9));
    return [c[0], c[1], c[2], clamp(heat * 1.8)];
  });
  return R.img('bright', 1.4);
}
export default async function (F) {
  const put = (name, img, anchor = 'center') => F.emit(`sprites/fx/${name}.png`, img, [Math.round(img.w / 2), anchor === 'bottom' ? img.h - 2 : Math.round(img.h / 2)]);

  // ---------------------------------------------------------------- FIRE (A-H loop, base at the bottom)
  for (let i = 0; i < 8; i++) await put(`FIRE${'ABCDEFGH'[i]}0`, paintFire(64, i / 8), 'bottom');
  // ---------------------------------------------------------------- EXPL (A-H): flash → fireball → smoke
  for (let i = 0; i < 8; i++) {
    const S = 128, k = i / 7, R = new Raster(S, S);
    const rad = 0.16 + 0.3 * Math.sqrt(k);
    const fireAmt = 1 - sstep(0.3, 0.85, k), smokeAmt = sstep(0.25, 0.7, k) * (1 - sstep(0.85, 1.0, k) * 0.7);
    R.each((x, y) => {
      const u = x / S - 0.5, v = y / S - 0.5 + k * 0.06;
      const r = Math.hypot(u, v);
      // billowing edge from 2D noise (no angular streaks), rising with time
      const n = fbm(u * 3 + 5.3, v * 3 + 5.1 + k * 0.8, 8, 5, 41 + i);
      const n2 = fbm(u * 7 + 1.1, v * 7 + 2.3 + k * 1.5, 16, 3, 47 + i);
      const edge = rad * (0.72 + 0.55 * n);
      const inside = sstep(edge, edge * 0.72, r);
      if (inside <= 0.01) return null;
      const core = sstep(edge * 0.85, 0, r);
      const heat = clamp((core * 1.15 + (n2 - 0.5) * 0.5 + 0.38) * fireAmt + (k < 0.15 ? 0.6 : 0));
      const fire = ramp(FIRE_RAMP, heat);
      const sm = 36 + 50 * n2;
      const c = [lerp(sm, fire[0], clamp(heat * 1.3)), lerp(sm, fire[1], clamp(heat * 1.3)), lerp(sm * 1.02, fire[2], clamp(heat * 1.3))];
      const alpha = inside * clamp(heat * 1.5 + smokeAmt * (0.7 + 0.3 * n2));
      return [c[0], c[1], c[2], alpha];
    });
    const img = R.img('coverage');
    await put(`EXPL${'ABCDEFGH'[i]}0`, img);
  }
  // ---------------------------------------------------------------- SMOK (A-E): rising grey puffs
  for (let i = 0; i < 5; i++) {
    const S = 64, k = i / 4, R = new Raster(S, S);
    R.each((x, y) => {
      const u = x / S - 0.5, v = y / S - 0.5 + k * 0.08;
      const r = Math.hypot(u, v * 1.1);
      const n = fbm(u * 3 + 7, v * 3 + 7 + k, 8, 5, 55);
      const edge = (0.2 + 0.2 * k) * (0.7 + 0.6 * n);
      const a = sstep(edge, edge * 0.4, r) * (0.8 - 0.55 * k);
      if (a <= 0.01) return null;
      const g = 70 + 60 * n + 20 * (1 - r * 3);
      return [g, g, g * 1.04, a];
    });
    await put(`SMOK${'ABCDE'[i]}0`, R.img('coverage'));
  }
  // ---------------------------------------------------------------- PUFF (A-D): bullet puff (spark core + dust)
  for (let i = 0; i < 4; i++) {
    const S = 32, k = i / 3, R = new Raster(S, S);
    R.each((x, y) => {
      const u = x / S - 0.5, v = y / S - 0.5 + k * 0.05;
      const r = Math.hypot(u, v);
      const n = fbm(u * 4 + 3, v * 4 + 3, 8, 4, 61 + i);
      const edge = (0.14 + 0.24 * k) * (0.7 + 0.6 * n);
      const dust = sstep(edge, edge * 0.3, r) * (0.9 - 0.7 * k);
      const hot = i === 0 ? sstep(0.16, 0.0, r) : i === 1 ? sstep(0.08, 0.0, r) * 0.6 : 0;
      if (dust <= 0.01 && hot <= 0.01) return null;
      const g = 150 + 60 * n;
      return [lerp(g, 255, hot), lerp(g * 0.97, 235, hot), lerp(g * 0.9, 170, hot), clamp(dust + hot)];
    });
    await put(`PUFF${'ABCD'[i]}0`, R.img('coverage'));
  }
  // ---------------------------------------------------------------- SPRK (A-D): radial spark streaks
  {
    const rnd = rng(7), sparks = Array.from({ length: 14 }, () => ({ a: rnd() * TAU, s: 0.5 + rnd() * 0.6, w: 0.6 + rnd() * 0.8, drop: rnd() }));
    for (let i = 0; i < 4; i++) {
      const S = 32, k = (i + 1) / 4, R = new Raster(S, S);
      R.each((x, y) => {
        const u = x / S - 0.5, v = y / S - 0.5;
        let best = 0;
        for (const sp of sparks) {
          const L = 0.42 * sp.s * k, dirx = Math.cos(sp.a), diry = Math.sin(sp.a) + sp.drop * k * 0.6;
          const dl = Math.hypot(dirx, diry), dx = dirx / dl, dy = diry / dl;
          const along = u * dx + v * dy, perp = Math.abs(-u * dy + v * dx);
          const tail = L * 0.45;
          if (along < L - tail || along > L) continue;
          const t = (along - (L - tail)) / tail;
          best = Math.max(best, (0.35 + 0.65 * t) * sstep(0.055 * sp.w, 0, perp) * (1.2 - k * 0.5));
        }
        const core = i === 0 ? sstep(0.12, 0, Math.hypot(u, v)) : 0;
        const e = clamp(best + core);
        if (e < 0.03) return null;
        return [255, 200 + 55 * e, 110 + 120 * e, e];
      });
      await put(`SPRK${'ABCD'[i]}0`, R.img('bright', 1.6));
    }
  }
  // ---------------------------------------------------------------- blood / oil (A-C): droplet bursts
  const splat = async (name, base, glowy, seed) => {
    const rnd = rng(seed), drops = Array.from({ length: 16 }, () => ({ a: rnd() * TAU, d: 0.3 + rnd() * 0.7, r: 0.03 + rnd() * 0.05 }));
    for (let i = 0; i < 3; i++) {
      const S = 32, k = (i + 1) / 3, R = new Raster(S, S);
      R.each((x, y) => {
        const u = x / S - 0.5, v = y / S - 0.5;
        let cov = 0, spec = 0;
        // central mist in the first frame
        if (i === 0) cov = Math.max(cov, sstep(0.18, 0.05, Math.hypot(u, v)));
        for (const dp of drops) {
          const cx = Math.cos(dp.a) * dp.d * 0.38 * k, cy = Math.sin(dp.a) * dp.d * 0.38 * k + k * k * 0.1;
          const rr = dp.r * (1 - 0.35 * k);
          // droplet elongated along its motion
          const du = u - cx, dv = v - cy, al = (du * Math.cos(dp.a) + dv * Math.sin(dp.a)), pe = (-du * Math.sin(dp.a) + dv * Math.cos(dp.a));
          const q = Math.hypot(al / 1.6, pe) / rr;
          if (q < 1) { cov = Math.max(cov, sstep(1, 0.7, q)); spec = Math.max(spec, sstep(0.6, 0.0, Math.hypot(al / 1.6 + rr * 0.3, pe + rr * 0.3) / rr) * 0.6); }
        }
        if (cov < 0.02) return null;
        return [base[0] + (255 - base[0]) * spec * (glowy ? 0.5 : 0.35), base[1] + (255 - base[1]) * spec * (glowy ? 0.5 : 0.35), base[2] + (255 - base[2]) * spec * 0.35, cov];
      });
      await put(`${name}${'ABC'[i]}0`, R.img('coverage'));
    }
  };
  await splat('BLDG', [70, 245, 170], true, 11);
  await splat('BLDR', [150, 12, 10], false, 12);
  await splat('OILB', [14, 13, 16], false, 13);
  // ---------------------------------------------------------------- CASE / SHEL (A-D): spinning brass / red shell
  const spin = async (name, bodyCol, capCol, len, rad, capFrac) => {
    for (let i = 0; i < 4; i++) {
      const S = 16, R = new Raster(S, S), a = i * Math.PI / 4 + 0.3;
      const ca = Math.cos(a), sa = Math.sin(a), fore = 0.55 + 0.45 * Math.abs(Math.cos(i * 0.9));
      R.each((x, y) => {
        const u = x / S - 0.5, v = y / S - 0.5;
        const al = u * ca + v * sa, pe = -u * sa + v * ca;
        const hl = len * fore / 2;
        if (Math.abs(al) > hl || Math.abs(pe) > rad) return null;
        const shade = 0.65 + 0.35 * (1 - Math.abs(pe) / rad) - 0.25 * (pe / rad);
        const c = (al / hl) > 1 - capFrac * 2 ? capCol : bodyCol;
        return [c[0] * shade, c[1] * shade, c[2] * shade, 1];
      });
      await put(`${name}${'ABCD'[i]}0`, R.img('coverage'));
    }
  };
  await spin('CASE', [215, 170, 70], [190, 150, 60], 0.62, 0.13, 0.1);
  await spin('SHEL', [175, 30, 24], [205, 165, 70], 0.8, 0.2, 0.18);
  // ---------------------------------------------------------------- GLAS (A-D): tumbling shards
  {
    const rnd = rng(21), shards = Array.from({ length: 7 }, () => ({ x: rnd() - 0.5, y: rnd() - 0.5, s: 0.08 + rnd() * 0.12, a: rnd() * TAU, n: 3 + Math.floor(rnd() * 2) }));
    for (let i = 0; i < 4; i++) {
      const S = 32, R = new Raster(S, S), k = i / 3;
      R.each((x, y) => {
        const u = x / S - 0.5, v = y / S - 0.5;
        for (const sh of shards) {
          const cx = sh.x * (0.5 + 0.5 * k), cy = sh.y * (0.5 + 0.5 * k) + k * 0.12, rot = sh.a + i * 0.9;
          const du = (u - cx) / sh.s, dv = (v - cy) / sh.s;
          const ang = Math.atan2(dv, du) - rot, r = Math.hypot(du, dv);
          const lim = Math.cos(Math.PI / sh.n) / Math.cos((((ang % (TAU / sh.n)) + TAU / sh.n) % (TAU / sh.n)) - Math.PI / sh.n);
          if (r < lim * (0.7 + 0.3 * Math.cos(ang * 2 + rot))) {
            const glint = sstep(0.4, 0.0, Math.abs(du + dv * 0.4 - 0.1));
            return [180 + 75 * glint, 215 + 40 * glint, 235 + 20 * glint, 0.85];
          }
        }
        return null;
      });
      await put(`GLAS${'ABCD'[i]}0`, R.img('coverage'));
    }
  }
  // ---------------------------------------------------------------- energy balls: A-B fly, C-E hit
  const ball = async (name, S, inner, outer, seed, frames = 'ABCDE', flyN = 2) => {
    for (let i = 0; i < frames.length; i++) {
      const R = new Raster(S, S);
      const hit = i >= flyN, k = hit ? (i - flyN + 1) / (frames.length - flyN) : 0;
      R.each((x, y) => {
        const u = x / S - 0.5, v = y / S - 0.5, r = Math.hypot(u, v), a = Math.atan2(v, u);
        const n = fbm(Math.cos(a) * 1.5 + 4 + i * 0.7, Math.sin(a) * 1.5 + 4 + r * 5, 8, 4, seed + i);
        let e;
        if (!hit) {
          // plasma orb: hot core, soft halo with a flickering noise corona
          const core = sstep(0.13, 0.0, r);
          const corona = sstep(0.42, 0.12, r * (0.85 + 0.35 * n));
          const fil = Math.pow(Math.max(0, Math.sin(a * 4 + r * 18 + i * 2.5 + n * 4)), 6) * sstep(0.4, 0.15, r) * 0.5;
          e = clamp(core * 1.2 + corona * 0.65 + fil);
          if (e < 0.02) return null;
          const t = sstep(0.35, 1, e);
          return [lerp(outer[0], inner[0], t), lerp(outer[1], inner[1], t), lerp(outer[2], inner[2], t), e];
        }
        // hit: expanding ring + fading core + sparks
        const ringR = 0.1 + 0.3 * k, ring = sstep(0.08, 0.0, Math.abs(r - ringR)) * (1.2 - k * 0.8) * (0.6 + 0.6 * n);
        const core = sstep(0.3 * (1 - k * 0.8), 0, r) * (1.3 - k);
        const rays = Math.pow(Math.max(0, Math.cos(a * 5 + seed)), 8) * sstep(ringR + 0.12, 0, r) * (1.2 - k);
        e = clamp(ring + core + rays);
        if (e < 0.02) return null;
        return [lerp(outer[0], inner[0], sstep(0.4, 1, e)), lerp(outer[1], inner[1], sstep(0.4, 1, e)), lerp(outer[2], inner[2], sstep(0.4, 1, e)), e];
      });
      await put(`${name}${frames[i]}0`, R.img('bright', 1.5));
    }
  };
  await ball('PBLT', 48, [240, 245, 255], [110, 150, 255], 71);   // Grey psychic bolt: white-blue
  await ball('HPLS', 48, [220, 255, 245], [40, 220, 190], 72);    // Hybrid plasma: teal
  await ball('PPLS', 48, [255, 225, 255], [230, 70, 200], 73);    // Probe pulse: magenta
  await ball('APLS', 48, [225, 255, 255], [60, 230, 255], 74);    // player alien plasma: cyan
  await ball('ASTB', 48, [255, 230, 255], [170, 90, 255], 75);    // Stinger bolt: violet
  await ball('ASCP', 24, [245, 220, 255], [150, 80, 255], 76, 'ABC', 1); // Scatter pellet
  // ---------------------------------------------------------------- SNGB (A-B fly, C-H implode/burst)
  for (let i = 0; i < 8; i++) {
    const S = 96, R = new Raster(S, S);
    R.each((x, y) => {
      const u = x / S - 0.5, v = y / S - 0.5, r = Math.hypot(u, v), a = Math.atan2(v, u);
      let k = i < 2 ? 0 : (i - 1) / 6;
      const coreR = i < 2 ? 0.14 : i < 5 ? 0.14 * (1 - (i - 2) / 3 * 0.7) : 0.04;
      const swirl = fbm(Math.cos(a - r * 8 + i) * 2 + 5, Math.sin(a - r * 8 + i) * 2 + 5, 8, 4, 91);
      const disk = sstep(0.42, coreR, r) * (0.4 + 0.6 * swirl) * (i < 5 ? 1 : 1 - (i - 5) / 3);
      const rim = sstep(0.025, 0.0, Math.abs(r - coreR - 0.015));
      const burst = i >= 5 ? sstep(0.09, 0, Math.abs(r - 0.1 - (i - 5) * 0.13)) * (1 - (i - 5) / 3) : 0;
      if (r < coreR) return [8, 0, 18, 1]; // the black core (opaque dark: reads under Normal/Translucent styles)
      const e = clamp(disk * 0.9 + rim + burst);
      if (e < 0.02) return null;
      return [lerp(90, 230, e), lerp(30, 180, e * e), 255, e];
    });
    await put(`SNGB${'ABCDEFGH'[i]}0`, R.img('bright', 1.4));
  }
  // ---------------------------------------------------------------- TELF (A-F): alien warp-in column
  for (let i = 0; i < 6; i++) {
    const S = 96, k = i / 5, R = new Raster(S, S), open = Math.sin(k * Math.PI);
    R.each((x, y) => {
      const u = x / S - 0.5, v = y / S - 0.5;
      const n = fbm(u * 3 + 2, v * 2 + k * 2, 8, 4, 101);
      const col = sstep(0.16 * open + 0.02, 0.0, Math.abs(u) * (1 + 0.6 * (n - 0.5))) * sstep(0.5, 0.3, Math.abs(v));
      const ring = sstep(0.03, 0, Math.abs(Math.hypot(u, v * 2.2) - 0.18 - 0.22 * k)) * (1 - k) * 0.9;
      const motes = sstep(0.93, 1.0, vnoise(u * 40 + 3, v * 40 - k * 20, 40, 103)) * 1.2 * open * sstep(0.4, 0.1, Math.abs(u));
      const e = clamp(col * (0.6 + 0.6 * n) + ring + motes);
      if (e < 0.02) return null;
      return [lerp(40, 230, e * e), 255, lerp(170, 240, e), e];
    });
    await put(`TELF${'ABCDEF'[i]}0`, R.img('bright', 1.4));
  }
}

// Skies (2048 x 512, wrap horizontally, horizon 40% up from the bottom).
import { save, clamp, mix, sstep, fbm, vn, ridged, rng, hash, fract, mod } from '../lib/env/tex.js';
import { Sky, n1 } from '../lib/env/sky.js';

export default async function (F) {
  const HZ = 0.6; // horizon (fraction from the top)
  const du = (u, c) => mod(u - c + 0.5, 1) - 0.5;

  // ------------------------------------------------------------ SKYA51: desert night over Groom Lake
  {
    const s = new Sky();
    s.gradient([[0, [3, 5, 14]], [0.3, [8, 12, 30]], [0.52, [22, 28, 50]], [HZ, [44, 44, 60]], [HZ + 0.02, [18, 18, 24]], [1, [7, 7, 9]]]);
    // milky way + stars
    const band = (u) => 0.2 + 0.13 * Math.sin(u * Math.PI * 2 + 0.6);
    s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      const d = Math.abs(v - band(u)) / 0.09;
      if (d < 3) { const n = fbm(u, v, 24, 6, 5, 11), dust = fbm(u, v, 48, 12, 3, 12); s.add(i, [36, 40, 58], Math.exp(-d * d) * clamp(n * 1.5 - 0.35) * (1 - clamp((dust - 0.55) * 4) * 0.8)); }
    });
    s.stars(4200, 101, () => HZ - 0.02, { milky: band });
    // fires on the base: horizon glow + smoke columns
    const fires = [[0.31, 1], [0.345, 0.6], [0.74, 0.7]];
    for (const [fu, k] of fires) { s.glow(fu, HZ - 0.01, 0.05, 0.06, [255, 110, 40], 0.75 * k); s.glow(fu, HZ, 0.012, 0.015, [255, 190, 90], 0.9 * k); }
    s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      for (const [fu, k] of fires) {
        const up = (HZ - v) / 0.5; if (up < 0) continue;
        const drift = up * up * 0.06;
        const d = Math.abs(du(u, fu + drift)) / (0.008 + up * 0.045);
        if (d > 1.6) continue;
        const n = fbm(u * 1 + up * 0.2, v, 128, 32, 4, 21 + fu * 100);
        const a = clamp((1 - d) * 1.3 + (n - 0.5) * 1.3) * (1 - up) * 0.95 * k;
        if (a <= 0) continue;
        const lit = clamp(1 - up * 3);
        s.set(i, [mix(22, 150, lit), mix(18, 60, lit), mix(20, 26, lit)], a);
      }
    });
    // searchlights sweeping from the base
    for (const [bu, ang, wd] of [[0.3, -0.45, 0.006], [0.33, 0.35, 0.005]]) s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      const up = (HZ - v) * 512, off = du(u, bu) * 2048 - up * Math.tan(ang);
      const width = 2 + up * wd * 4;
      const a = Math.exp(-(off * off) / (width * width)) * 0.16 * (1 - up / 320);
      if (a > 0) s.add(i, [180, 200, 230], a);
    });
    // far range: bluish peaks with a faint moonlit rim; near hills black
    const far = (u) => HZ - 0.015 - 0.16 * Math.pow(ridged(u, 0.4, 6, 1, 5, 31), 3.0) - 0.02 * n1(u, 23, 3, 32);
    s.ridge(far, (u, v, d) => (d < 0.004 ? [40, 46, 66] : [mix(20, 14, clamp(d * 12)), mix(24, 16, clamp(d * 12)), mix(38, 24, clamp(d * 12))]));
    const near = (u) => HZ - 0.004 - 0.028 * n1(u, 13, 4, 33) - 0.012 * n1(u, 41, 2, 34);
    s.ridge(near, () => [9, 9, 12]);
    // distant base lights and a runway
    const r = rng(41);
    const dot = (x, y, col, k = 1) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = mod(Math.round(x) + dx, 2048), Y = Math.round(y) + dy; s.add(Y * 2048 + X, col, (dx || dy ? 0.25 : 1) * k); } };
    for (let k = 0; k < 70; k++) dot((0.27 + r() * 0.1) * 2048, HZ * 512 + 2 + r() * 8, r() < 0.7 ? [255, 190, 110] : [255, 250, 230], 0.6 + r() * 0.4);
    for (let k = 0; k < 40; k++) dot((0.4 + k * 0.004) * 2048, HZ * 512 + 9 + k * 0.08, [90, 140, 255], 0.7);
    // the hovering craft
    s.art((g) => {
      const cx = 0.555 * 2048, cy = 0.33 * 512;
      g.translate(cx, cy); g.scale(1.35, 1.35); g.translate(-cx, -cy);
      const beam = g.createLinearGradient(0, cy, 0, HZ * 512);
      beam.addColorStop(0, 'rgba(170,220,255,0.22)'); beam.addColorStop(1, 'rgba(170,220,255,0.02)');
      g.fillStyle = beam; g.beginPath(); g.moveTo(cx - 8, cy + 4); g.lineTo(cx + 8, cy + 4); g.lineTo(cx + 30, cy + (HZ * 512 - 8 - cy) / 1.35); g.lineTo(cx - 30, cy + (HZ * 512 - 8 - cy) / 1.35); g.fill();
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, 70); halo.addColorStop(0, 'rgba(120,160,220,0.25)'); halo.addColorStop(1, 'rgba(120,160,220,0)');
      g.fillStyle = halo; g.fillRect(cx - 80, cy - 80, 160, 160);
      g.fillStyle = '#0c0e14'; g.beginPath(); g.ellipse(cx, cy, 44, 8, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx, cy - 5, 16, 8, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#1a2030'; g.beginPath(); g.ellipse(cx, cy - 1, 40, 4, 0, Math.PI, 0); g.fill();
      for (let k = -5; k <= 5; k++) { const x = cx + k * 7.5, y = cy + 2 + Math.abs(k) * -0.2; g.fillStyle = k % 3 === 0 ? '#ff5040' : k % 2 ? '#fff4d0' : '#ffb040'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(200,240,255,0.9)'; g.beginPath(); g.ellipse(cx, cy + 6, 9, 2.5, 0, 0, 7); g.fill();
    });
    await save(F, 'textures', 'SKYA51', s.toImage());
  }

  // ------------------------------------------------------------ SKYCITY: burning D.C. under the mothership
  {
    const s = new Sky();
    s.gradient([[0, [16, 9, 16]], [0.3, [40, 20, 24]], [0.5, [98, 44, 26]], [HZ, [176, 86, 34]], [HZ + 0.03, [40, 22, 16]], [1, [14, 10, 10]]]);
    // smoke overcast lit from below
    s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      const n = fbm(u + v * 0.1, v, 12, 5, 5, 51), n2 = fbm(u, v, 40, 14, 3, 52);
      const dens = clamp((n - 0.42) * 2.4 + (n2 - 0.5) * 0.4);
      const low = sstep(0.2, HZ, v);
      s.set(i, [mix(26, 120, low * (1 - dens * 0.5)), mix(16, 50, low * (1 - dens * 0.5)), mix(20, 26, low)], dens * 0.75);
    });
    // the mothership: an immense disc whose underside fills the zenith
    const edge = (u) => 0.36 - 0.5 * Math.pow(du(u, 0.5) / 0.32, 2);
    s.each((u, v, x, y, i) => {
      const e = edge(u); if (v > e + 0.01) return;
      const dd = du(u, 0.5), a = clamp((e + 0.004 - v) / 0.008);
      // underside: plated rings in a flattened polar frame, greebled, lit from below by the fires
      const px = dd * 2048, py = (0.36 - v) * 512 * 3.2 + 40;
      const rr = Math.hypot(px, py), th = Math.atan2(px, py);
      const ringI = Math.floor(rr / 58), fr = fract(rr / 58);
      const seg = Math.floor((th + 4) * (10 + ringI * 3)), plate = hash(ringI, seg, 55);
      const groove = fr < 0.05 || fr > 0.97 ? 0.45 : 1;
      const segEdge = Math.abs(fract((th + 4) * (10 + ringI * 3)) - 0.5) > 0.47 ? 0.6 : 1;
      const n = fbm(u, v, 96, 24, 3, 53), g2 = hash(Math.floor(px / 4), Math.floor(py / 4), 56);
      const k = (0.55 + plate * 0.35 + n * 0.3 + (g2 < 0.08 ? -0.15 : 0)) * groove * segEdge;
      let c = [28 * k, 26 * k, 34 * k];
      const under = clamp(1 - (e - v) / 0.1);
      c = [c[0] + under * 70 * k, c[1] + under * 28 * k, c[2] + under * 10 * k];
      s.set(i, c, a);
      // sparse light clusters along some ring grooves, and a few big glowing ports
      if (a > 0.9 && (fr < 0.07 || fr > 0.95) && hash(ringI, Math.floor((th + 4) * 90), 54) < 0.18) s.add(i, [255, 176, 96], 0.8);
      if (a > 0.9 && hash(ringI, seg, 57) < 0.06 && fr > 0.35 && fr < 0.65 && Math.abs(fract((th + 4) * (10 + ringI * 3)) - 0.5) < 0.12) s.add(i, [120, 200, 255], 0.5);
      if (Math.abs(e - v) < 0.004) s.add(i, [255, 90, 40], 0.7 * (0.5 + 0.5 * Math.sin(u * 900)));
    });
    // the central emitter and the beam
    s.each((u, v, x, y, i) => {
      const dx = du(u, 0.5) * 2048;
      if (v > 0.33 && v < HZ + 0.01) { const w0 = 10 + (v - 0.33) * 60; const a = Math.exp(-(dx * dx) / (w0 * w0)); s.add(i, [150, 210, 255], a * 1.1); s.add(i, [255, 255, 255], Math.exp(-(dx * dx) / (w0 * w0 * 0.12)) * 0.8); }
      const dy = (v - 0.34) * 512, d2 = (dx * dx) / 1600 + (dy * dy) / 400; if (d2 < 9) s.add(i, [170, 225, 255], Math.exp(-d2) * 1.2);
    });
    s.glow(0.5, HZ, 0.03, 0.04, [160, 210, 255], 0.9);
    // skyline
    const r = rng(61);
    const bl = []; let u = 0;
    while (u < 1) { const wd = (8 + r() * 34) / 2048, ht = 0.02 + Math.pow(r(), 1.6) * 0.16; bl.push([u, u + wd, ht, r(), r() < 0.12]); u += wd + (r() < 0.2 ? r() * 6 / 2048 : 0); }
    bl[bl.length - 1][1] = 1;
    const top = new Float32Array(2048).fill(HZ), bid = new Int32Array(2048).fill(-1);
    bl.forEach(([u0, u1, ht, seed, burn], k) => { for (let x = Math.floor(u0 * 2048); x < Math.min(2048, Math.ceil(u1 * 2048)); x++) { const t = HZ - ht; if (t < top[x]) { top[x] = t; bid[x] = k; } } });
    // landmarks: an obelisk and a domed capitol (public-domain silhouettes)
    const obel = 0.18, dome = 0.83;
    for (let x = 0; x < 2048; x++) {
      const dxo = Math.abs(du(x / 2048, obel)) * 2048;
      if (dxo < 9) { const t = HZ - 0.33 + Math.max(0, (dxo - 6) * 0.01) + (dxo > 6 ? 0 : 0); const tt = dxo < 6 ? HZ - 0.3 - (6 - dxo) * 0.004 : HZ - 0.3 + (dxo - 6) * 0.02; if (tt < top[x]) { top[x] = Math.min(tt, HZ - 0.02); bid[x] = -2; } }
      const dxd = du(x / 2048, dome) * 2048;
      if (Math.abs(dxd) < 90) { let t = HZ - 0.07; if (Math.abs(dxd) < 34) t = HZ - 0.12 - Math.sqrt(Math.max(0, 34 * 34 - dxd * dxd)) / 512 * 1.6; if (Math.abs(dxd) < 3) t = HZ - 0.23; if (t < top[x]) { top[x] = t; bid[x] = -3; } }
    }
    s.each((u2, v, x, y, i) => {
      if (v < top[x]) return;
      const k = bid[x];
      let c = [14, 10, 12];
      if (k >= 0) {
        const [u0, , ht, seed, burn] = bl[k];
        const wx = x - Math.floor(u0 * 2048), wy = y - Math.floor(top[x] * 512);
        if (wx % 4 > 0 && wx % 4 < 3 && wy % 5 > 1 && wy % 5 < 4 && wy > 3 && hash(Math.floor(wx / 4), Math.floor(wy / 5), k) < 0.22) c = hash(k, wy, 3) < 0.7 ? [220, 170, 90] : [150, 180, 210];
        if (burn && wy < 26 && wx % 4 > 0 && wx % 4 < 3 && wy % 5 > 1 && wy % 5 < 4) c = hash(x, y, 5) < 0.6 ? [255, 170, 60] : [255, 110, 30];
      }
      if (v > HZ) c = [mix(40, 12, clamp((v - HZ) / 0.2)), mix(20, 9, clamp((v - HZ) / 0.2)), mix(14, 9, clamp((v - HZ) / 0.2))];
      s.set(i, c);
    });
    // red aircraft-warning lights on the obelisk and fires with smoke over burning blocks
    const dotc = (x, y, col, k) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = mod(Math.round(x) + dx, 2048), Y = Math.round(y) + dy; s.add(Y * 2048 + X, col, Math.exp(-(dx * dx + dy * dy) / 1.5) * k); } };
    dotc(obel * 2048 - 3, (HZ - 0.31) * 512, [255, 40, 30], 1); dotc(obel * 2048 + 3, (HZ - 0.31) * 512, [255, 40, 30], 1);
    const burning = bl.filter((b) => b[4]);
    s.each((u2, v, x, y, i) => {
      if (v > HZ - 0.02) return;
      for (const [u0, u1, ht] of burning) {
        const base = HZ - ht; if (v > base) continue;
        const up = (base - v) / base, cu = (u0 + u1) / 2 + up * up * 0.05;
        const d = Math.abs(du(u2, cu)) / ((u1 - u0) * 0.5 + up * 0.05);
        if (d > 1.8) continue;
        const n = fbm(u2, v, 64, 20, 4, 58 + Math.round(u0 * 999));
        const a = clamp((1 - d) * 1.2 + (n - 0.5) * 1.4) * (1 - up) * 0.9;
        const lit = clamp(1 - up * 5);
        if (a > 0) s.set(i, [mix(24, 170, lit), mix(16, 70, lit), mix(16, 28, lit)], a);
      }
    });
    s.art((g) => {
      g.globalCompositeOperation = 'lighter';
      const fr = rng(62);
      for (const [u0, u1, ht] of burning) {
        const x0 = u0 * 2048, x1 = u1 * 2048, y0 = (HZ - ht) * 512 + 1;
        for (let k = 0; k < 6; k++) {
          const x = x0 + fr() * (x1 - x0), hgt = 8 + fr() * 16, wd = 3 + fr() * 5;
          const gr = g.createLinearGradient(0, y0, 0, y0 - hgt);
          gr.addColorStop(0, 'rgba(255,230,140,0.95)'); gr.addColorStop(0.4, 'rgba(255,130,30,0.8)'); gr.addColorStop(1, 'rgba(200,40,10,0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x - wd, y0); g.quadraticCurveTo(x - wd * 0.6, y0 - hgt * 0.6, x + (fr() - 0.5) * 4, y0 - hgt); g.quadraticCurveTo(x + wd * 0.6, y0 - hgt * 0.5, x + wd, y0); g.fill();
        }
        const glow = g.createRadialGradient((x0 + x1) / 2, y0, 0, (x0 + x1) / 2, y0, 40); glow.addColorStop(0, 'rgba(255,120,40,0.45)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = glow; g.fillRect(x0 - 50, y0 - 50, x1 - x0 + 100, 100);
      }
    }, { mode: 'add' });
    // searchlights
    for (const [bu, ang] of [[0.1, 0.25], [0.28, -0.3], [0.64, 0.4], [0.92, -0.15]]) s.each((u2, v, x, y, i) => {
      if (v > HZ - 0.02) return;
      const up = (HZ - v) * 512, off = du(u2, bu) * 2048 - up * Math.tan(ang), width = 2 + up * 0.03;
      s.add(i, [220, 210, 190], Math.exp(-(off * off) / (width * width)) * 0.12 * (1 - up / 300));
    });
    await save(F, 'textures', 'SKYCITY', s.toImage());
  }

  // ------------------------------------------------------------ SKYFRST: forest night, smoke and firelight behind the treeline
  {
    const s = new Sky();
    s.gradient([[0, [4, 6, 16]], [0.35, [10, 14, 30]], [0.54, [26, 26, 42]], [HZ, [52, 38, 42]], [HZ + 0.02, [10, 12, 12]], [1, [5, 6, 6]]]);
    s.stars(3000, 71, () => HZ - 0.05);
    s.glow(0.42, HZ, 0.09, 0.12, [255, 120, 40], 0.8); s.glow(0.42, HZ, 0.03, 0.04, [255, 170, 80], 0.8);
    s.glow(0.44, HZ - 0.02, 0.03, 0.05, [170, 90, 255], 0.35);
    s.glow(0.12, HZ, 0.04, 0.06, [200, 220, 255], 0.3);
    // smoke drifting from the crash
    s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      const up = (HZ - v) / HZ;
      const cu = 0.42 + up * up * 0.18;
      const d = Math.abs(du(u, cu)) / (0.03 + up * 0.2);
      const n = fbm(u, v, 24, 10, 5, 81);
      const a = clamp((1.1 - d) * 1.3 + (n - 0.5) * 1.8) * (1 - up * 0.5) * 0.9;
      const lit = clamp(1 - up * 2.5);
      if (a > 0) s.set(i, [mix(44, 170, lit), mix(40, 80, lit), mix(52, 50, lit)], a * 0.9);
      // thin haze layers
      const hz2 = fbm(u, v, 8, 20, 4, 82);
      s.set(i, [30, 30, 40], clamp((hz2 - 0.55) * 2) * 0.3 * sstep(0.3, HZ, v));
    });
    // pine treeline
    const r = rng(91), trees = [];
    for (let k = 0; k < 260; k++) trees.push([r(), (0.05 + r() * 0.1) * (0.8 + 0.4 * n1(k / 260, 5, 2, 92)), 0.004 + r() * 0.004, r()]);
    const cols = Array.from({ length: 2048 }, () => []);
    trees.forEach((t, k) => { const [tu, , tw] = t; const x0 = Math.floor((tu - tw * 1.2) * 2048), x1 = Math.ceil((tu + tw * 1.2) * 2048); for (let x = x0; x <= x1; x++) cols[mod(x, 2048)].push(k); });
    s.each((u, v, x, y, i) => {
      if (v > HZ + 0.02) { s.set(i, [6, 7, 7]); return; }
      const hb = HZ - v; // height above the horizon
      for (const k of cols[x]) {
        const [tu, th, tw, sd] = trees[k];
        if (hb > th) continue;
        const sN = hb / th;                                     // 0 at the base, 1 at the tip
        const tier = 0.72 + 0.28 * fract(sN * (5 + sd * 3) + sd); // drooping branch tiers
        const halfw = tw * (1 - sN) * tier + 0.0006;
        if (Math.abs(du(u, tu)) < halfw) { const rim = Math.abs(du(u, 0.42)) < 0.12 && sN > 0.2 ? 6 : 0; s.set(i, [8 + rim, 10 + rim * 0.4, 10]); return; }
      }
      if (v > HZ - 0.012) s.set(i, [8, 10, 10]);
    });
    await save(F, 'textures', 'SKYFRST', s.toImage());
  }

  // ------------------------------------------------------------ SKYSPACE: stars and Earth's limb
  {
    const s = new Sky();
    s.gradient([[0, [2, 2, 6]], [1, [2, 2, 6]]]);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 3, 5, 111), m = fbm(u, v, 10, 5, 4, 112);
      s.add(i, [60, 24, 90], clamp(n - 0.5) * 0.9); s.add(i, [20, 70, 90], clamp(m - 0.55) * 0.8);
    });
    const band = (u) => 0.3 + 0.18 * Math.sin(u * Math.PI * 2 + 2);
    s.each((u, v, x, y, i) => { const d = Math.abs(v - band(u)) / 0.1; if (d < 3) s.add(i, [34, 34, 48], Math.exp(-d * d) * fbm(u, v, 32, 8, 4, 113) * 1.2); });
    s.stars(7000, 121, () => 1, { milky: band, bright: 1.2 });
    // Earth: a limb that rises toward u = 0.5, day side in the middle, night lights at the edges
    const limb = (u) => 0.5 + 0.2 * Math.pow(Math.abs(du(u, 0.5)) * 2, 1.6);
    const sunU = 0.58;
    s.each((u, v, x, y, i) => {
      const L = limb(u), d = v - L;
      if (d < 0) { const a = Math.exp(d * 512 / 7); s.add(i, [80, 150, 255], a * 0.9); s.add(i, [180, 220, 255], Math.exp(d * 512 / 2) * 0.6); return; }
      const lat = d * 6;
      const day = clamp(1 - Math.abs(du(u, sunU)) * 3.2);
      const cont = fbm(u + lat * 0.05, v, 8, 6, 5, 131), cloud = fbm(u * 1 + lat * 0.2, v * 1, 14, 10, 5, 132), swirl = fbm(u, v, 30, 20, 3, 133);
      let c = cont > 0.55 ? [70 + (cont - 0.55) * 200, 82 + (cont - 0.55) * 100, 44] : [16, 44, 104];
      const cl = clamp((cloud - 0.48) * 3 + (swirl - 0.5) * 0.6);
      c = [mix(c[0], 240, cl), mix(c[1], 244, cl), mix(c[2], 250, cl)];
      const shade = day * (0.35 + 0.65 * clamp(d * 12)) ;
      c = [c[0] * shade, c[1] * shade, c[2] * shade];
      // night-side city lights
      if (day < 0.3 && cont > 0.55 && hash(x, y, 134) < 0.05 * (1 - day * 3)) c = [255, 190, 110];
      // limb haze
      const haze = Math.exp(-d * 512 / 10) * (0.3 + day * 0.7);
      c = [c[0] + 70 * haze, c[1] + 130 * haze, c[2] + 220 * haze];
      s.set(i, c);
    });
    // the sun just over the limb
    s.glow(sunU + 0.06, limb(sunU + 0.06) - 0.02, 0.02, 0.05, [255, 240, 210], 1.4);
    s.glow(sunU + 0.06, limb(sunU + 0.06) - 0.02, 0.1, 0.02, [255, 220, 180], 0.5);
    await save(F, 'textures', 'SKYSPACE', s.toImage());
  }
}

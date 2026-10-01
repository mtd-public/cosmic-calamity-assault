// Skies for MAP02 (SKYMESA, New Mexico night over the Dulce mesas) and MAP04
// (SKYCHI, the Loop burning: Sears Tower, the Hancock, Marina City, saucers over
// Lake Michigan). 2048 x 512, wrap horizontally, horizon 40% up from the bottom.
import { save, clamp, mix, sstep, fbm, vn, ridged, rng, hash, fract, mod } from '../lib/env/tex.js';
import { Sky, n1 } from '../lib/env/sky.js';

const W = 2048, HH = 512, HZ = 0.6, HY = HZ * HH;
const du = (u, c) => mod(u - c + 0.5, 1) - 0.5;

export default async function (F, params = {}) {
  const only = params.only ? params.only.split(',') : null;
  const want = (n) => !only || only.includes(n);

  // ============================================================ SKYMESA
  if (want('SKYMESA')) {
    const s = new Sky();
    const moonU = 0.71, moonV = 0.47;
    s.gradient([[0, [3, 5, 16]], [0.25, [7, 11, 30]], [0.48, [18, 24, 50]], [HZ - 0.01, [44, 46, 70]], [HZ + 0.01, [16, 15, 20]], [1, [8, 7, 9]]]);
    // moon-side brightening and a warm afterglow band on the horizon
    s.glow(moonU, HZ - 0.02, 0.16, 0.2, [40, 44, 70], 0.8);
    s.glow(moonU, HZ, 0.3, 0.04, [60, 40, 36], 0.6);
    // the Milky Way: a tilted arch with dust lanes and a brighter core
    const band = (u) => 0.26 + 0.17 * Math.sin(u * Math.PI * 2 + 2.4);
    s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      const d = (v - band(u)) / 0.075, ad = Math.abs(d);
      if (ad > 3.2) return;
      const n = fbm(u, v, 28, 7, 5, 11), dust = fbm(u, v, 56, 14, 4, 12), core = Math.exp(-Math.pow(du(u, 0.2) / 0.08, 2));
      const lane = clamp((dust - 0.5) * 3) * Math.exp(-Math.pow(d + 0.15, 2) * 3);
      const k = Math.exp(-d * d * 0.8) * clamp(n * 1.6 - 0.3) * (1 - lane * 0.85) * (0.8 + core * 0.8);
      s.add(i, [52, 54, 76], k);
      s.add(i, [60, 50, 40], k * core * 0.6);
    });
    s.stars(5200, 2301, () => HZ - 0.015, { milky: band, bright: 1.05 });
    s.stars(1400, 2302, () => HZ - 0.015, { bright: 0.5 });
    // the low moon: big, warm from the thick air near the horizon, with maria and a halo
    s.glow(moonU, moonV, 0.05, 0.14, [120, 100, 80], 0.5);
    s.glow(moonU, moonV, 0.015, 0.05, [200, 170, 120], 0.6);
    s.each((u, v, x, y, i) => {
      const dx = du(u, moonU) * W, dy = (v - moonV) * HH, r = Math.hypot(dx, dy), R = 21;
      if (r > R + 1) return;
      const a = clamp(R + 0.5 - r);
      const mar = fbm(dx / 60 + 0.5, dy / 60 + 0.5, 3, 3, 4, 2303), cr = fbm(dx / 20 + 0.5, dy / 20 + 0.5, 6, 6, 3, 2304);
      let k = 0.92 - clamp((mar - 0.5) * 2.4) * 0.28 - (cr > 0.66 ? 0.06 : 0);
      k *= 0.82 + 0.18 * Math.sqrt(clamp(1 - (r / R) ** 2));
      s.set(i, [255 * k, 222 * k, 172 * k], a);
    });
    // far mesas and buttes (blue-grey, moonlit tops), then the near mesas (black, rim-lit toward the moon)
    const mesaProfile = (list, base) => (u) => {
      let t = 0;
      for (const m of list) {
        const d = Math.abs(du(u, m.u));
        let hgt = 0;
        if (d < m.w) hgt = m.h * (1 - 0.04 * n1(u, 60, 2, m.s));
        else if (d < m.w + m.c) hgt = m.h * mix(1, 0.42, Math.pow((d - m.w) / m.c, 0.8));
        else if (d < m.w + m.c + m.t) { const q = (d - m.w - m.c) / m.t; hgt = m.h * 0.42 * Math.pow(1 - q, 1.6); }
        // a stepped ledge partway down the cliff
        t = Math.max(t, hgt);
      }
      return base - t - 0.006 * n1(u, 40, 3, 7);
    };
    const r = rng(2305);
    const far = [], near = [];
    for (let k = 0; k < 10; k++) far.push({ u: r(), w: 0.01 + r() * 0.05, h: 0.05 + r() * 0.07, c: 0.003 + r() * 0.004, t: 0.02 + r() * 0.03, s: 2310 + k });
    for (const m of [{ u: 0.06, w: 0.055, h: 0.17 }, { u: 0.36, w: 0.03, h: 0.13 }, { u: 0.455, w: 0.006, h: 0.16 }, { u: 0.87, w: 0.08, h: 0.14 }, { u: 0.6, w: 0.018, h: 0.09 }, { u: 0.2, w: 0.012, h: 0.07 }])
      near.push({ ...m, c: 0.004, t: 0.035 + r() * 0.02, s: 2320 + near.length });
    const farTop = mesaProfile(far, HZ - 0.004), nearTop = mesaProfile(near, HZ + 0.002);
    s.ridge(farTop, (u, v, d) => {
      const lit = Math.max(0, 1 - Math.abs(du(u, moonU)) * 2.2);
      return d < 0.003 ? [52 + lit * 40, 52 + lit * 30, 70 + lit * 14] : [mix(30, 18, clamp(d * 14)) + lit * 10, mix(28, 16, clamp(d * 14)) + lit * 6, mix(40, 24, clamp(d * 14))];
    });
    s.ridge(nearTop, (u, v, d) => {
      const side = du(u, moonU) < 0 ? 1 : 0.4, lit = Math.max(0, 1 - Math.abs(du(u, moonU)) * 2) * side;
      const strata = Math.sin(v * HH * 0.9) * 0.5 + 0.5;
      const rim = d < 0.0025 ? lit * 70 : 0;
      return [10 + rim + strata * 3 + lit * 8, 9 + rim * 0.7 + strata * 2 + lit * 4, 12 + rim * 0.4];
    });
    // desert floor below the horizon, faintly moonlit
    s.each((u, v, x, y, i) => { if (v <= HZ + 0.004 || v < nearTop(u)) return; const n = fbm(u, v, 64, 8, 3, 2330); s.set(i, [14 + n * 8, 12 + n * 6, 14 + n * 6]); });
    // a few distant lights (a ranch, the road into Dulce)
    const dot = (x, y, col, k = 1, rr = 1) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = mod(Math.round(x) + dx, W), Y = Math.round(y) + dy; if (Y < 0 || Y >= HH) continue; s.add(Y * W + X, col, Math.exp(-(dx * dx + dy * dy) / rr) * k); } };
    for (let k = 0; k < 14; k++) dot((0.53 + k * 0.006 + r() * 0.004) * W, HY + 3 + r() * 2, [255, 196, 120], 0.6, 0.8);
    // the black helicopter, far off: running lights, a red beacon and a searchlight on the desert
    s.art((g) => {
      const hx = 0.29 * W, hy = 0.43 * HH;
      // searchlight cone to the ground
      const gx = hx + 46, gy = HY + 4;
      const beam = g.createLinearGradient(hx, hy, gx, gy); beam.addColorStop(0, 'rgba(200,220,255,0.35)'); beam.addColorStop(1, 'rgba(200,220,255,0.06)');
      g.fillStyle = beam; g.beginPath(); g.moveTo(hx + 3, hy + 4.5); g.lineTo(gx + 16, gy); g.lineTo(gx - 10, gy); g.closePath(); g.fill();
      const pool = g.createRadialGradient(gx + 3, gy, 0, gx + 3, gy, 26); pool.addColorStop(0, 'rgba(210,225,255,0.4)'); pool.addColorStop(1, 'rgba(210,225,255,0)');
      g.fillStyle = pool; g.beginPath(); g.ellipse(gx + 3, gy, 26, 5, 0, 0, 7); g.fill();
      // the airframe silhouette (Black Hawk-like), nose to the right
      g.translate(hx, hy); g.scale(1.5, 1.5); g.translate(-hx, -hy);
      g.fillStyle = '#06070a'; g.strokeStyle = '#06070a';
      g.beginPath(); g.ellipse(hx, hy, 11, 4.2, 0.05, 0, 7); g.fill();
      g.beginPath(); g.moveTo(hx - 8, hy - 1.5); g.lineTo(hx - 26, hy - 2.5); g.lineTo(hx - 26, hy - 0.5); g.lineTo(hx - 8, hy + 1.5); g.fill();
      g.beginPath(); g.moveTo(hx - 25, hy - 2); g.lineTo(hx - 28, hy - 8); g.lineTo(hx - 26, hy - 8); g.lineTo(hx - 23, hy - 2); g.fill();
      g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx - 6, hy + 5); g.lineTo(hx + 7, hy + 5); g.stroke();
      g.globalAlpha = 0.45; g.lineWidth = 1.2; g.beginPath(); g.moveTo(hx - 19, hy - 6.5); g.lineTo(hx + 18, hy - 5.5); g.stroke(); g.globalAlpha = 1;
      g.fillRect(hx - 1, hy - 6.5, 3, 2.5);
    });
    const blink = (x, y, col, k) => { dot(x, y, col, k, 1.2); s.glow(x / W, y / HH, 6 / W, 6 / HH, col, k * 0.25); };
    const hx = 0.29 * W, hy = 0.43 * HH;
    blink(hx, hy - 10.5, [255, 40, 30], 1.4); blink(hx - 41, hy - 11, [255, 255, 255], 1.2); blink(hx + 13, hy + 1.5, [40, 255, 90], 0.8); blink(hx + 3, hy + 4.5, [255, 250, 230], 1.2);
    // a second, farther helicopter: just its lights
    blink(0.255 * W, 0.5 * HH, [255, 40, 30], 0.9); blink(0.257 * W, 0.5 * HH + 1, [255, 255, 255], 0.5);
    await save(F, 'textures', 'SKYMESA', s.toImage());
  }

  // ============================================================ SKYCHI
  if (want('SKYCHI')) {
    const s = new Sky();
    const lakeU0 = 0.27, lakeU1 = 0.47;                 // Lake Michigan: the eastern quarter of the view
    const inLake = (u) => u > lakeU0 && u < lakeU1;
    s.gradient([[0, [10, 8, 16]], [0.22, [26, 16, 24]], [0.42, [70, 36, 30]], [HZ - 0.02, [150, 74, 36]], [HZ, [170, 90, 44]], [HZ + 0.02, [30, 20, 18]], [1, [12, 10, 10]]]);
    // the lake side is darker and bluer (no fires out there)
    s.each((u, v, x, y, i) => {
      const lk = sstep(0.06, 0, Math.max(0, lakeU0 - u, u - lakeU1)) * (u > lakeU0 - 0.06 && u < lakeU1 + 0.06 ? 1 : 0);
      if (lk <= 0 || v > HZ + 0.02) return;
      s.set(i, [mix(10, 34, v / HZ), mix(10, 30, v / HZ), mix(20, 46, v / HZ)], lk * 0.7);
    });
    s.stars(900, 2401, (u) => (inLake(u) ? 0.4 : 0.22), { bright: 0.7 });
    // smoke overcast lit orange from below
    s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      const n = fbm(u + v * 0.15, v, 10, 5, 5, 2402), n2 = fbm(u, v, 36, 14, 3, 2403);
      const lakeK = inLake(u) ? 0.5 : 1;
      const dens = clamp((n - 0.45) * 2.4 + (n2 - 0.5) * 0.4) * lakeK;
      const low = sstep(0.05, HZ, v);
      s.set(i, [mix(30, 150, low * (1 - dens * 0.4)), mix(18, 64, low * (1 - dens * 0.4)), mix(22, 30, low)], dens * 0.7);
    });
    // ---------------------------------------------------------------- generic skyline (two layers) with lit windows
    const layer = (seed, hmin, hmax, wmin, wmax, tone, litK) => {
      const r = rng(seed), bl = []; let u = 0;
      while (u < 1) { const wd = (wmin + r() * (wmax - wmin)) / W, ht = hmin + Math.pow(r(), 1.5) * (hmax - hmin); bl.push({ u0: u, u1: u + wd, ht, burn: r() < 0.14, crown: r() < 0.15, seed: r() * 1000 }); u += wd + (r() < 0.25 ? r() * 4 / W : 0); }
      bl[bl.length - 1].u1 = 1;
      const top = new Float32Array(W).fill(2), id = new Int32Array(W).fill(-1);
      bl.forEach((b, k) => { const lakeK = inLake((b.u0 + b.u1) / 2) ? 0.15 : 1; b.ht *= lakeK; for (let x = Math.floor(b.u0 * W); x < Math.min(W, Math.ceil(b.u1 * W)); x++) { let t = HZ - b.ht; if (b.crown && Math.abs(x - (b.u0 + b.u1) / 2 * W) < (b.u1 - b.u0) * W * 0.25) t -= 0.012; if (t < top[x]) { top[x] = t; id[x] = k; } } });
      s.each((u2, v, x, y, i) => {
        if (v < top[x] || v > HZ + 0.004) return;
        const b = bl[id[x]]; if (!b) return;
        let c = tone;
        const wx = x - Math.floor(b.u0 * W), wy = y - Math.floor(top[x] * HH);
        if (wx % 4 > 0 && wx % 4 < 3 && wy % 5 > 1 && wy % 5 < 4 && wy > 2) {
          const hh = hash(Math.floor(wx / 4), Math.floor(wy / 5), id[x] + seed);
          if (hh < litK) c = hash(id[x], wy, 3) < 0.7 ? [210, 166, 96] : [146, 172, 200];
          if (b.burn && wy < 30 && hh < 0.7) c = hash(x, y, 5) < 0.6 ? [255, 160, 50] : [255, 100, 26];
        }
        // fire glow washing up the facades from street level
        const glow = sstep(HZ - 0.08, HZ, v) * 0.6;
        s.set(i, [c[0] + glow * 60, c[1] + glow * 22, c[2] + glow * 8]);
      });
      return bl;
    };
    const farBl = layer(2410, 0.03, 0.15, 10, 30, [22, 16, 18], 0.12);
    // ---------------------------------------------------------------- landmarks (canvas silhouettes)
    const lit = (g, x, y, w, h, seed, k = 0.12, colw = 3, rowh = 4) => {   // random lit windows inside a rect
      const r = rng(seed);
      for (let yy = y; yy < y + h - 2; yy += rowh) for (let xx = x + 1; xx < x + w - 1; xx += colw) {
        const q = r(); if (q > k) continue;
        g.fillStyle = q < k * 0.15 ? 'rgba(255,140,40,0.95)' : q < k * 0.75 ? 'rgba(220,180,110,0.85)' : 'rgba(150,180,210,0.8)';
        g.fillRect(xx, yy, Math.max(1, colw - 1.5), Math.max(1, rowh - 2.5));
      }
    };
    const fireWash = (g, x0, x1, ytop, yb) => { const gr = g.createLinearGradient(0, yb, 0, ytop); gr.addColorStop(0, 'rgba(255,120,40,0.32)'); gr.addColorStop(0.35, 'rgba(255,100,40,0.08)'); gr.addColorStop(1, 'rgba(255,100,40,0)'); g.fillStyle = gr; g.fillRect(x0, ytop, x1 - x0, yb - ytop); };
    const aircraft = [];   // red aircraft-warning lights, glowed afterwards
    // Sears Tower: nine bundled black tubes stepping back at the 50th, 66th and 90th floors; twin antennas
    const sears = (g, cx, H) => {
      const t = Math.round(H * 0.064), x0 = cx - t * 1.5, yb = HY + 2, y = (f) => yb - H * f;
      // [column, depth row (0 = back), top fraction]: two tubes to the 108th floor, three to the 90th, two to the 66th, two to the 50th
      const tubes = [[0, 0, 0.83], [1, 0, 1.0], [2, 0, 1.0], [0, 1, 0.61], [1, 1, 0.83], [2, 1, 0.83], [2, 2, 0.45], [0, 2, 0.45], [1, 2, 0.61]];
      for (const [c, d, f] of tubes) {
        const xa = x0 + c * t, ya = y(f);
        const gr = g.createLinearGradient(xa, 0, xa + t, 0), sh = 14 + d * 7;
        gr.addColorStop(0, `rgb(${sh + 12},${sh + 9},${sh + 10})`); gr.addColorStop(1, `rgb(${sh},${sh - 2},${sh})`);
        g.fillStyle = gr; g.fillRect(xa, ya, t, yb - ya);
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(xa + t - 0.8, ya, 0.8, yb - ya);               // tube seam
        g.fillStyle = 'rgba(90,80,74,0.22)'; for (let xx = xa + 1.5; xx < xa + t - 1; xx += 2) g.fillRect(xx, ya, 0.6, yb - ya);
        for (const bf of [0.27, 0.6, 0.82, 0.97]) if (bf < f - 0.01) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(xa, y(bf), t, H * 0.022); }
        lit(g, xa, ya + 3, t, yb - ya - 4, Math.round(cx + c * 7 + d * 31), 0.08, 2, 3);
        g.fillStyle = 'rgba(230,130,70,0.75)'; g.fillRect(xa, ya, t, 1.2);                          // setback ledge in the firelight
      }
      fireWash(g, x0, x0 + t * 3 + 1, y(0.5), yb);
      // the twin antennas (the west one a little taller), white masts with red lights
      for (const [xa, ah] of [[x0 + t * 1.5, 0.21], [x0 + t * 2.5, 0.18]]) {
        g.fillStyle = '#d8d2cc'; g.fillRect(xa - 1.1, y(1) - H * ah, 2.2, H * ah);
        g.fillStyle = '#9a948e'; g.fillRect(xa - 3, y(1) - 4, 6, 4); g.fillRect(xa - 1.8, y(1) - H * ah * 0.5, 3.6, 2);
        aircraft.push([xa, y(1) - H * ah], [xa, y(1) - H * ah * 0.5]);
      }
    };
    // John Hancock Center: tapering black obelisk with five stacked X-braces and twin antennas
    const hancock = (g, cx, H) => {
      const yb = HY + 2, wb = H * 0.24, wt = H * 0.145, yt = yb - H;
      const xAt = (yy, side) => cx + side * mix(wb, wt, (yb - yy) / H) / 2;
      g.fillStyle = '#121012'; g.beginPath(); g.moveTo(xAt(yb, -1), yb); g.lineTo(xAt(yt, -1), yt); g.lineTo(xAt(yt, 1), yt); g.lineTo(xAt(yb, 1), yb); g.closePath(); g.fill();
      g.save(); g.clip();
      // lit windows between the braces
      lit(g, cx - wb / 2, yt + 2, wb, H - 2, 2420, 0.42, 2.2, 3);
      fireWash(g, cx - wb / 2, cx + wb / 2, yb - H * 0.5, yb);
      // X-braces, corner columns and spandrel ties
      g.strokeStyle = '#0c0a0c'; g.lineWidth = Math.max(2, H * 0.014);
      const n = 5, seg = H * 0.92 / n, y0 = yb - H * 0.04;
      for (let k = 0; k < n; k++) {
        const ya = y0 - k * seg, yz = ya - seg;
        g.beginPath(); g.moveTo(xAt(ya, -1), ya); g.lineTo(xAt(yz, 1), yz); g.moveTo(xAt(ya, 1), ya); g.lineTo(xAt(yz, -1), yz); g.stroke();
        g.beginPath(); g.moveTo(xAt(ya, -1), ya); g.lineTo(xAt(ya, 1), ya); g.stroke();
      }
      g.beginPath(); g.moveTo(xAt(yb, -1) + 1, yb); g.lineTo(xAt(yt, -1) + 1, yt); g.moveTo(xAt(yb, 1) - 1, yb); g.lineTo(xAt(yt, 1) - 1, yt); g.stroke();
      g.restore();
      // the top: a dark band, then the two antennas
      g.fillStyle = '#0a090a'; g.fillRect(xAt(yt, -1), yt, wt, H * 0.025);
      for (const [dx, ah] of [[-wt * 0.25, 0.3], [wt * 0.25, 0.3]]) {
        g.fillStyle = '#d8d2cc'; g.fillRect(cx + dx - 1.1, yt - H * ah, 2.2, H * ah);
        aircraft.push([cx + dx, yt - H * ah], [cx + dx, yt - H * ah * 0.5]);
      }
      // the lit observatory floor near the top
      g.fillStyle = 'rgba(230,200,140,0.9)'; g.fillRect(xAt(yt + H * 0.06, -1) + 2, yt + H * 0.06, wt * 1.02 - 4, 1.2);
    };
    // Amoco Building: a plain, pale stone-clad slab (in 1997)
    const amoco = (g, cx, H) => {
      const yb = HY + 2, w = H * 0.17, yt = yb - H;
      const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); gr.addColorStop(0, '#5a5452'); gr.addColorStop(1, '#3a3434');
      g.fillStyle = gr; g.fillRect(cx - w / 2, yt, w, H);
      g.fillStyle = 'rgba(20,18,20,0.5)'; for (let x = cx - w / 2 + 2; x < cx + w / 2; x += 2.5) g.fillRect(x, yt, 1, H);
      lit(g, cx - w / 2, yt + 2, w, H - 2, 2421, 0.08, 2.5, 3);
      fireWash(g, cx - w / 2, cx + w / 2, yb - H * 0.6, yb);
      aircraft.push([cx - w / 2 + 2, yt - 1], [cx + w / 2 - 2, yt - 1]);
    };
    // Marina City: twin corn-cob towers (spiral parking below, scalloped balconies above)
    const corncob = (g, cx, H) => {
      const yb = HY + 2, R = H * 0.1, yt = yb - H, park = H * 0.34, fl = 3;
      g.fillStyle = '#1a1416'; g.fillRect(cx - R, yt, R * 2, H);
      for (let yy = yb; yy > yt; yy -= fl) {
        const floor = Math.round((yb - yy) / fl), isPark = yb - yy < park;
        if (isPark) {
          // the parking spiral: a slanted lit band per turn
          g.fillStyle = 'rgba(150,120,100,0.45)'; g.fillRect(cx - R, yy - 1, R * 2, 0.8);
          g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - R, yy - 2.2, R * 2, 1);
          continue;
        }
        // scalloped balconies: petals across the visible half of the drum, lit rims, lit rooms behind
        for (let k = -4; k <= 4; k++) {
          const th = k / 4.6 * Math.PI / 2, px = cx + Math.sin(th) * R, pw = Math.cos(th) * R * 0.17 + 0.6;
          g.fillStyle = `rgba(${170 + k * 4},${150 + k * 3},${136},${0.55 * Math.cos(th) + 0.15})`;
          g.beginPath(); g.ellipse(px, yy, pw, 1.3, 0, 0, Math.PI); g.fill();
          if (hash(floor, k + 9, 2422) < 0.2) { g.fillStyle = hash(floor, k, 2423) < 0.25 ? 'rgba(255,140,40,0.95)' : 'rgba(225,185,115,0.9)'; g.fillRect(px - pw * 0.5, yy - 1.8, pw, 1.2); }
        }
        // the scalloped silhouette edge
        g.fillStyle = '#1a1416'; g.beginPath(); g.ellipse(cx - R, yy, 1.4, 1.4, 0, 0, 7); g.ellipse(cx + R, yy, 1.4, 1.4, 0, 0, 7); g.fill();
      }
      g.fillStyle = '#141012'; g.beginPath(); g.ellipse(cx, yt, R + 1, 2.4, 0, 0, 7); g.fill();
      g.fillStyle = '#5a504c'; g.fillRect(cx - 1, yt - 7, 2, 7);
      aircraft.push([cx, yt - 7]);
      fireWash(g, cx - R - 2, cx + R + 2, yb - H * 0.5, yb);
    };
    // 311 South Wacker's lit crown and other mid-rise fillers in front of Sears
    const crown = (g, cx, H) => {
      const yb = HY + 2, w = H * 0.16, yt = yb - H;
      g.fillStyle = '#1e1a1c'; g.fillRect(cx - w / 2, yt, w, H);
      lit(g, cx - w / 2, yt + 6, w, H - 6, 2424, 0.1, 2.5, 3);
      g.fillStyle = 'rgba(240,236,220,0.9)'; g.beginPath(); g.ellipse(cx, yt - 4, w * 0.36, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#1e1a1c'; g.fillRect(cx - w * 0.36, yt - 3, w * 0.72, 3);
      fireWash(g, cx - w / 2, cx + w / 2, yb - H * 0.6, yb);
    };
    s.art((g) => {
      hancock(g, 0.115 * W, 205);
      amoco(g, 0.215 * W, 196);
      corncob(g, 0.052 * W, 150); corncob(g, 0.07 * W, 150);
      crown(g, 0.74 * W, 150);
      sears(g, 0.705 * W, 238);
    });
    // nearer skyline layer in front of the landmarks' feet
    layer(2430, 0.02, 0.07, 14, 40, [16, 12, 14], 0.16);
    // ---------------------------------------------------------------- Lake Michigan: dark water with reflections at the horizon
    const lakeK = (u) => sstep(lakeU0 - 0.005, lakeU0 + 0.02, u) * sstep(lakeU1 + 0.005, lakeU1 - 0.02, u);
    s.each((u, v, x, y, i) => {
      const k = lakeK(u); if (k <= 0 || v < HZ - 0.003) return;
      const ripple = fbm(u, v, 400, 40, 3, 2440), dv = clamp((v - HZ) / 0.25);
      s.set(i, [mix(26, 8, dv) + ripple * 8, mix(28, 9, dv) + ripple * 9, mix(44, 14, dv) + ripple * 12], k);
    });
    // a low lakefront and the 1995 Ferris wheel on Navy Pier
    s.art((g) => {
      const px = lakeU0 * W + 34, py = HY - 22, R = 18;
      g.strokeStyle = 'rgba(255,220,160,0.9)'; g.lineWidth = 1;
      g.beginPath(); g.arc(px, py, R, 0, 7); g.stroke();
      for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * R, py + Math.sin(a) * R); g.stroke(); }
      g.fillStyle = '#100c0e'; g.beginPath(); g.moveTo(px - 8, HY + 2); g.lineTo(px, py); g.lineTo(px + 8, HY + 2); g.fill();
      g.fillStyle = '#120e10'; g.fillRect(lakeU0 * W - 8, HY - 4, 80, 6);
      for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(255,210,140,0.9)'; g.fillRect(lakeU0 * W - 6 + k * 6, HY - 2, 1.5, 1.5); }
    });
    // ---------------------------------------------------------------- the saucers over the lake, beams to the water
    const saucers = [[0.33, 0.33, 1.25], [0.415, 0.4, 0.8], [0.375, 0.47, 0.5]];
    for (const [su, sv, sc] of saucers) {
      const cx = su * W, cy = sv * HH;
      s.each((u, v, x, y, i) => {
        if (v < sv) return;
        const dx = du(u, su) * W;
        if (v > HZ) { const rv = (v - HZ) / 0.1; if (rv < 1) s.add(i, [120, 230, 210], Math.exp(-(dx * dx) / (60 * sc * sc)) * 0.35 * (1 - rv) * (0.6 + 0.4 * Math.sin(v * 900))); return; }
        const t = (v - sv) / (HZ - sv);
        const wd = (6 + t * 26) * sc, a = Math.exp(-(dx * dx) / (wd * wd));
        s.add(i, [120, 230, 210], a * 0.35 * (1 - t * 0.4));
        s.add(i, [220, 255, 250], Math.exp(-(dx * dx) / (wd * wd * 0.08)) * 0.35 * (1 - t * 0.5));
      });
      s.glow(su, HZ + 0.004, 0.012 * sc, 0.006, [160, 255, 230], 0.9);       // where the beam hits the water
      s.glow(su, sv, 0.03 * sc, 0.05, [80, 160, 150], 0.35);
      s.art((g) => {
        g.save(); g.translate(cx, cy); g.scale(sc, sc);
        g.fillStyle = '#16181e'; g.beginPath(); g.ellipse(0, 0, 46, 8, 0, 0, 7); g.fill();
        g.fillStyle = '#262a34'; g.beginPath(); g.ellipse(0, -2, 44, 5, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#1e222a'; g.beginPath(); g.ellipse(0, -6, 15, 9, 0, Math.PI, 0); g.fill();
        g.fillStyle = 'rgba(120,255,220,0.95)'; g.beginPath(); g.ellipse(0, 6, 12, 3, 0, 0, 7); g.fill();
        for (let k = -6; k <= 6; k++) { g.fillStyle = k % 2 ? 'rgba(255,240,200,0.95)' : 'rgba(120,255,230,0.95)'; g.beginPath(); g.arc(k * 6.3, 2.5 + Math.abs(k) * -0.12, 1.5, 0, 7); g.fill(); }
        g.restore();
      });
    }
    // ---------------------------------------------------------------- fires and smoke columns rising from the city
    const fires = [[0.02, 1], [0.16, 0.8], [0.52, 1.2], [0.6, 0.9], [0.8, 1.1], [0.9, 0.8], [0.68, 0.7]];
    for (const [fu, k] of fires) { s.glow(fu, HZ - 0.01, 0.035 * k, 0.06, [255, 110, 40], 0.7 * k); s.glow(fu, HZ, 0.01 * k, 0.012, [255, 200, 110], 0.9); }
    s.each((u, v, x, y, i) => {
      if (v > HZ) return;
      for (const [fu, k] of fires) {
        const up = (HZ - v) / 0.55; if (up < 0 || up > 1) continue;
        const cu = fu + up * up * 0.07, d = Math.abs(du(u, cu)) / (0.006 * k + up * 0.05);
        if (d > 1.6) continue;
        const n = fbm(u + up * 0.3, v, 96, 28, 4, 2450 + Math.round(fu * 100));
        const a = clamp((1 - d) * 1.3 + (n - 0.5) * 1.4) * (1 - up * 0.8) * 0.9;
        if (a <= 0) continue;
        const litK = clamp(1 - up * 3.5);
        s.set(i, [mix(26, 170, litK), mix(18, 66, litK), mix(18, 26, litK)], a);
      }
    });
    s.art((g) => {
      const fr = rng(2451);
      for (const [fu, k] of fires) {
        const x0 = fu * W, y0 = HY + 2;
        for (let j = 0; j < 7; j++) {
          const x = x0 + (fr() - 0.5) * 30 * k, hgt = (10 + fr() * 22) * k, wd = (3 + fr() * 6) * k;
          const gr = g.createLinearGradient(0, y0, 0, y0 - hgt);
          gr.addColorStop(0, 'rgba(255,236,150,0.95)'); gr.addColorStop(0.4, 'rgba(255,130,30,0.85)'); gr.addColorStop(1, 'rgba(200,40,10,0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x - wd, y0); g.quadraticCurveTo(x - wd * 0.5, y0 - hgt * 0.6, x + (fr() - 0.5) * 5, y0 - hgt); g.quadraticCurveTo(x + wd * 0.5, y0 - hgt * 0.5, x + wd, y0); g.fill();
        }
      }
    }, { mode: 'add' });
    // searchlights and aircraft-warning lights
    for (const [bu, ang] of [[0.13, 0.35], [0.56, -0.3], [0.85, 0.22]]) s.each((u, v, x, y, i) => {
      if (v > HZ - 0.02) return;
      const up = (HZ - v) * HH, off = du(u, bu) * W - up * Math.tan(ang), width = 2 + up * 0.03;
      s.add(i, [210, 210, 200], Math.exp(-(off * off) / (width * width)) * 0.1 * (1 - up / 320));
    });
    for (const [x, y] of aircraft) { s.glow(x / W, y / HH, 1.4 / W, 1.4 / HH, [255, 60, 40], 1.3); s.glow(x / W, y / HH, 6 / W, 6 / HH, [255, 40, 30], 0.18); }
    // below the horizon: the dark city
    s.each((u, v, x, y, i) => { if (v <= HZ + 0.004 || lakeK(u) > 0.99) return; s.set(i, [mix(40, 12, clamp((v - HZ) / 0.15)), mix(24, 10, clamp((v - HZ) / 0.15)), mix(18, 10, clamp((v - HZ) / 0.15))]); });
    await save(F, 'textures', 'SKYCHI', s.toImage());
  }
}

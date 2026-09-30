// Sky painter (2048 x 512, wraps horizontally; horizon ~40% up from the bottom).
import { clamp, mix, sstep, fbm, vn, rng, hash, fract, mod } from './tex.js';

export class Sky {
  constructor(w = 2048, h = 512) { this.w = w; this.h = h; this.C = new Float32Array(w * h * 3); this.hz = Math.round(h * 0.6); }
  each(fn) { const { w, h } = this; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(x / w, y / h, x, y, (y * w + x)); }
  get(i) { return [this.C[i * 3], this.C[i * 3 + 1], this.C[i * 3 + 2]]; }
  set(i, c, a = 1) { if (a <= 0) return; if (a > 1) a = 1; this.C[i * 3] += (c[0] - this.C[i * 3]) * a; this.C[i * 3 + 1] += (c[1] - this.C[i * 3 + 1]) * a; this.C[i * 3 + 2] += (c[2] - this.C[i * 3 + 2]) * a; }
  add(i, c, k = 1) { this.C[i * 3] += c[0] * k; this.C[i * 3 + 1] += c[1] * k; this.C[i * 3 + 2] += c[2] * k; }
  // vertical gradient stops [[v, colour], ...]
  gradient(stops) {
    this.each((u, v, x, y, i) => {
      let c = stops[stops.length - 1][1];
      for (let k = 1; k < stops.length; k++) if (v <= stops[k][0]) { const [v0, c0] = stops[k - 1], [v1, c1] = stops[k]; const t = clamp((v - v0) / (v1 - v0)); c = [mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t)]; break; }
      this.C[i * 3] = c[0]; this.C[i * 3 + 1] = c[1]; this.C[i * 3 + 2] = c[2];
    });
  }
  // horizontal glow blob (wrapping): centre u, v; radii in uv; colour; strength
  glow(cu, cv, ru, rv, col, k = 1) {
    this.each((u, v, x, y, i) => {
      const du = (mod(u - cu + 0.5, 1) - 0.5) / ru, dv = (v - cv) / rv, d = du * du + dv * dv;
      if (d < 9) this.add(i, col, Math.exp(-d) * k);
    });
  }
  // stars above a ceiling function vmax(u) (fraction of height)
  stars(n, seed, vmax, { bright = 1, milky = null } = {}) {
    const r = rng(seed), { w, h } = this;
    for (let k = 0; k < n; k++) {
      let u = r(), v = r() * 0.95;
      if (milky && r() < 0.45) { // concentrate along a tilted band
        const t = r(); u = t; v = milky(t) + (r() + r() + r() - 1.5) * 0.08;
      }
      if (v > vmax(u) || v < 0) continue;
      const mag = Math.pow(r(), 3.2) * bright, temp = r();
      const col = temp < 0.2 ? [255, 210, 170] : temp < 0.7 ? [235, 240, 255] : [190, 210, 255];
      const x = u * w, y = v * h, rad = 0.5 + mag * 1.1;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const X = mod(Math.round(x) + dx, w), Y = Math.round(y) + dy; if (Y < 0 || Y >= h) continue;
        const d = Math.hypot(X - x + (Math.abs(X - x) > w / 2 ? (X > x ? -w : w) : 0), Y - y);
        let a = Math.exp(-(d * d) / (rad * rad)) * (0.1 + mag * 1.15);
        if (mag > 0.55 && (dx === 0 || dy === 0)) a += 0.25 * mag * Math.exp(-Math.abs(dx + dy) * 0.6);
        this.add(Y * w + X, col, a);
      }
    }
  }
  // a silhouette ridge: top(u) → v; fill colour fn(u,v,depth) with optional rim light
  ridge(top, fill) {
    this.each((u, v, x, y, i) => { const t = top(u); if (v >= t) { const c = fill(u, v, v - t, i); if (c) this.set(i, c, c[3] ?? 1); } });
  }
  toImage() {
    const { w, h } = this, data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { data[i * 4] = this.C[i * 3]; data[i * 4 + 1] = this.C[i * 3 + 1]; data[i * 4 + 2] = this.C[i * 3 + 2]; data[i * 4 + 3] = 255; }
    return { w, h, data };
  }
  // canvas overlay (wrap: draws at x-w, x, x+w)
  art(draw, { wrap = true, mode = 'over' } = {}) {
    const { w, h } = this;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (const dx of wrap ? [-w, 0, w] : [0]) { g.save(); g.translate(dx, 0); draw(g, w, h); g.restore(); }
    const d = g.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) { const a = d[i * 4 + 3] / 255; if (!a) continue; const col = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]; if (mode === 'add') this.add(i, col, a); else this.set(i, col, a); }
  }
}
// periodic 1D fbm on u (for skylines)
export const n1 = (u, f, oct, s) => fbm(u, 0.37, f, 1, oct, s);

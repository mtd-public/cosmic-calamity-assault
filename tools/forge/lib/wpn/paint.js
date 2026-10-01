// Per-pixel painters for FX sprites: periodic noise, colour ramps, and a
// small raster helper. Everything is premultiplied-dark so additive render
// styles add nothing at the edges; alpha is soft (brightness or coverage).
import { fbm, vnoise, hash } from '../noise.js';
export { fbm, vnoise, hash };
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
// colour ramp: stops [[t, [r,g,b]], ...]
export function ramp(stops, t) {
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [t0, a] = stops[i - 1], [t1, b] = stops[i], u = (t - t0) / (t1 - t0 || 1);
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  }
  return stops[stops.length - 1][1];
}
export const FIRE_RAMP = [[0, [0, 0, 0]], [0.18, [70, 8, 2]], [0.38, [190, 40, 6]], [0.58, [255, 120, 20]], [0.78, [255, 205, 80]], [1, [255, 250, 225]]];
// Raster: w×h float RGBA (premultiplied), with helpers; img() → Uint8 RGBA.
export class Raster {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Float32Array(w * h * 4); }
  // fn(x, y) → [r, g, b, a] (0..255 colour, 0..1 alpha, NOT premultiplied); mode 'over' | 'add'
  each(fn, mode = 'over') {
    const { w, h, d } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x + 0.5, y + 0.5); if (!c) continue;
      const a = clamp(c[3] ?? 1), o = (y * w + x) * 4;
      if (a <= 0) continue;
      if (mode === 'add') { d[o] += c[0] * a; d[o + 1] += c[1] * a; d[o + 2] += c[2] * a; d[o + 3] = Math.min(1, d[o + 3] + a); }
      else { const k = 1 - a; d[o] = c[0] * a + d[o] * k; d[o + 1] = c[1] * a + d[o + 1] * k; d[o + 2] = c[2] * a + d[o + 2] * k; d[o + 3] = a + d[o + 3] * k; }
    }
  }
  // alphaMode: 'coverage' (opaque things: blood, shards) or 'bright' (glows)
  img(alphaMode = 'bright', k = 1.3) {
    const { w, h, d } = this, out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const a = d[i * 4 + 3];
      out[i * 4] = d[i * 4]; out[i * 4 + 1] = d[i * 4 + 1]; out[i * 4 + 2] = d[i * 4 + 2];
      if (alphaMode === 'coverage') {
        // un-premultiply for opaque sprites
        if (a > 0) { out[i * 4] = d[i * 4] / a; out[i * 4 + 1] = d[i * 4 + 1] / a; out[i * 4 + 2] = d[i * 4 + 2] / a; }
        out[i * 4 + 3] = a * 255;
      } else out[i * 4 + 3] = Math.min(255, Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) * k, a * 255);
    }
    return { w, h, data: out };
  }
}

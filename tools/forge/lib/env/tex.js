// Environment texture painter: a tileable height field + albedo + emissive +
// alpha, painted with signed-distance primitives (rects, circles, capsules,
// polygons), canvas masks (text, freehand shapes) and periodic noise, then
// "baked": normals from the height field, a fixed upper-left key light, cavity
// AO at several radii, short cast shadows and a specular glint on bevels.
// Every primitive wraps around the edges, so everything tiles by construction.
//
//   const s = new Surf(256, 256);
//   s.fill([180,170,150]);
//   s.rect(8, 8, 120, 120, { h: 4, bevel: 3, color: [200,190,170] });
//   s.bolt(20, 20, 4);
//   F.emit('textures/NAME.png', s.bake());
import { hash } from '../noise.js';
export { hash };

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
export const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const fract = (x) => x - Math.floor(x);
export const mod = (a, n) => ((a % n) + n) % n;

// ------------------------------------------------------------------ periodic noise
// u, v in [0,1) texture space; fx, fy integer frequencies → periodic over the texture.
export function vn(u, v, fx, fy, s = 1) {
  const x = u * fx, y = v * fy, xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = xf * xf * (3 - 2 * xf), b = yf * yf * (3 - 2 * yf);
  const x0 = mod(xi, fx), x1 = mod(xi + 1, fx), y0 = mod(yi, fy), y1 = mod(yi + 1, fy);
  const h00 = hash(x0, y0, s), h10 = hash(x1, y0, s), h01 = hash(x0, y1, s), h11 = hash(x1, y1, s);
  return (h00 * (1 - a) + h10 * a) * (1 - b) + (h01 * (1 - a) + h11 * a) * b;
}
export function fbm(u, v, fx, fy, oct = 4, s = 1, gain = 0.5) {
  let t = 0, amp = 1, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { t += vn(u, v, fx * f, fy * f, s + i * 131) * amp; n += amp; amp *= gain; f *= 2; }
  return t / n;
}
export function ridged(u, v, fx, fy, oct = 4, s = 1) {
  let t = 0, amp = 1, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { t += (1 - Math.abs(vn(u, v, fx * f, fy * f, s + i * 71) * 2 - 1)) * amp; n += amp; amp *= 0.5; f *= 2; }
  return t / n;
}
// Periodic Worley: returns [f1, f2, id, px, py] (distances in cell units, point in uv)
export function worley(u, v, fx, fy, s = 1, jit = 0.9) {
  const x = u * fx, y = v * fy, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0, px = 0, py = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = mod(cx, fx), wy = mod(cy, fy);
    const ox = cx + 0.5 + (hash(wx, wy, s) - 0.5) * jit, oy = cy + 0.5 + (hash(wx, wy, s + 7) - 0.5) * jit;
    const d = Math.hypot(x - ox, y - oy);
    if (d < f1) { f2 = f1; f1 = d; id = wx * 7919 + wy * 104729; px = ox / fx; py = oy / fy; } else if (d < f2) f2 = d;
  }
  return [f1, f2, id, px, py];
}
export const h1 = (i, s = 0) => hash(i | 0, 17, s | 0);
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (a0, b0) => a0 + (b0 - a0) * r();
  r.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}

// ------------------------------------------------------------------ SDFs (unwrapped pixel space)
export function sdRoundRect(px, py, cx, cy, hx, hy, r = 0) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
export function sdSeg(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const t = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay || 1));
  return Math.hypot(pax - bax * t, pay - bay * t);
}
export function sdPoly(px, py, P) {
  let d = Infinity, s = 1;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], [bx, by] = P[i];
    d = Math.min(d, sdSeg(px, py, ax, ay, bx, by));
    if ((by > py) !== (ay > py) && px < ((ax - bx) * (py - by)) / (ay - by) + bx) s = -s;
  }
  return s * d;
}

const PROFILES = {
  lin: (t) => t,
  round: (t) => Math.sqrt(1 - (1 - t) * (1 - t)), // quarter circle: domes, pipes
  smooth: (t) => t * t * (3 - 2 * t),
  cove: (t) => t * t,
};

// ------------------------------------------------------------------ the surface
export class Surf {
  constructor(w, h = w) {
    this.w = w; this.h = h; this.n = w * h;
    this.H = new Float32Array(this.n);
    this.C = new Float32Array(this.n * 3);
    this.E = new Float32Array(this.n * 3);
    this.A = new Float32Array(this.n).fill(1);
    this.S = new Float32Array(this.n);      // specular strength (0 matte .. 1 polished)
    this.O = new Float32Array(this.n).fill(1); // painted occlusion multiplier
  }
  idx(x, y) { return mod(y | 0, this.h) * this.w + mod(x | 0, this.w); }
  fill(c, spec = 0) {
    for (let i = 0; i < this.n; i++) { this.C[i * 3] = c[0]; this.C[i * 3 + 1] = c[1]; this.C[i * 3 + 2] = c[2]; this.S[i] = spec; }
    return this;
  }
  // fn(u, v, x, y, i) — direct access to the arrays
  each(fn) {
    const { w, h } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(x / w, y / h, x, y, y * w + x);
    return this;
  }
  // multiply / add colour with a per-pixel function returning a factor or colour
  tint(fn) { // fn(u,v,x,y,i) → k (brightness multiplier) or [r,g,b] multiplier
    return this.each((u, v, x, y, i) => {
      const k = fn(u, v, x, y, i); if (k == null) return;
      if (typeof k === 'number') { this.C[i * 3] *= k; this.C[i * 3 + 1] *= k; this.C[i * 3 + 2] *= k; }
      else { this.C[i * 3] *= k[0]; this.C[i * 3 + 1] *= k[1]; this.C[i * 3 + 2] *= k[2]; }
    });
  }
  getC(i) { return [this.C[i * 3], this.C[i * 3 + 1], this.C[i * 3 + 2]]; }
  setC(i, c, a = 1) {
    if (a >= 1) { this.C[i * 3] = c[0]; this.C[i * 3 + 1] = c[1]; this.C[i * 3 + 2] = c[2]; return; }
    if (a <= 0) return;
    this.C[i * 3] += (c[0] - this.C[i * 3]) * a; this.C[i * 3 + 1] += (c[1] - this.C[i * 3 + 1]) * a; this.C[i * 3 + 2] += (c[2] - this.C[i * 3 + 2]) * a;
  }
  addE(i, c, a = 1) { this.E[i * 3] += c[0] * a; this.E[i * 3 + 1] += c[1] * a; this.E[i * 3 + 2] += c[2] * a; }

  // Generic SDF stamp. dist(px, py) in unwrapped pixel coords; bbox [x0,y0,x1,y1].
  // o: { h, bevel, prof, op: 'add'|'max'|'set'|'sub'|'min', color, alpha(colour opacity), spec, fn(i, cov, t, d, px, py), E, eAlpha, occl, a }
  stamp(dist, bbox, o = {}) {
    const { w, h } = this;
    const bev = o.bevel ?? 1, prof = PROFILES[o.prof || 'lin'], H0 = o.h ?? 0, op = o.op || 'add';
    const x0 = Math.floor(bbox[0]) - 2, y0 = Math.floor(bbox[1]) - 2, x1 = Math.ceil(bbox[2]) + 2, y1 = Math.ceil(bbox[3]) + 2;
    const aa = o.aa ?? 1;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const d = dist(px + 0.5, py + 0.5);
      const cov = clamp(0.5 - d / aa);
      if (cov <= 0) continue;
      const i = mod(py, h) * w + mod(px, w);
      const t = prof(clamp(-d / bev));
      if (o.h != null) {
        const target = (o.base ?? 0) + H0 * t;
        if (op === 'add') this.H[i] += target * cov;
        else if (op === 'sub') this.H[i] -= H0 * t * cov;
        else if (op === 'max') this.H[i] = Math.max(this.H[i], mix(this.H[i], target, cov));
        else if (op === 'min') this.H[i] = Math.min(this.H[i], mix(this.H[i], target, cov));
        else if (op === 'set') this.H[i] = mix(this.H[i], target, cov);
        else if (op === 'lift') this.H[i] = mix(this.H[i], (o.base ?? 0) + (o.from ?? 0) + H0 * t, cov);
      }
      if (o.color) this.setC(i, typeof o.color === 'function' ? o.color(px, py, t, d, i) : o.color, cov * (o.alpha ?? 1));
      if (o.spec != null) this.S[i] = mix(this.S[i], o.spec, cov);
      if (o.E) this.addE(i, o.E, cov * (o.eAlpha ?? 1));
      if (o.occl != null) this.O[i] *= mix(1, o.occl, cov);
      if (o.a != null) this.A[i] = mix(this.A[i], o.a, cov);
      if (o.fn) o.fn(i, cov, t, d, px, py);
    }
    return this;
  }
  rect(x0, y0, x1, y1, o = {}) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, r = o.r ?? 0;
    return this.stamp((px, py) => sdRoundRect(px, py, cx, cy, hx, hy, r), [x0, y0, x1, y1], o);
  }
  circle(cx, cy, r, o = {}) { return this.stamp((px, py) => Math.hypot(px - cx, py - cy) - r, [cx - r, cy - r, cx + r, cy + r], o); }
  ring(cx, cy, r, t, o = {}) { return this.stamp((px, py) => Math.abs(Math.hypot(px - cx, py - cy) - r) - t / 2, [cx - r - t, cy - r - t, cx + r + t, cy + r + t], o); }
  seg(ax, ay, bx, by, r, o = {}) { return this.stamp((px, py) => sdSeg(px, py, ax, ay, bx, by) - r, [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r], o); }
  poly(P, o = {}) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const g = o.grow ?? 0;
    return this.stamp((px, py) => sdPoly(px, py, P) - g, [x0 - g, y0 - g, x1 + g, y1 + g], o);
  }
  // polyline tube (pipes, cables, veins): pts [[x,y],...], radius r (or per-point r via pts[i][2])
  tube(pts, r, o = {}) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, rm = r;
    for (const p of pts) { const rr = p[2] ?? r; rm = Math.max(rm, rr); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const dist = (px, py) => {
      let d = Infinity;
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        const pax = px - a[0], pay = py - a[1], bax = b[0] - a[0], bay = b[1] - a[1];
        const t = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay || 1));
        const rr = mix(a[2] ?? r, b[2] ?? r, t);
        d = Math.min(d, Math.hypot(pax - bax * t, pay - bay * t) - rr);
      }
      return d;
    };
    return this.stamp(dist, [x0 - rm, y0 - rm, x1 + rm, y1 + rm], o);
  }
  // domed bolt / rivet with a dark ring
  bolt(cx, cy, r = 3, o = {}) {
    this.circle(cx, cy, r + 1.2, { h: -0.6, op: 'add', bevel: 1.5, occl: o.ring ?? 0.75 });
    this.circle(cx, cy, r, { h: o.h ?? r * 0.8, bevel: r, prof: 'round', op: 'add', color: o.color, spec: o.spec ?? 0.5 });
    if (o.slot) this.seg(cx - r * 0.7, cy + r * 0.3, cx + r * 0.7, cy - r * 0.3, 0.45, { h: 0.8, op: 'sub', bevel: 0.5 });
    if (o.hex) this.poly(Array.from({ length: 6 }, (_, k) => [cx + Math.cos(k * Math.PI / 3 + 0.3) * r * 0.75, cy + Math.sin(k * Math.PI / 3 + 0.3) * r * 0.75]), { h: 0.8, op: 'add', bevel: 0.8 });
    return this;
  }

  // ------------------------------------------------------------ canvas masks
  // draw(g, w, h) paints white on black; returns coverage 0..1. wrap draws 3x3 offsets.
  mask(draw, { wrap = true } = {}) {
    const { w, h } = this;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const offs = wrap ? [-1, 0, 1] : [0];
    for (const dy of offs) for (const dx of offs) { g.save(); g.translate(dx * w, dy * h); g.fillStyle = g.strokeStyle = '#fff'; draw(g, w, h); g.restore(); }
    const d = g.getImageData(0, 0, w, h).data, m = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) m[i] = d[i * 4] / 255;
    return m;
  }
  // draw colour art with canvas 2D and composite it over the albedo (alpha-weighted)
  art(draw, { wrap = false, emissive = 0, height = 0, heightOp = 'add' } = {}) {
    const { w, h } = this;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const offs = wrap ? [-1, 0, 1] : [0];
    for (const dy of offs) for (const dx of offs) { g.save(); g.translate(dx * w, dy * h); draw(g, w, h); g.restore(); }
    const d = g.getImageData(0, 0, w, h).data;
    for (let i = 0; i < this.n; i++) {
      const a = d[i * 4 + 3] / 255; if (!a) continue;
      const col = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
      this.setC(i, col, a);
      if (emissive) this.addE(i, col, a * emissive);
      if (height) this.H[i] += a * height;
    }
    return this;
  }
  // box blur with wrap (separable), passes ≈ gaussian
  blur(src, r, passes = 2) {
    const { w, h } = this;
    let a = Float32Array.from(src), b = new Float32Array(this.n);
    r = Math.max(1, Math.round(r));
    const k = 1 / (2 * r + 1);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) {
        const row = y * w; let s = 0;
        for (let x = -r; x <= r; x++) s += a[row + mod(x, w)];
        for (let x = 0; x < w; x++) { b[row + x] = s * k; s += a[row + mod(x + r + 1, w)] - a[row + mod(x - r, w)]; }
      }
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let y = -r; y <= r; y++) s += b[mod(y, h) * w + x];
        for (let y = 0; y < h; y++) { a[y * w + x] = s * k; s += b[mod(y + r + 1, h) * w + x] - b[mod(y - r, h) * w + x]; }
      }
    }
    return a;
  }
  // bevel ramp inside a mask (0 at the edge → 1 at `width` inside)
  bevelOf(m, width) {
    const b = this.blur(m, Math.max(1, width / 2), 2), out = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) out[i] = clamp((b[i] - 0.5) * 2) * m[i] + 0 * b[i];
    return out;
  }
  // apply a mask: { h (height scale), op, color, alpha, spec, E, occl, bevel }
  apply(m, o = {}) {
    const hm = o.bevel ? this.bevelOf(m, o.bevel) : m;
    for (let i = 0; i < this.n; i++) {
      const cov = m[i]; if (cov <= 0.002) continue;
      if (o.h != null) {
        const t = hm[i] * o.h;
        if ((o.op || 'add') === 'add') this.H[i] += t; else if (o.op === 'sub') this.H[i] -= t; else if (o.op === 'set') this.H[i] = mix(this.H[i], t, cov); else if (o.op === 'max') this.H[i] = Math.max(this.H[i], t);
      }
      if (o.color) this.setC(i, typeof o.color === 'function' ? o.color(i, cov) : o.color, cov * (o.alpha ?? 1));
      if (o.spec != null) this.S[i] = mix(this.S[i], o.spec, cov);
      if (o.E) this.addE(i, o.E, cov * (o.eAlpha ?? 1));
      if (o.occl != null) this.O[i] *= mix(1, o.occl, cov);
      if (o.a != null) this.A[i] = mix(this.A[i], o.a, cov);
    }
    return this;
  }
  // soft glow: blurred copy of a mask added as emissive (halos around neon, lamps)
  glow(m, color, r, k = 1, passes = 3) {
    const b = this.blur(m, r, passes);
    for (let i = 0; i < this.n; i++) if (b[i] > 0.001) this.addE(i, color, b[i] * k);
    return this;
  }

  // ------------------------------------------------------------ weathering
  // noise-modulated brightness variation: amount (±), freq (fx,fy), oct
  mottle(amount, fx, fy = fx, oct = 4, seed = 1, fn = null) {
    return this.each((u, v, x, y, i) => {
      if (fn && !fn(i)) return;
      const k = 1 + (fbm(u, v, fx, fy, oct, seed) - 0.5) * 2 * amount;
      this.C[i * 3] *= k; this.C[i * 3 + 1] *= k; this.C[i * 3 + 2] *= k;
    });
  }
  // fine grain (per-pixel) ± amount
  grain(amount, seed = 3) {
    return this.each((u, v, x, y, i) => {
      const k = 1 + (hash(x, y, seed) - 0.5) * 2 * amount;
      this.C[i * 3] *= k; this.C[i * 3 + 1] *= k; this.C[i * 3 + 2] *= k;
    });
  }
  // height micro-roughness
  roughen(amount, fx, fy = fx, oct = 3, seed = 5) {
    return this.each((u, v, x, y, i) => { this.H[i] += (fbm(u, v, fx, fy, oct, seed) - 0.5) * amount; });
  }
  // grime: a dirt colour blended where fn(u,v) > 0 with noise breakup
  grime(col, fn, { fx = 8, fy = 8, seed = 11, contrast = 1.6 } = {}) {
    return this.each((u, v, x, y, i) => {
      const base = fn(u, v, x, y, i); if (base <= 0) return;
      const n = fbm(u, v, fx, fy, 4, seed);
      const a = clamp(base * (0.4 + (n - 0.5) * contrast + 0.6) );
      this.setC(i, col, clamp(a));
    });
  }
  // vertical streaks (rust / water runs) below seams: strength per column from noise
  streaks(col, { amount = 0.35, fx = 48, seed = 21, len = 0.5, start = null } = {}) {
    const { w, h } = this;
    return this.each((u, v, x, y, i) => {
      const colN = vn(u, 0.5, fx, 1, seed) * vn(u, 0.5, fx * 3, 1, seed + 1);
      const s0 = start ? start(u) : 0;
      const dv = mod(v - s0, 1);
      const a = colN * amount * Math.exp(-dv / len) * (0.6 + 0.4 * vn(u, v, fx, 16, seed + 2));
      if (a > 0.003) this.setC(i, col, clamp(a));
    });
  }
  // brighten convex edges (paint wear) — call after the height is final
  edgeWear(col, k = 1, r = 2, seed = 31) {
    const b = this.blur(this.H, r, 1);
    const { w, h } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, cvx = this.H[i] - b[i];
      if (cvx <= 0.05) continue;
      const n = hash(x >> 1, y >> 1, seed);
      const a = clamp(cvx * k * (0.3 + n));
      this.setC(i, col, a);
    }
    return this;
  }

  // ------------------------------------------------------------ bake
  // light: direction toward the light in (x right, y down, z out) — upper-left by default
  bake(o = {}) {
    const { w, h, n } = this;
    let [lx, ly, lz] = o.light || [-0.42, -0.62, 0.66];
    const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    const bump = o.bump ?? 1, amb = o.amb ?? 0.42, specPow = o.specPow ?? 24, specK = o.specK ?? 0.9;
    // cavity AO at several radii
    const aoMul = new Float32Array(n).fill(1);
    for (const [r, k] of o.ao || [[1.5, 0.35], [5, 0.12], [14, 0.05]]) {
      const b = this.blur(this.H, r, 2);
      for (let i = 0; i < n; i++) { const cav = b[i] - this.H[i]; if (cav > 0) aoMul[i] *= Math.exp(-cav * k); }
    }
    // short cast shadows
    const sh = new Float32Array(n);
    const shLen = o.shadow ?? 10, shK = o.shadowK ?? 0.45;
    if (shLen > 0) {
      const hl = Math.hypot(lx, ly), dx = lx / hl, dy = ly / hl, tanE = lz / hl;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, h0 = this.H[i];
        let m = 0;
        for (let t = 1; t <= shLen; t++) {
          const j = mod(Math.round(y + dy * t), h) * w + mod(Math.round(x + dx * t), w);
          const ex = this.H[j] - (h0 + t * tanE);
          if (ex > m) m = ex;
        }
        sh[i] = clamp(m / (o.shadowSoft ?? 2.5));
      }
    }
    const hx = lx, hy = ly, hz = lz + 1, hlen = Math.hypot(hx, hy, hz);
    const Hx = hx / hlen, Hy = hy / hlen, Hz = hz / hlen, flatSpec = Math.pow(Hz, specPow);
    const out = new Uint8ClampedArray(n * 4);
    const grade = o.grade;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = (this.H[y * w + mod(x + 1, w)] - this.H[y * w + mod(x - 1, w)]) * 0.5 * bump;
      const gy = (this.H[mod(y + 1, h) * w + x] - this.H[mod(y - 1, h) * w + x]) * 0.5 * bump;
      let nx = -gx, ny = -gy, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const d = Math.max(0, nx * lx + ny * ly + nz * lz);
      let f = amb + (1 - amb) * d / lz;
      f *= aoMul[i] * this.O[i] * (1 - sh[i] * shK);
      const sp = this.S[i] > 0 ? this.S[i] * specK * Math.max(0, Math.pow(Math.max(0, nx * Hx + ny * Hy + nz * Hz), specPow) - flatSpec * 0.85) * 255 : 0;
      let r = this.C[i * 3] * f + sp + this.E[i * 3], g = this.C[i * 3 + 1] * f + sp + this.E[i * 3 + 1], b = this.C[i * 3 + 2] * f + sp * 0.95 + this.E[i * 3 + 2];
      if (grade) [r, g, b] = grade(r, g, b, x, y, i);
      const o4 = i * 4;
      out[o4] = r; out[o4 + 1] = g; out[o4 + 2] = b; out[o4 + 3] = clamp(this.A[i]) * 255;
    }
    return { w, h, data: out };
  }
}

// Emit helper with contract checks
export async function save(F, dir, name, img) {
  if (!/^[A-Z0-9_]{1,8}$/.test(name)) throw new Error('bad texture name ' + name);
  await F.emit(`${dir}/${name}.png`, img);
}

// Hazard stripes colour function (diagonal), period in px
export function hazard(px, py, period = 32, a = [222, 170, 30], b = [26, 24, 22]) {
  return fract((px + py) / period) < 0.5 ? a : b;
}

// Text coverage mask. o: { font, align ('left'|'center'|'right'), sx (horizontal squash), wrap, spacing (px), base ('alphabetic'|'middle') }
export function textMask(s, str, x, y, o = {}) {
  return s.mask((g) => {
    g.font = o.font || 'bold 16px "DejaVu Sans", sans-serif';
    g.textBaseline = o.base || 'alphabetic';
    const sx = o.sx ?? 1, sp = o.spacing ?? 0;
    const chars = [...str], widths = chars.map((c) => g.measureText(c).width);
    const total = (widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) * sx;
    let x0 = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    g.save(); g.translate(x0, y); g.scale(sx, o.sy ?? 1);
    if (o.rot) g.rotate(o.rot);
    let cx = 0;
    chars.forEach((c, k) => { if (o.stroke) { g.lineWidth = o.stroke; g.lineJoin = 'round'; g.strokeText(c, cx, 0); } else g.fillText(c, cx, 0); cx += widths[k] + sp; });
    g.restore();
  }, { wrap: o.wrap ?? false });
}
export function textWidth(str, font, sx = 1, sp = 0) {
  const c = document.createElement('canvas').getContext('2d'); c.font = font;
  return ([...str].reduce((a, ch) => a + c.measureText(ch).width, 0) + sp * (str.length - 1)) * sx;
}

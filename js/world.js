// Collision world: a smooth terrain heightfield plus axis-aligned boxes.
// Renderer-free (no three.js): the sim and the Node checks both use it.
//
// Why AABBs + heightfield: it is the smallest model that gives an FPS
// everything it needs (stairs, crates to mantle, catwalks to walk under,
// rolling canyon ground) with exact, cheap ray tests and a ground-layer nav
// grid that falls straight out of it. Rotated wreckage is render-only dressing
// over axis-aligned colliders.
import { TUNING as T } from './tuning.js';

const CELL = 4; // spatial hash cell, metres
export const DEEP = 1.0; // water deeper than this over the floor is a hazard (armour sinks)

export class CollisionWorld {
  constructor(level) {
    this.bounds = level.bounds; // {x0, z0, x1, z1}
    this.boxes = level.boxes.filter((b) => b.solid !== false);
    this.off = new Set(); // indices of boxes switched off (opened doors)
    this.killY = level.killY ?? -30;
    this._stamp = 0;
    this._seen = new Uint32Array(this.boxes.length);
    this._buildTerrain(level.terrain);
    this._buildHash();
  }

  // ------------------------------------------------------------ terrain
  _buildTerrain(t) {
    const b = this.bounds;
    const res = t?.res || 2;
    const nx = Math.ceil((b.x1 - b.x0) / res) + 1, nz = Math.ceil((b.z1 - b.z0) / res) + 1;
    this.tres = res; this.tnx = nx; this.tnz = nz;
    this.th = new Float32Array(nx * nz);
    const fn = t?.fn || (() => 0);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) this.th[j * nx + i] = fn(b.x0 + i * res, b.z0 + j * res);
  }

  terrainH(x, z) {
    const b = this.bounds, r = this.tres;
    let fx = (x - b.x0) / r, fz = (z - b.z0) / r;
    fx = Math.max(0, Math.min(this.tnx - 1.001, fx));
    fz = Math.max(0, Math.min(this.tnz - 1.001, fz));
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, n = this.tnx, h = this.th;
    const a = h[j * n + i], c = h[j * n + i + 1], d = h[(j + 1) * n + i], e = h[(j + 1) * n + i + 1];
    return (a * (1 - u) + c * u) * (1 - v) + (d * (1 - u) + e * u) * v;
  }

  terrainSlope(x, z) {
    const e = 0.5;
    const gx = (this.terrainH(x + e, z) - this.terrainH(x - e, z)) / (2 * e);
    const gz = (this.terrainH(x, z + e) - this.terrainH(x, z - e)) / (2 * e);
    return { gx, gz, m: Math.hypot(gx, gz) };
  }

  // ------------------------------------------------------------ boxes
  _buildHash() {
    this.hash = new Map();
    this.boxes.forEach((bx, idx) => {
      for (let i = Math.floor(bx.min[0] / CELL); i <= Math.floor(bx.max[0] / CELL); i++) {
        for (let j = Math.floor(bx.min[2] / CELL); j <= Math.floor(bx.max[2] / CELL); j++) {
          const k = i * 73856093 ^ j * 19349663;
          let a = this.hash.get(k);
          if (!a) this.hash.set(k, (a = []));
          a.push(idx);
        }
      }
    });
  }

  // Boxes whose XZ footprint touches the rect [x0,x1]×[z0,z1]; callback(box, idx).
  near(x0, z0, x1, z1, cb) {
    const st = ++this._stamp;
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
        const a = this.hash.get(i * 73856093 ^ j * 19349663);
        if (!a) continue;
        for (const idx of a) {
          if (this._seen[idx] === st || this.off.has(idx)) continue;
          this._seen[idx] = st;
          const b = this.boxes[idx];
          if (b.max[0] < x0 || b.min[0] > x1 || b.max[2] < z0 || b.min[2] > z1) continue;
          cb(b, idx);
        }
      }
    }
  }

  // Highest standable surface under a circle whose feet are at feetY (may be
  // up to `reach` above the feet: that is how steps work).
  groundAt(x, z, feetY, r = 0.3, reach = T.stepHeight) {
    let g = this.terrainH(x, z);
    const rr = r * 0.7; // a sliver of foot on a ledge does not hold you up
    this.near(x - rr, z - rr, x + rr, z + rr, (b) => {
      if (b.max[1] > feetY + reach + 1e-3 || b.max[1] <= g) return;
      if (circleRect(x, z, rr, b)) g = b.max[1];
    });
    return g;
  }

  ceilingAt(x, z, feetY, r = 0.3) {
    let c = Infinity;
    this.near(x - r, z - r, x + r, z + r, (b) => {
      if (b.min[1] >= feetY + 0.2 && b.min[1] < c && circleRect(x, z, r * 0.9, b)) c = b.min[1];
    });
    return c;
  }

  // Push a vertical cylinder out of every box that overlaps it between
  // feet+step and head. Mutates p {x, z}. Returns true if it touched a wall.
  resolve(p, r, feetY, headY, step = T.stepHeight) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      this.near(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
        if (b.max[1] <= feetY + step || b.min[1] >= headY) return;
        const cx = Math.max(b.min[0], Math.min(p.x, b.max[0]));
        const cz = Math.max(b.min[2], Math.min(p.z, b.max[2]));
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        hit = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), push = r - d;
          p.x += (dx / d) * push; p.z += (dz / d) * push;
        } else { // centre inside the box: leave along the shallowest axis
          const l = p.x - b.min[0], rr = b.max[0] - p.x, f = p.z - b.min[2], bk = b.max[2] - p.z;
          const m = Math.min(l, rr, f, bk);
          if (m === l) p.x = b.min[0] - r; else if (m === rr) p.x = b.max[0] + r;
          else if (m === f) p.z = b.min[2] - r; else p.z = b.max[2] + r;
        }
      });
    }
    const bd = this.bounds;
    if (p.x < bd.x0 + r) { p.x = bd.x0 + r; hit = true; }
    if (p.x > bd.x1 - r) { p.x = bd.x1 - r; hit = true; }
    if (p.z < bd.z0 + r) { p.z = bd.z0 + r; hit = true; }
    if (p.z > bd.z1 - r) { p.z = bd.z1 - r; hit = true; }
    return hit;
  }

  // Is a point inside solid geometry?
  solidAt(x, y, z) {
    if (y < this.terrainH(x, z)) return true;
    let s = false;
    this.near(x, z, x, z, (b) => { if (y > b.min[1] && y < b.max[1]) s = true; });
    return s;
  }

  // ------------------------------------------------------------ rays
  // Ray from o along unit d up to maxT. Returns {t, n:[x,y,z], box, terrain} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null, bestT = maxT;
    // 2D DDA over hash cells so long rays stay cheap.
    let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity;
    const tdz = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
    let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / Math.abs(dx)) : Infinity;
    let tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (cz + 1) * CELL - oz : oz - cz * CELL) / Math.abs(dz)) : Infinity;
    const st = ++this._stamp;
    let tCell = 0;
    for (let guard = 0; guard < 400 && tCell <= bestT; guard++) {
      const a = this.hash.get(cx * 73856093 ^ cz * 19349663);
      if (a) {
        for (const idx of a) {
          if (this._seen[idx] === st || this.off.has(idx)) continue;
          this._seen[idx] = st;
          const b = this.boxes[idx];
          if (b.noRay) continue;
          const h = rayBox(ox, oy, oz, dx, dy, dz, b, bestT);
          if (h) { bestT = h.t; best = { t: h.t, n: h.n, box: b }; }
        }
      }
      if (tmx < tmz) { tCell = tmx; tmx += tdx; cx += sx; } else { tCell = tmz; tmz += tdz; cz += sz; }
    }
    // Terrain: march, then bisect. 0.4 m steps are finer than any ledge.
    const tt = this._rayTerrain(ox, oy, oz, dx, dy, dz, bestT);
    if (tt !== null && tt < bestT) {
      const x = ox + dx * tt, z = oz + dz * tt, s = this.terrainSlope(x, z);
      const n = norm3(-s.gx, 1, -s.gz);
      best = { t: tt, n, terrain: true };
    }
    return best;
  }

  _rayTerrain(ox, oy, oz, dx, dy, dz, maxT) {
    let prevT = 0, prevAbove = oy - this.terrainH(ox, oz);
    if (prevAbove < 0) return 0;
    const step = 0.4;
    for (let t = step; t <= maxT + step; t += step) {
      const tc = Math.min(t, maxT);
      const x = ox + dx * tc, y = oy + dy * tc, z = oz + dz * tc;
      const above = y - this.terrainH(x, z);
      if (above < 0) {
        let lo = prevT, hi = tc;
        for (let i = 0; i < 6; i++) {
          const m = (lo + hi) / 2;
          if (oy + dy * m - this.terrainH(ox + dx * m, oz + dz * m) < 0) hi = m; else lo = m;
        }
        return lo;
      }
      prevT = tc; prevAbove = above;
      if (tc >= maxT) break;
    }
    return null;
  }

  // Clear line between two points (for AI sight and explosions)?
  clear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / L, dy / L, dz / L, L - 0.05);
  }
}

export function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let t0 = 0, t1 = maxT, axis = -1, sign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < b.min[a] || o[a] > b.max[a]) return null;
      continue;
    }
    const inv = 1 / d[a];
    let tn = (b.min[a] - o[a]) * inv, tf = (b.max[a] - o[a]) * inv;
    let s = -1;
    if (tn > tf) { const q = tn; tn = tf; tf = q; s = 1; }
    if (tn > t0) { t0 = tn; axis = a; sign = s; }
    if (tf < t1) t1 = tf;
    if (t0 > t1) return null;
  }
  if (axis < 0) return null; // started inside
  const n = [0, 0, 0];
  n[axis] = sign;
  return { t: t0, n };
}

export function circleRect(x, z, r, b) {
  const cx = Math.max(b.min[0], Math.min(x, b.max[0]));
  const cz = Math.max(b.min[2], Math.min(z, b.max[2]));
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
}

function norm3(x, y, z) { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }

// ------------------------------------------------------------ nav grid
// One walkable layer: the ground plus low platforms. Catwalks overhead are
// ignored (you walk under them); enemies placed up there are "perched".
export class NavGrid {
  constructor(geo, level) {
    const b = geo.bounds, s = T.navStep;
    this.geo = geo; this.s = s; this.x0 = b.x0; this.z0 = b.z0;
    this.nx = Math.floor((b.x1 - b.x0) / s); this.nz = Math.floor((b.z1 - b.z0) / s);
    const N = this.nx * this.nz;
    this.floor = new Float32Array(N);
    this.walk = new Uint8Array(N);
    this.dist = new Int32Array(N).fill(-1);
    this.water = level.water || [];
    this.build();
  }

  build() {
    const g = this.geo, s = this.s, inf = 0.45;
    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x = this.x0 + (i + 0.5) * s, z = this.z0 + (j + 0.5) * s, k = j * this.nx + i;
        const th = g.terrainH(x, z);
        let fl = th;
        g.near(x - 0.2, z - 0.2, x + 0.2, z + 0.2, (bx) => {
          if (bx.max[1] <= th + 1.3 && bx.max[1] > fl && bx.min[1] <= th + 0.2) fl = bx.max[1];
        });
        let ok = g.terrainSlope(x, z).m <= T.maxSlope || fl > th + 0.05;
        if (ok) {
          g.near(x - inf, z - inf, x + inf, z + inf, (bx) => {
            if (bx.max[1] > fl + T.stepHeight && bx.min[1] < fl + 1.8) ok = false;
          });
        }
        if (ok) for (const w of this.water) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && fl < w.y - DEEP) ok = false;
        this.floor[k] = fl;
        this.walk[k] = ok ? 1 : 0;
      }
    }
  }

  cellOf(x, z) {
    const i = Math.floor((x - this.x0) / this.s), j = Math.floor((z - this.z0) / this.s);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }

  center(k) { return { x: this.x0 + ((k % this.nx) + 0.5) * this.s, z: this.z0 + (Math.floor(k / this.nx) + 0.5) * this.s }; }

  // Nearest walkable cell to (x, z) within a few cells (the player can stand
  // on a crate or catwalk the grid does not know about).
  nearestWalk(x, z, rad = 4) {
    const c = this.cellOf(x, z);
    if (c >= 0 && this.walk[c]) return c;
    const ci = Math.floor((x - this.x0) / this.s), cj = Math.floor((z - this.z0) / this.s);
    let best = -1, bd = Infinity;
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
      const k = j * this.nx + i;
      if (!this.walk[k]) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  // Neighbours are linked if both are walkable and the floor step is small.
  linked(a, b) {
    return this.walk[a] && this.walk[b] && Math.abs(this.floor[a] - this.floor[b]) <= 0.62;
  }

  // Dial's algorithm (costs 10 / 14) from a source cell: distance field that
  // every chasing enemy descends. One field serves the whole squad.
  flowFrom(src, maxCost = 2600) {
    const D = this.dist, nx = this.nx, nz = this.nz;
    D.fill(-1);
    if (src < 0) return;
    const B = 15, buckets = Array.from({ length: B }, () => []);
    D[src] = 0; buckets[0].push(src);
    let cur = 0, pending = 1;
    const di = [1, -1, 0, 0, 1, 1, -1, -1], dj = [0, 0, 1, -1, 1, -1, 1, -1];
    while (pending > 0 && cur <= maxCost) {
      const bk = buckets[cur % B];
      while (bk.length) {
        const k = bk.pop(); pending--;
        if (D[k] !== cur) continue;
        const i = k % nx, j = (k / nx) | 0;
        for (let n = 0; n < 8; n++) {
          const ii = i + di[n], jj = j + dj[n];
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const q = jj * nx + ii;
          if (!this.linked(k, q)) continue;
          if (n >= 4 && (!this.linked(k, j * nx + ii) || !this.linked(k, jj * nx + i))) continue; // no corner cutting
          const nd = cur + (n < 4 ? 10 : 14);
          if (D[q] === -1 || nd < D[q]) { D[q] = nd; buckets[nd % B].push(q); pending++; }
        }
      }
      cur++;
    }
  }

  // Reachability from a cell (for the level checker), ignoring maxCost.
  reachable(src) {
    const seen = new Uint8Array(this.walk.length), q = [src], nx = this.nx, nz = this.nz;
    if (src < 0) return seen;
    seen[src] = 1;
    while (q.length) {
      const k = q.pop(), i = k % nx, j = (k / nx) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const n = jj * nx + ii;
        if (!seen[n] && this.linked(k, n)) { seen[n] = 1; q.push(n); }
      }
    }
    return seen;
  }

  // Best neighbouring cell to step into: toward (sign=-1) or away (+1) from the source.
  stepDir(x, z, sign = -1) {
    const k = this.cellOf(x, z);
    if (k < 0 || this.dist[k] < 0) return null;
    const i = k % this.nx, j = (k / this.nx) | 0;
    let best = null, bv = this.dist[k];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= this.nx || jj >= this.nz) continue;
      const q = jj * this.nx + ii;
      if (this.dist[q] < 0 || !this.linked(k, q)) continue;
      if (di && dj && (!this.linked(k, j * this.nx + ii) || !this.linked(k, jj * this.nx + i))) continue;
      const v = this.dist[q];
      if (sign < 0 ? v < bv : v > bv) { bv = v; best = q; }
    }
    if (best === null) return null;
    const c = this.center(best);
    const dx = c.x - x, dz = c.z - z, L = Math.hypot(dx, dz) || 1;
    return { x: dx / L, z: dz / L };
  }

  walkableAt(x, z) { const k = this.cellOf(x, z); return k >= 0 && this.walk[k] === 1; }
}

// Particles, decals and pooled lights.
//
// Every particle is one instance of a camera-facing quad in one of two
// InstancedMeshes (additive glow / alpha smoke), sampling a 2×2 atlas:
// [glow, smoke, star, splat]. Two draw calls for all FX, whatever is on
// screen: tablets care (template docs/14 #17: no per-projectile lights).
import * as THREE from 'three';
import { spriteTex } from './textures.js';

const MAX = 900;

function atlas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const put = (name, x, y) => { const img = spriteTex(name).image; g.drawImage(img, x, y, 128, 128); };
  put('glow', 0, 0); put('smoke', 128, 0); put('flash', 0, 128); put('splat', 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VS = /* glsl */ `
  attribute vec4 iPos;   // xyz, size
  attribute vec4 iCol;   // rgba
  attribute vec4 iMisc;  // rotation, tile, stretch, unused
  varying vec2 vUv; varying vec4 vCol;
  void main() {
    vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
    float c = cos(iMisc.x), s = sin(iMisc.x);
    vec2 p = vec2(position.x, position.y * iMisc.z);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) * iPos.w;
    mv.xy += p;
    gl_Position = projectionMatrix * mv;
    float tile = iMisc.y;
    vUv = (uv + vec2(mod(tile, 2.0), 1.0 - floor(tile / 2.0))) * 0.5;
    vCol = iCol;
  }`;
const FS = /* glsl */ `
  uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
  void main() {
    vec4 t = texture2D(map, vUv);
    gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
    if (gl_FragColor.a < 0.004) discard;
  }`;

class Layer {
  constructor(tex, additive) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
    this.pos = new Float32Array(MAX * 4); this.col = new Float32Array(MAX * 4); this.misc = new Float32Array(MAX * 4);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iMisc', new THREE.InstancedBufferAttribute(this.misc, 4).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 19;
    this.geo = geo;
    this.list = [];
  }
}

export class FX {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    const tex = atlas();
    this.add = new Layer(tex, true);
    this.alpha = new Layer(tex, false);
    scene.add(this.add.mesh, this.alpha.mesh);
    this.budget = quality === 'low' ? 0.55 : 1;
    this.shake = 0;
    this._c = new THREE.Color();
    // decals: bullet holes (dark) + splats/scorches (tinted)
    const holeMat = new THREE.MeshBasicMaterial({ map: spriteTex('hole'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const splatMat = new THREE.MeshBasicMaterial({ map: spriteTex('splat'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, color: 0xffffff });
    this.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), holeMat, 90);
    this.splats = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), splatMat, 50);
    for (const m of [this.holes, this.splats]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 5; scene.add(m); }
    this.holeI = 0; this.splatI = 0;
    this.splats.setColorAt(0, new THREE.Color(1, 1, 1));
  }

  clear() {
    this.add.list.length = 0; this.alpha.list.length = 0;
    this.holes.count = 0; this.splats.count = 0; this.holeI = this.splatI = 0;
  }

  // o: {p:[x,y,z], v:[x,y,z], life, size, size1, color, alpha, alpha1, tile, rot, spin, grav, drag, stretch, additive, stat}
  spawn(o) {
    const L = o.additive === false ? this.alpha : this.add;
    if (L.list.length >= MAX) return;
    L.list.push({
      x: o.p[0], y: o.p[1], z: o.p[2], vx: o.v?.[0] || 0, vy: o.v?.[1] || 0, vz: o.v?.[2] || 0,
      t: 0, life: o.life ?? 0.5, s0: o.size ?? 0.3, s1: o.size1 ?? o.size ?? 0.3, col: new THREE.Color(o.color ?? 0xffffff),
      a0: o.alpha ?? 1, a1: o.alpha1 ?? 0, tile: o.tile ?? 0, rot: o.rot ?? Math.random() * 6.28, spin: o.spin ?? 0,
      grav: o.grav ?? 0, drag: o.drag ?? 0, stretch: o.stretch ?? 1, stat: !!o.stat, follow: o.follow || null,
    });
  }

  // ---- recipes -------------------------------------------------------
  sparks(p, n = 8, color = 0xffd080, speed = 6) {
    n = Math.ceil(n * this.budget);
    for (let i = 0; i < n; i++) {
      const v = [(Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed];
      this.spawn({ p, v, life: 0.25 + Math.random() * 0.25, size: 0.08, size1: 0.02, color, tile: 0, grav: 12, stretch: 2.5 });
    }
    this.spawn({ p, life: 0.08, size: 0.6, size1: 0.2, color, tile: 2 });
  }
  puff(p, n = 3, color = 0x9a9088, size = 0.5) {
    n = Math.ceil(n * this.budget);
    for (let i = 0; i < n; i++) this.spawn({ p: [p[0] + (Math.random() - 0.5) * 0.3, p[1], p[2] + (Math.random() - 0.5) * 0.3], v: [(Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8],
      life: 0.8 + Math.random() * 0.6, size, size1: size * 3, color, alpha: 0.5, tile: 1, additive: false, spin: (Math.random() - 0.5) * 2, drag: 1.5 });
  }
  blood(p, color = 0x3affc8, n = 7) {
    n = Math.ceil(n * this.budget);
    for (let i = 0; i < n; i++) this.spawn({ p, v: [(Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4], life: 0.4 + Math.random() * 0.3, size: 0.12, size1: 0.2, color, alpha: 0.9, tile: 3, grav: 10, additive: false });
    this.spawn({ p, life: 0.25, size: 0.5, size1: 0.9, color, alpha: 0.5, tile: 0 });
  }
  shieldFlare(p, color = 0x9b6bff, big = false) {
    this.spawn({ p, life: big ? 0.45 : 0.18, size: big ? 1.4 : 0.5, size1: big ? 3.2 : 1.0, color, tile: 0, alpha: 0.9 });
    const n = big ? 22 : 5;
    for (let i = 0; i < n * this.budget; i++) this.spawn({ p, v: [(Math.random() - 0.5) * 7, (Math.random() - 0.3) * 7, (Math.random() - 0.5) * 7], life: 0.35, size: 0.1, size1: 0.02, color, tile: 0, drag: 3, stretch: 2 });
  }
  plasmaSplash(p, color, big = false) {
    this.spawn({ p, life: big ? 0.35 : 0.2, size: big ? 1.8 : 0.6, size1: big ? 3 : 1.2, color, tile: 0 });
    for (let i = 0; i < (big ? 14 : 6) * this.budget; i++) this.spawn({ p, v: [(Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5], life: 0.3, size: 0.12, size1: 0.02, color, grav: 6, tile: 0 });
  }
  explosion(p, r = 5, kind = 'frag') {
    const col = kind === 'plasma' ? 0x6fc8ff : kind === 'lance' ? 0x9dff5f : kind === 'needle' ? 0xff6fe0 : kind === 'big' ? 0xd35bff : 0xffa040;
    this.spawn({ p, life: 0.18, size: r * 1.4, size1: r * 2.4, color: 0xffffff, tile: 2, alpha: 0.9 });
    this.spawn({ p, life: 0.45, size: r * 0.8, size1: r * 2.0, color: col, tile: 0 });
    for (let i = 0; i < 16 * this.budget; i++) {
      const v = [(Math.random() - 0.5) * r * 2.4, Math.random() * r * 1.6, (Math.random() - 0.5) * r * 2.4];
      this.spawn({ p, v, life: 0.5 + Math.random() * 0.4, size: r * 0.25, size1: r * 0.45, color: col, alpha: 0.9, tile: 0, drag: 3.5 });
    }
    for (let i = 0; i < 14 * this.budget; i++) this.spawn({ p, v: [(Math.random() - 0.5) * 16, Math.random() * 12, (Math.random() - 0.5) * 16], life: 0.6 + Math.random() * 0.5, size: 0.1, size1: 0.03, color: 0xffe0a0, grav: 14, stretch: 3 });
    if (kind === 'frag' || kind === 'big') for (let i = 0; i < 8 * this.budget; i++) this.spawn({ p: [p[0], p[1] + 0.5, p[2]], v: [(Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3], life: 1.6 + Math.random(), size: r * 0.3, size1: r * 0.9, color: 0x3a3430, alpha: 0.7, tile: 1, additive: false, drag: 1.2, spin: (Math.random() - 0.5) });
    this.shake = Math.max(this.shake, 0.5);
  }
  muzzle(p, color = 0xffd8a0, s = 1) {
    this.spawn({ p, life: 0.05, size: 0.5 * s, size1: 0.3 * s, color, tile: 2 });
  }

  // decal on a surface: n = normal
  decal(kind, p, n, size = 0.14, color) {
    const m = kind === 'hole' ? this.holes : this.splats;
    const idx = kind === 'hole' ? this.holeI++ % m.instanceMatrix.count : this.splatI++ % m.instanceMatrix.count;
    const o = new THREE.Object3D();
    o.position.set(p[0] + n[0] * 0.01, p[1] + n[1] * 0.01, p[2] + n[2] * 0.01);
    o.lookAt(p[0] + n[0], p[1] + n[1], p[2] + n[2]);
    o.rotateZ(Math.random() * 6.28);
    o.scale.setScalar(size);
    o.updateMatrix();
    m.setMatrixAt(idx, o.matrix);
    if (kind !== 'hole') { m.setColorAt(idx, this._c.set(color ?? 0x101010)); m.instanceColor.needsUpdate = true; }
    m.count = Math.min(m.instanceMatrix.count, Math.max(m.count, idx + 1));
    m.instanceMatrix.needsUpdate = true;
  }

  update(dt, cam) {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    for (const L of [this.add, this.alpha]) {
      const list = L.list;
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        if (!q.stat) {
          q.t += dt;
          if (q.t >= q.life) continue;
          q.vy -= q.grav * dt;
          if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; q.vz *= k; }
          q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          q.rot += q.spin * dt;
        }
        list[n++] = q;
      }
      list.length = n;
      const P = L.pos, C = L.col, M = L.misc;
      for (let i = 0; i < n; i++) {
        const q = list[i], k = q.stat ? 0 : q.t / q.life, j = i * 4;
        let x = q.x, y = q.y, z = q.z;
        if (q.follow) { x = q.follow.x; y = q.follow.y; z = q.follow.z; }
        P[j] = x; P[j + 1] = y; P[j + 2] = z; P[j + 3] = q.s0 + (q.s1 - q.s0) * k;
        const a = q.a0 + (q.a1 - q.a0) * k;
        C[j] = q.col.r; C[j + 1] = q.col.g; C[j + 2] = q.col.b; C[j + 3] = q.stat ? q.a0 * (0.85 + 0.15 * Math.sin(performance.now() * 0.004 + i)) : a;
        let rot = q.rot;
        if (q.stretch !== 1 && !q.stat && cam) {
          // align the long axis with the screen-space velocity
          const v = new THREE.Vector3(q.vx, q.vy, q.vz).transformDirection(cam.matrixWorldInverse);
          rot = Math.atan2(v.y, v.x) - Math.PI / 2;
        }
        M[j] = rot; M[j + 1] = q.tile; M[j + 2] = q.stretch; M[j + 3] = 0;
      }
      L.geo.instanceCount = n;
      L.geo.attributes.iPos.needsUpdate = true; L.geo.attributes.iCol.needsUpdate = true; L.geo.attributes.iMisc.needsUpdate = true;
    }
  }
}

// A handful of real point lights, re-aimed every frame: the nearest level
// lamps plus short flashes (muzzle, explosions). A fixed count means the
// shaders never recompile.
export class LightPool {
  constructor(scene, nStatic, nFlash) {
    this.stat = []; this.flash = [];
    for (let i = 0; i < nStatic; i++) { const l = new THREE.PointLight(0xffffff, 0, 20, 1.6); scene.add(l); this.stat.push(l); }
    for (let i = 0; i < nFlash; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); this.flash.push({ l, t: 0, life: 0, i0: 0 }); }
    this.fi = 0;
    this.lamps = [];
  }
  setLamps(lamps) { this.lamps = lamps; }
  pulse(p, color, intensity = 3, dist = 8, life = 0.08) {
    const f = this.flash[this.fi++ % this.flash.length];
    f.l.position.set(p[0], p[1], p[2]); f.l.color.set(color); f.l.distance = dist; f.t = 0; f.life = life; f.i0 = intensity;
  }
  update(dt, cx, cy, cz) {
    for (const f of this.flash) {
      f.t += dt;
      f.l.intensity = f.t < f.life ? f.i0 * (1 - f.t / f.life) : 0;
    }
    if (!this.lamps.length) { for (const l of this.stat) l.intensity = 0; return; }
    const near = this.lamps.map((L) => ({ L, d: (L.p[0] - cx) ** 2 + (L.p[1] - cy) ** 2 + (L.p[2] - cz) ** 2 })).sort((a, b) => a.d - b.d);
    this.stat.forEach((l, i) => {
      const n = near[i];
      if (!n) { l.intensity = 0; return; }
      l.position.set(n.L.p[0], n.L.p[1], n.L.p[2]);
      l.color.set(n.L.color); l.distance = n.L.dist || 18;
      // fade by distance so swapping which lamp owns a light never pops
      const fade = Math.max(0, 1 - Math.sqrt(n.d) / 60);
      l.intensity = (n.L.intensity ?? 1) * 2.4 * fade;
    });
  }
}

// MAP03 crash-site props (sprites/props, rotation 0).
import { kit, prop } from '../lib/env/kit.js';
import { rng, Surf, clamp, fbm, hash, mix } from '../lib/env/tex.js';
import { A, hullPlates } from '../lib/env/alien.js';

export default async function (F) {
  const K = kit(F);
  const { THREE, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, decal, basic, group, M } = K;
  const P = K.P;
  const only = null;
  const want = (n) => !only || only.includes(n);

  // needle-spray card: a twig with drooping needle tufts on transparent ground
  const needleTex = (seed, col = [44, 74, 44]) => canvasTex(128, 64, (g, w, h) => {
    const r = rng(seed);
    g.lineCap = 'round';
    const twig = (x0, y0, x1, y1, n, len, width) => {
      g.strokeStyle = '#3a2a1c'; g.lineWidth = width; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      for (let k = 0; k < n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        for (const s2 of [-1, 1]) {
          const a = Math.atan2(y1 - y0, x1 - x0) + s2 * (0.9 + r() * 0.5), L = len * (1 - t * 0.5) * (0.6 + r() * 0.5);
          const kk = 0.7 + r() * 0.5;
          g.strokeStyle = `rgb(${col[0] * kk | 0},${col[1] * kk | 0},${col[2] * kk | 0})`; g.lineWidth = 1.3 + r();
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L + L * 0.25); g.stroke();
        }
      }
    };
    twig(2, 32, 126, 30 + (r() - 0.5) * 6, 46, 16, 2.4);
    for (let k = 0; k < 5; k++) { const x = 20 + k * 20; twig(x, 31, x + 26, 31 + (r() < 0.5 ? -1 : 1) * (10 + r() * 8), 12, 10, 1.2); }
  });

  // ------------------------------------------------------------ DTRE: tall pine
  if (want('DTRE')) {
    const root = new THREE.Group();
    const bark = M(0x4a3626, { rough: 0.95, detail: 'wool' });
    add(root, lathe(bark, [[0, 0], [0.26, 0], [0.2, 0.3], [0.16, 2], [0.1, 6], [0.04, 9.2], [0, 9.3]], 10));
    const mats = [needleTex(1), needleTex(2, [38, 66, 40]), needleTex(3, [52, 82, 48])].map((t) => new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
    const r = rng(7);
    const tiers = 13;
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1), y = 1.8 + f * 7.1, len = 2.4 * Math.pow(1 - f, 0.9) + 0.35;
      const per = t < tiers - 2 ? 8 : 5;
      for (let k = 0; k < per; k++) {
        const a = k / per * Math.PI * 2 + t * 0.7 + r() * 0.4;
        const card = new THREE.Mesh(new THREE.PlaneGeometry(len, len * 0.5), mats[(t + k) % 3]);
        card.geometry.translate(len / 2, 0, 0);
        const g = new THREE.Group(); g.add(card); card.rotation.z = -0.28 - r() * 0.25 - f * 0.1; card.rotation.x = (r() - 0.5) * 0.8;
        g.rotation.y = a; g.position.y = y + (r() - 0.5) * 0.2; root.add(g);
      }
    }
    // inner filler so the crown isn't see-through
    add(root, new THREE.Mesh(new THREE.ConeGeometry(0.75, 6.2, 10, 1, true), M(0x14200f, { rough: 1, detail: 'wool' })), 0, 5.3, 0);
    add(root, new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.3, 8, 1, true), mats[2]), 0, 9.1, 0);
    await prop(F, { prefix: 'DTRE', root, w: 5.6, top: 9.8, yaw: 0, elev: 6, lights: { hemi: 1.4, key: 2.2 } });
  }

  // ------------------------------------------------------------ DBSH: bush
  if (want('DBSH')) {
    const root = new THREE.Group();
    const leafTex = canvasTex(96, 96, (g, w, h) => {
      const r = rng(11);
      for (let k = 0; k < 90; k++) {
        const x = 10 + r() * 76, y = 10 + r() * 76, a = r() * 6.28, kk = 0.6 + r() * 0.6;
        g.fillStyle = `rgb(${50 * kk | 0},${78 * kk | 0},${40 * kk | 0})`;
        g.beginPath(); g.ellipse(x, y, 7, 3.2, a, 0, 7); g.fill();
      }
    });
    const lm = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    const r = rng(12);
    add(root, sphere(M(0x121a0e, { rough: 1 }), 0.4, 12, 8), 0, 0.42, 0).scale.set(1.2, 0.8, 1.0);
    for (let k = 0; k < 70; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), lm);
      const a = r() * 6.28, rr = 0.25 + r() * 0.45, hy = r();
      add(root, c, Math.cos(a) * rr * 1.3 * (1 - hy * 0.4), 0.2 + hy * 0.85, Math.sin(a) * rr * (1 - hy * 0.4), r() * 3, r() * 3, r() * 3);
    }
    for (let k = 0; k < 5; k++) { const a = r() * 6.28; add(root, taper(M(0x3a2a1c), [[0, 0, 0], [Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3], [Math.cos(a) * 0.5, 0.8, Math.sin(a) * 0.5]], (t) => 0.02 * (1 - t * 0.7), 8, 4)); }
    await prop(F, { prefix: 'DBSH', root, w: 2.0, top: 1.5, yaw: 0, elev: 10 });
  }

  // ------------------------------------------------------------ DTNT: army tent
  if (want('DTNT')) {
    const root = new THREE.Group();
    const cs = new Surf(128, 128);
    cs.each((u, v, x, y, i) => { const wv = ((x + (y >> 1)) % 3 === 0 ? -0.05 : 0.02) + (hash(x, y, 3) - 0.5) * 0.06, n = fbm(u, v, 4, 4, 4, 4); const k = 0.82 + n * 0.25 + wv; cs.setC(i, [92 * k, 94 * k, 62 * k]); });
    const canvas = K.texMat(K.surfTex(cs, { repeat: [0.8, 0.8] }), { rough: 0.95, side: THREE.DoubleSide });
    const L = 4.4, Wd = 3.2, wall = 1.3, ridge = 2.6;
    const prof = [[-Wd / 2, 0], [Wd / 2, 0], [Wd / 2, wall], [0, ridge], [-Wd / 2, wall]];
    const body = extrude(canvas, prof, L, 0.02); body.rotation.y = Math.PI / 2; root.add(body);
    // eaves overhang and a rolled-up door flap with a dark opening
    for (const s2 of [-1, 1]) add(root, box(canvas, L + 0.2, 0.02, 0.35, 0.005), 0, wall + 0.08, s2 * (Wd / 2 + 0.12), s2 * 0.62, 0, 0);
    const door = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([[-0.6, 0], [0.6, 0], [0.6, 1.5], [0, 1.9], [-0.6, 1.5]].map(([x, y]) => new THREE.Vector2(x, y)))), new THREE.MeshBasicMaterial({ color: 0x0c0c0a }));
    add(root, door, L / 2 + 0.025, 0, 0, 0, Math.PI / 2, 0);
    add(root, cyl(canvas, 0.1, 1.3, 10), L / 2 + 0.06, 1.6, 0, Math.PI / 2, 0, 0);
    add(root, cyl(M(0x6a5a40), 0.035, 2.7, 8), L / 2 + 0.1, 1.3, 0);
    // guy ropes and stakes
    const rope = M(0xb8a878, { rough: 0.9 });
    for (const x of [-1.8, -0.6, 0.6, 1.8]) for (const s2 of [-1, 1]) { add(root, tube(rope, [[x, wall + 0.1, s2 * Wd / 2], [x, 0.6, s2 * (Wd / 2 + 0.9)], [x, 0.05, s2 * (Wd / 2 + 1.5)]], 0.008, 6, 4)); add(root, cyl(M(0x333333), 0.015, 0.2, 5), x, 0.05, s2 * (Wd / 2 + 1.5)); }
    const st = canvasTex(128, 64, (g) => { g.fillStyle = 'rgba(30,30,20,0.75)'; g.font = 'bold 26px "DejaVu Sans Mono", monospace'; g.textAlign = 'center'; g.fillText('CP-2', 64, 30); g.font = 'bold 12px "DejaVu Sans Mono", monospace'; g.fillText('US ARMY', 64, 52); });
    add(root, decal(st, 0.9, 0.45), 0.4, 0.8, Wd / 2 + 0.03);
    await prop(F, { prefix: 'DTNT', root, w: 6.2, top: 3.2, yaw: -0.6, elev: 12 });
  }

  // ------------------------------------------------------------ DFLD: floodlight on a tripod
  if (want('DFLD')) {
    const root = new THREE.Group();
    const steel = M(0x5c6064, { metal: 0.6, rough: 0.45 }), yel = M(0xc8a030, { rough: 0.5, metal: 0.3 });
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.3; add(root, tube(steel, [[Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9], [0, 1.2, 0]], 0.025, 4, 6)); }
    add(root, cyl(steel, 0.035, 1.9, 10), 0, 1.95, 0);
    add(root, box(steel, 1.3, 0.06, 0.06, 0.01), 0, 2.9, 0);
    for (const [x, y] of [[-0.42, 3.15], [0.42, 3.15], [-0.42, 2.65], [0.42, 2.65]]) {
      const g = new THREE.Group(); g.position.set(x, y, 0.05); g.rotation.x = 0.25; root.add(g);
      add(g, boxUp(yel, 0.4, 0.34, 0.24, 0.03), 0, -0.17, -0.1);
      add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.28), new THREE.MeshBasicMaterial({ color: 0xfffae8 })), 0, 0, 0.025);
      for (let k = 0; k < 3; k++) add(g, box(M(0x2a2a2a), 0.36, 0.012, 0.012), 0, -0.1 + k * 0.1, 0.03);
    }
    add(root, tube(M(0x151515, { rough: 0.8 }), [[0, 1.2, -0.03], [0.2, 0.6, -0.1], [0.5, 0.02, -0.4], [1.2, 0.02, -0.5]], 0.02, 16, 5));
    await prop(F, { prefix: 'DFLD', root, w: 2.2, top: 3.6, yaw: 0.3, elev: 6 });
  }

  // ------------------------------------------------------------ DJEP: army jeep wreck
  if (want('DJEP')) {
    const root = new THREE.Group();
    const os = new Surf(128, 128);
    os.each((u, v, x, y, i) => { const n = fbm(u, v, 5, 5, 4, 21), b = fbm(u, v, 2, 2, 4, 22); let c = [82, 88, 58]; const soot = clamp((0.42 - b) * 4); const k = 0.8 + n * 0.3; os.setC(i, [c[0] * k * (1 - soot * 0.7), c[1] * k * (1 - soot * 0.7), c[2] * k * (1 - soot * 0.7)]); });
    const od = K.texMat(K.surfTex(os, { repeat: [0.5, 0.5] }), { rough: 0.8, metal: 0.2 });
    const dark = M(0x161616, { rough: 0.9 });
    const jeep = new THREE.Group(); root.add(jeep); jeep.rotation.z = -0.06; jeep.rotation.x = 0.04;
    // tub + hood (side profile extruded across the width)
    add(jeep, extrude(od, [[-1.6, 0.45], [1.6, 0.45], [1.68, 0.7], [1.6, 0.98], [0.55, 1.02], [0.45, 0.95], [-1.55, 0.95], [-1.62, 0.7]], 1.5, 0.02));
    for (const s2 of [-1, 1]) add(jeep, box(od, 1.1, 0.04, 0.3, 0.01), 1.05, 0.95, s2 * 0.82);           // fenders
    add(jeep, box(dark, 0.06, 0.4, 1.5, 0.01), 1.67, 0.7, 0);                                                 // grille
    // windshield frame folded, roll bar
    add(jeep, box(od, 0.04, 0.5, 1.4, 0.01), 0.35, 1.25, 0, 0, 0, -0.3);
    for (const s2 of [-1, 1]) add(jeep, tube(M(0x3a3e2a, { metal: 0.4 }), [[-0.9, 0.95, s2 * 0.7], [-0.95, 1.7, s2 * 0.68], [-0.95, 1.7, -s2 * 0.2]], 0.03, 10, 6));
    // seats (burnt) + spare tyre on the back
    for (const z of [-0.35, 0.35]) add(jeep, boxUp(dark, 0.5, 0.3, 0.5, 0.05), -0.2, 0.95, z);
    add(jeep, torus(dark, 0.3, 0.1, 8, 16), -1.72, 0.95, 0, 0, Math.PI / 2, 0);
    // wheels: front left flattened, rear right gone
    for (const [x, z, st] of [[1.1, 0.78, 'flat'], [1.1, -0.78], [-1.05, 0.78], [-1.05, -0.78, 'gone']]) {
      if (st === 'gone') continue;
      const wh = new THREE.Group(); wh.position.set(x, 0.38, z); jeep.add(wh);
      add(wh, cyl(dark, 0.38, 0.24, 16), 0, 0, 0, Math.PI / 2, 0, 0).scale.y = 1;
      add(wh, cyl(M(0x3a3e2a, { metal: 0.5 }), 0.2, 0.26, 10), 0, 0, 0, Math.PI / 2, 0, 0);
      if (st === 'flat') wh.scale.y = 0.75;
    }
    const star = canvasTex(128, 128, (g) => { g.fillStyle = 'rgba(230,230,220,0.85)'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r2 = k % 2 ? 22 : 54; g.lineTo(64 + Math.cos(a) * r2, 64 + Math.sin(a) * r2); } g.fill(); g.strokeStyle = 'rgba(230,230,220,0.85)'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke(); });
    add(jeep, new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), K.texMat(star, { transparent: true, rough: 0.8 })), 1.1, 1.005, 0, -Math.PI / 2, 0, -0.05);
    const num = canvasTex(128, 32, (g) => { g.fillStyle = 'rgba(230,230,220,0.85)'; g.font = 'bold 20px "DejaVu Sans Mono", monospace'; g.fillText('USA 20834', 6, 24); });
    add(jeep, decal(num, 0.6, 0.15), 1.1, 0.8, 0.765);
    await prop(F, { prefix: 'DJEP', root, w: 4.2, top: 2.2, yaw: 0.6, elev: 14 });
  }

  // ------------------------------------------------------------ DRCK: rocks
  if (want('DRCK')) {
    const root = new THREE.Group();
    const rs = new Surf(128, 128);
    rs.each((u, v, x, y, i) => { const n = fbm(u, v, 6, 6, 5, 31), l = fbm(u, v, 12, 12, 3, 32); let c = [116, 110, 100]; const k = 0.7 + n * 0.4; c = [c[0] * k, c[1] * k, c[2] * k]; if (l > 0.62) c = [c[0] * 0.8, c[1] * 0.95, c[2] * 0.7]; rs.setC(i, c); });
    const rockM = K.texMat(K.surfTex(rs, { repeat: [1.5, 1.5] }), { rough: 0.9 });
    for (const [x, z, s2, sy, seed] of [[0, 0, 0.75, 0.7, 3], [0.9, 0.3, 0.45, 0.6, 7], [-0.8, 0.25, 0.5, 0.8, 11], [0.3, 0.7, 0.28, 0.6, 5]]) {
      const geo = F.rockGeo(seed, 3, 0.34), pp = geo.attributes.position, uv = [];
      for (let i = 0; i < pp.count; i++) { const x0 = pp.getX(i), y0 = pp.getY(i), z0 = pp.getZ(i); uv.push(Math.atan2(z0, x0) / Math.PI + 1, y0 * 0.8); }
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(geo, rockM);
      m.scale.set(s2 * 1.2, s2 * sy, s2); m.position.set(x, s2 * sy * 0.3, z); m.rotation.y = seed; root.add(m);
    }
    await prop(F, { prefix: 'DRCK', root, w: 2.8, top: 1.4, yaw: 0, elev: 12 });
  }

  // ------------------------------------------------------------ DSBG: sandbag wall
  if (want('DSBG')) {
    const root = new THREE.Group();
    const bs = new Surf(64, 64);
    bs.each((u, v, x, y, i) => { const wv = ((x + y) % 2 ? -0.05 : 0.04) + (hash(x, y, 41) - 0.5) * 0.08, n = fbm(u, v, 4, 4, 3, 42); const k = 0.8 + n * 0.3 + wv; bs.setC(i, [150 * k, 132 * k, 92 * k]); });
    const burlap = K.texMat(K.surfTex(bs, { repeat: [1, 1] }), { rough: 0.95 });
    const bagGeo = (() => { const g = new THREE.BoxGeometry(0.6, 0.2, 0.34, 6, 3, 4), p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const nx = v.x / 0.3, ny = v.y / 0.1, nz = v.z / 0.17; const bulge = 1 - 0.25 * nx * nx; v.y *= bulge; v.z *= 0.8 + 0.2 * (1 - nx * nx); v.x *= 1 - 0.08 * ny * ny; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })();
    const r = rng(43);
    for (let row = 0; row < 4; row++) {
      const n = 5 - (row === 3 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const x = (k - (n - 1) / 2) * 0.58 + (row % 2) * 0.29 - 0.14, a = x * 0.25;
        const b = new THREE.Mesh(bagGeo, burlap); b.position.set(x, 0.09 + row * 0.18, -Math.abs(x) * 0.25 + (r() - 0.5) * 0.03); b.rotation.set((r() - 0.5) * 0.08, -a, (r() - 0.5) * 0.1); root.add(b);
      }
    }
    await prop(F, { prefix: 'DSBG', root, w: 3.4, top: 1.1, yaw: 0, elev: 12 });
  }

  // ------------------------------------------------------------ DDBR: glowing hull debris (A-B)
  if (want('DDBR')) {
    const root = new THREE.Group();
    const hs = new Surf(128, 128); hs.fill(A.violet); hullPlates(hs, { fx: 2, fy: 2, seed: 51, glow: 0.3 });
    const hullM = K.texMat(K.surfTex(hs, { lit: true, bake: { amb: 0.6 } }), { rough: 0.3, metal: 0.4 });
    const edgeM = new THREE.MeshBasicMaterial({ color: 0x40f0d0 });
    const r = rng(52);
    const shard = (sz, seed) => { const rr = rng(seed); const pts = []; const n = 6 + Math.floor(rr() * 3); for (let k = 0; k < n; k++) { const a = k / n * 6.28, d = sz * (0.5 + rr() * 0.6); pts.push([Math.cos(a) * d, Math.sin(a) * d]); } return pts; };
    const pieces = [[0, 0.35, 0, 0.8, 0.9, 0.3], [0.9, 0.12, 0.4, 0.35, 0.2, 1.2], [-0.8, 0.12, 0.3, 0.4, -0.3, 2.1], [0.3, 0.06, 0.9, 0.22, 0.1, 0.4]];
    const glows = [];
    pieces.forEach(([x, y, z, sz, rx, ry], k) => {
      const pts = shard(sz, 60 + k);
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, k * 0.7); root.add(g);
      add(g, extrude(hullM, pts, 0.08, 0.01));
      const e = extrude(edgeM, pts.map(([a, b]) => [a * 1.04, b * 1.04]), 0.04, 0); g.add(e); glows.push(e);
    });
    const pose = (f) => edgeM.color.setHex(f === 'A' ? 0x2ab8a0 : 0x8affec);
    await prop(F, { prefix: 'DDBR', root, frames: 'AB', w: 2.6, top: 1.5, yaw: 0.3, elev: 16, pose });
  }
}

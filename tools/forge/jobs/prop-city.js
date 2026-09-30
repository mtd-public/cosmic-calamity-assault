// MAP02 city props (sprites/props, rotation 0).
import { kit, prop } from '../lib/env/kit.js';
import { rng, Surf, clamp, fbm, hash } from '../lib/env/tex.js';
import { ball, flame, renderFrames } from '../lib/env/fire.js';

export default async function (F) {
  const K = kit(F);
  const { THREE, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, decal, basic, group, M } = K;
  const P = K.P;
  const only = null;
  const want = (n) => !only || only.includes(n);
  const FL = (img, proj, x, y, z, w, h, o) => { const [cx, cy] = proj(x, y, z); flame(img, { x: cx, y: cy, w: w * 64, h: h * 64 / 1.2, ...o }); };
  const BL = (img, proj, x, y, z, r, o) => { const [cx, cy] = proj(x, y, z); ball(img, { cx, cy, rx: r * 64, ry: r * 64 / 1.2, ...o }); };
  // charred / rusty painted-metal texture
  const burntTex = (seed, base = [48, 36, 30]) => {
    const s = new Surf(128, 128);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 4, seed), r = fbm(u, v, 2, 2, 5, seed + 1), g = hash(x, y, seed + 2);
      let c = base;
      c = [c[0] + (118 - c[0]) * clamp((r - 0.5) * 4), c[1] + (62 - c[1]) * clamp((r - 0.5) * 4), c[2] + (32 - c[2]) * clamp((r - 0.5) * 4)];
      const soot = clamp((0.42 - r) * 4); c = [c[0] * (1 - soot * 0.6), c[1] * (1 - soot * 0.6), c[2] * (1 - soot * 0.6)];
      const k = 0.8 + n * 0.35 + (g - 0.5) * 0.15;
      s.setC(i, [c[0] * k, c[1] * k, c[2] * k]);
    });
    return K.texMat(K.surfTex(s, { repeat: [0.45, 0.45] }), { rough: 0.85, metal: 0.3 });
  };

  // ------------------------------------------------------------ DCAR: burning car wreck (A-C flames)
  if (want('DCAR')) {
    const root = new THREE.Group();
    const body = burntTex(901), dark = M(0x151414, { rough: 0.9 }), glassM = M(0x10141a, { rough: 0.1, metal: 0.5 });
    const car = new THREE.Group(); root.add(car); car.rotation.z = 0.035; car.position.y = -0.02;
    const lower = [[-2.3, 0.32], [2.3, 0.32], [2.36, 0.55], [2.28, 0.82], [1.15, 0.92], [-1.4, 0.95], [-2.3, 0.9], [-2.38, 0.6]];
    add(car, extrude(body, lower, 1.74, 0.03), 0, 0, 0);
    // cabin: windows as dark glass (some blown out) with pillars
    const cabin = [[1.1, 0.9], [0.55, 1.34], [-0.78, 1.36], [-1.38, 0.93]];
    add(car, extrude(glassM, cabin, 1.56, 0.02), 0, 0, 0);
    add(car, extrude(body, [[0.52, 1.32], [0.6, 1.4], [-0.8, 1.42], [-0.76, 1.32]], 1.6, 0.02), 0, 0, 0);          // roof
    for (const [a, b] of [[[1.1, 0.9], [0.55, 1.34]], [[-0.1, 0.92], [-0.1, 1.36]], [[-1.38, 0.93], [-0.78, 1.36]]]) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      for (const z of [-0.79, 0.79]) add(car, box(body, 0.07, L, 0.06, 0.01), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z, 0, 0, Math.atan2(dy, dx) - Math.PI / 2);
    }
    // crumpled hood, bumpers, lights
    add(car, box(body, 1.1, 0.08, 1.6, 0.02), 1.7, 0.92, 0, 0, 0, -0.18);
    for (const x of [-2.4, 2.4]) add(car, box(M(0x3a3a3a, { metal: 0.6, rough: 0.5 }), 0.1, 0.16, 1.7, 0.03), x, 0.45, 0);
    for (const z of [-0.6, 0.6]) add(car, box(M(0x6a6050, { rough: 0.3 }), 0.04, 0.12, 0.26, 0.01), 2.36, 0.68, z);
    // wheels (rear left missing: that corner sags)
    for (const [x, z, miss] of [[1.45, 0.8], [1.45, -0.8], [-1.45, 0.8, true], [-1.45, -0.8]]) {
      if (miss) { add(car, cyl(M(0x2a2622, { metal: 0.6 }), 0.12, 0.2, 10), x, 0.12, z, Math.PI / 2, 0, 0); continue; }
      add(car, cyl(dark, 0.34, 0.24, 18), x, 0.34, z, Math.PI / 2, 0, 0);
      add(car, cyl(M(0x4a4440, { metal: 0.7, rough: 0.5 }), 0.2, 0.26, 12), x, 0.34, z, Math.PI / 2, 0, 0);
    }
    const post = (f, img, ox, oy, px, proj) => {
      const t = 'ABC'.indexOf(f) / 3;
      FL(img, proj, 1.7, 0.95, 0.2, 0.55, 1.2, { t, seed: 11 });                 // engine bay
      FL(img, proj, 1.9, 0.9, -0.4, 0.35, 0.8, { t: t + 0.3, seed: 12 });
      FL(img, proj, -0.1, 1.0, 0.3, 0.5, 1.5, { t: t + 0.5, seed: 13 });         // cabin
      FL(img, proj, -0.8, 1.0, -0.2, 0.35, 1.0, { t: t + 0.1, seed: 14 });
      FL(img, proj, -1.6, 0.9, 0.5, 0.25, 0.6, { t: t + 0.7, seed: 15 });        // trunk
      BL(img, proj, 0.2, 2.9 + t * 0.2, 0, 0.6, { seed: 16 + 'ABC'.indexOf(f), heat: 0.12, smoke: 1, turb: 0.9 });
    };
    await renderFrames(F, { prefix: 'DCAR', root, frames: [...'ABC'], w: 5.6, top: 3.8, yaw: 0.6, elev: 16, post });
  }

  // ------------------------------------------------------------ DHYD: hydrant
  if (want('DHYD')) {
    const root = new THREE.Group();
    const red = M(0xb02a1e, { rough: 0.5, metal: 0.3, detail: 'metal' }), chrome = M(0xb8b8b0, { metal: 0.8, rough: 0.3 });
    add(root, lathe(red, [[0, 0], [0.2, 0], [0.2, 0.06], [0.14, 0.08], [0.13, 0.55], [0.15, 0.58], [0.15, 0.64], [0.1, 0.72], [0.05, 0.8], [0.06, 0.84], [0, 0.86]], 20));
    add(root, cyl(chrome, 0.05, 0.08, 10), 0, 0.86, 0);
    for (const a of [0, Math.PI]) { const g = new THREE.Group(); add(g, cyl(red, 0.06, 0.12, 12), 0, 0, 0.06, Math.PI / 2, 0, 0); add(g, cyl(chrome, 0.065, 0.03, 12), 0, 0, 0.13, Math.PI / 2, 0, 0); g.position.y = 0.45; g.rotation.y = a + Math.PI / 2; root.add(g); }
    const front = new THREE.Group(); add(front, cyl(red, 0.085, 0.12, 14), 0, 0, 0.06, Math.PI / 2, 0, 0); add(front, cyl(chrome, 0.09, 0.03, 6), 0, 0, 0.13, Math.PI / 2, 0, 0); front.position.y = 0.38; root.add(front);
    add(root, tube(M(0x8a8a86, { metal: 0.7 }), [[0.13, 0.45, 0.02], [0.18, 0.3, 0.08], [0.1, 0.36, 0.14]], 0.006, 12, 4));
    await prop(F, { prefix: 'DHYD', root, w: 0.7, top: 1.0, yaw: 0.6, elev: 12 });
  }

  // ------------------------------------------------------------ DLPT: sodium streetlamp (cobra head)
  if (want('DLPT')) {
    const root = new THREE.Group();
    const grey = M(0x6a6e70, { metal: 0.6, rough: 0.45, detail: 'metal' });
    add(root, lathe(grey, [[0, 0], [0.22, 0], [0.22, 0.05], [0.16, 0.12], [0.14, 0.55], [0.12, 0.6], [0.09, 5.6], [0, 5.6]], 16));
    add(root, taper(grey, [[0, 5.3], [0.2, 5.7], [0.8, 5.85], [1.5, 5.85]], (t) => 0.06 - t * 0.02, 24, 8));
    const head = new THREE.Group(); add(root, head, 1.75, 5.82, 0);
    const hb = sphere(grey, 1, 20, 12); hb.scale.set(0.42, 0.14, 0.2); add(head, hb, 0, 0.02, 0);
    const lens = sphere(new THREE.MeshBasicMaterial({ color: 0xffb050 }), 1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); lens.scale.set(0.38, 0.16, 0.19); add(head, lens, 0.02, -0.01, 0);
    const band = torus(new THREE.MeshBasicMaterial({ color: 0xffc070 }), 1, 0.08, 6, 24); add(head, band, 0.02, -0.02, 0, Math.PI / 2, 0, 0).scale.set(0.37, 0.18, 0.5);
    // pole-mounted signs
    const sgn = canvasTex(128, 32, (g) => { g.fillStyle = '#1e6a3a'; g.fillRect(0, 0, 128, 32); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(2, 2, 124, 28); g.fillStyle = '#fff'; g.font = 'bold 16px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('K ST NW', 64, 23); });
    add(root, decal(sgn, 0.8, 0.2), 0.42, 3.3, 0.1);
    add(root, decal(sgn, 0.8, 0.2), 0.42, 3.3, 0.09, 0, Math.PI, 0);
    await prop(F, { prefix: 'DLPT', root, w: 4.2, top: 6.4, yaw: 0.2, elev: 4 });
  }

  // ------------------------------------------------------------ DDMP: dumpster
  if (want('DDMP')) {
    const root = new THREE.Group();
    const green = (() => { const s = new Surf(128, 128); s.each((u, v, x, y, i) => { const n = fbm(u, v, 5, 5, 4, 911), r = fbm(u, v, 4, 4, 4, 912); let c = [46, 88, 58]; if (r > 0.6) c = [110, 64, 34]; const k = 0.8 + n * 0.3; s.setC(i, [c[0] * k, c[1] * k, c[2] * k]); }); return K.texMat(K.surfTex(s), { rough: 0.7, metal: 0.3 }); })();
    const bodyPts = [[-0.62, 0], [0.62, 0], [0.62, 1.05], [-0.62, 1.2]];
    const bodyG = new THREE.Group(); root.add(bodyG);
    const b = extrude(green, bodyPts.map(([z, y]) => [z, y]), 1.9, 0.02); b.rotation.y = Math.PI / 2; bodyG.add(b);
    for (const x of [-0.7, 0.7]) add(root, box(green, 0.06, 1.1, 1.3, 0.01), x, 0.6, 0.02);
    add(root, box(M(0x2a2e2a, { metal: 0.5 }), 2.0, 0.08, 0.1), 0, 0.85, 0.66);
    // lids: one closed, one propped open
    const lid1 = boxUp(M(0x1c1e1c, { rough: 0.6 }), 0.95, 0.03, 1.32, 0.01); add(root, lid1, -0.48, 1.12, 0, -0.12, 0, 0);
    const lidG = new THREE.Group(); lidG.position.set(0.48, 1.2, -0.64); lidG.rotation.x = -2.1; root.add(lidG); add(lidG, boxUp(M(0x1c1e1c, { rough: 0.6 }), 0.95, 0.03, 1.32, 0.01), 0, 0, 0.66);
    for (let k = 0; k < 4; k++) add(root, sphere(M(0x1a1a1c, { rough: 0.3 }), 0.25, 10, 8), 0.3 + (k % 2) * 0.35, 1.05 + (k > 1 ? 0.12 : 0), -0.2 + k * 0.12).scale.y = 0.7;
    for (const x of [-0.8, 0.8]) for (const z of [-0.5, 0.5]) add(root, cyl(P.rubber, 0.07, 0.06, 10), x, 0.07, z, Math.PI / 2, 0, 0);
    const st = canvasTex(128, 40, (g) => { g.fillStyle = 'rgba(240,240,230,0.9)'; g.font = 'bold 17px "DejaVu Sans", sans-serif'; g.fillText('CITY WASTE', 4, 26); });
    add(root, decal(st, 0.9, 0.28), 0, 0.6, 0.68);
    await prop(F, { prefix: 'DDMP', root, w: 2.6, top: 2.3, yaw: 0.45, elev: 12 });
  }

  // ------------------------------------------------------------ DTRS: trash bags
  if (want('DTRS')) {
    const root = new THREE.Group(), r = rng(921);
    const bagG = (rad, seed) => { const g = new THREE.IcosahedronGeometry(rad, 3), p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const d = 1 + 0.12 * Math.sin(n.x * 7 + seed) * Math.sin(n.y * 6 + seed * 2) + 0.06 * Math.sin(n.z * 13 + seed); v.copy(n).multiplyScalar(rad * d); if (v.y < -rad * 0.55) v.y = -rad * 0.55; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
    const black = M(0x18181c, { rough: 0.25, metal: 0.1 }), whiteB = M(0xb8bab4, { rough: 0.35 });
    const bags = [[0, 0, 0, 0.36, black], [0.5, 0, 0.1, 0.32, black], [0.25, 0.4, 0, 0.3, black], [-0.45, 0, 0.2, 0.3, whiteB], [0.9, 0, -0.1, 0.26, black], [-0.1, 0, 0.45, 0.24, black]];
    bags.forEach(([x, y, z, rad, m], k) => { const b = new THREE.Mesh(bagG(rad, k * 1.7), m); b.scale.y = 0.85; add(root, b, x, y + rad * 0.55 * 0.85, z); add(root, taper(m, [[x, y + rad * 1.3, z], [x + 0.03, y + rad * 1.55, z], [x - 0.02, y + rad * 1.7, z + 0.03]], (t) => 0.05 * (1 - t * 0.5), 8, 6)); });
    add(root, boxUp(M(0x8a7050, { rough: 0.9 }), 0.4, 0.25, 0.3, 0.01), -0.8, 0, -0.1, 0, 0.4, 0.2);
    add(root, cyl(M(0xc02020, { metal: 0.6, rough: 0.3 }), 0.035, 0.12, 10), 0.3, 0.035, 0.55, 0, 0, Math.PI / 2);
    await prop(F, { prefix: 'DTRS', root, w: 2.4, top: 1.2, yaw: 0.2, elev: 14 });
  }

  // ------------------------------------------------------------ DBNC: park bench
  if (want('DBNC')) {
    const root = new THREE.Group();
    const iron = M(0x1e2220, { metal: 0.5, rough: 0.5 }), wood = M(0x7a5634, { rough: 0.8, detail: 'wool' });
    for (const x of [-0.8, 0.8]) {
      add(root, extrude(iron, [[-0.3, 0], [-0.22, 0], [-0.1, 0.42], [0.2, 0.42], [0.26, 0], [0.32, 0], [0.26, 0.46], [0.36, 0.95], [0.3, 0.97], [0.2, 0.5], [-0.14, 0.5], [-0.28, 0.66], [-0.34, 0.64]].map(([z, y]) => [z, y]), 0.05, 0.005), x, 0, 0, 0, Math.PI / 2, 0);
    }
    for (let k = 0; k < 4; k++) add(root, boxUp(wood, 1.8, 0.035, 0.08, 0.01), 0, 0.44, -0.18 + k * 0.1);
    for (let k = 0; k < 3; k++) add(root, boxUp(wood, 1.8, 0.09, 0.03, 0.01), 0, 0.58 + k * 0.12, 0.27 + k * 0.022, -0.2, 0, 0);
    await prop(F, { prefix: 'DBNC', root, w: 2.2, top: 1.2, yaw: 0.5, elev: 12 });
  }

  // ------------------------------------------------------------ DPHN: phone booth (90s kiosk)
  if (want('DPHN')) {
    const root = new THREE.Group();
    const steel = M(0x8a8e92, { metal: 0.6, rough: 0.4, detail: 'metal' }), dark = M(0x222428, { metal: 0.4, rough: 0.5 });
    add(root, boxUp(dark, 1.0, 0.06, 0.9, 0.01), 0, 0, 0);
    for (const x of [-0.47, 0.47]) for (const z of [-0.42, 0.42]) add(root, boxUp(steel, 0.05, 2.2, 0.05, 0.01), x, 0, z);
    add(root, boxUp(steel, 1.02, 0.3, 0.92, 0.02), 0, 2.2, 0);
    const hdr = canvasTex(128, 40, (g) => { g.fillStyle = '#1a3a9a'; g.fillRect(0, 0, 128, 40); g.fillStyle = '#fff'; g.font = 'bold 24px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('PHONE', 64, 29); });
    for (const [z, ry] of [[0.465, 0], [-0.465, Math.PI]]) add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({ map: hdr })), 0, 2.35, z, 0, ry, 0);
    add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({ map: hdr })), 0.515, 2.35, 0, 0, Math.PI / 2, 0);
    // back panel with the payphone, glass sides (one smashed)
    add(root, boxUp(steel, 0.92, 1.9, 0.03, 0.005), 0, 0.2, -0.42);
    const phone = new THREE.Group(); add(root, phone, 0, 1.2, -0.36);
    add(phone, boxUp(M(0x9aa0a6, { metal: 0.6, rough: 0.35 }), 0.24, 0.5, 0.12, 0.02), 0, 0, 0);
    add(phone, boxUp(dark, 0.07, 0.24, 0.08, 0.02), -0.14, 0.18, 0.04);
    add(phone, tube(M(0x9aa0a6, { metal: 0.5 }), [[-0.12, 0.18, 0.06], [-0.2, 0.0, 0.08], [-0.16, -0.25, 0.05]], 0.008, 12, 5));
    for (let k = 0; k < 12; k++) add(phone, box(M(0xd0d0d0), 0.03, 0.025, 0.02), -0.035 + (k % 3) * 0.035, 0.3 - Math.floor(k / 3) * 0.035, 0.07);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9ab8c0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.5), glass), -0.47, 1.0, 0, 0, Math.PI / 2, 0);
    const shard = new THREE.Shape([[0, 0], [0.84, 0], [0.84, 0.5], [0.6, 0.62], [0.4, 0.3], [0.2, 0.7], [0, 0.45]].map(([x, y]) => new THREE.Vector2(x, y)));
    add(root, new THREE.Mesh(new THREE.ShapeGeometry(shard), glass), 0.47, 0.25, 0.42, 0, Math.PI / 2, 0);
    await prop(F, { prefix: 'DPHN', root, w: 1.6, top: 2.7, yaw: 0.6, elev: 8 });
  }

  // ------------------------------------------------------------ DTRF: traffic light (A green, B amber, C red)
  if (want('DTRF')) {
    const root = new THREE.Group();
    const yel = M(0xc8a020, { rough: 0.5, metal: 0.3 }), grey = M(0x5a5e60, { metal: 0.6, rough: 0.45 });
    add(root, lathe(grey, [[0, 0], [0.16, 0], [0.16, 0.08], [0.09, 0.14], [0.07, 3.3], [0, 3.3]], 14));
    const head = (rx, ry) => {
      const g = new THREE.Group();
      add(g, boxUp(yel, 0.32, 0.9, 0.24, 0.03), 0, 0, 0);
      const lamps = [];
      for (let k = 0; k < 3; k++) {
        const y = 0.75 - k * 0.3;
        add(g, cyl(yel, 0.13, 0.14, 16, 0.13, true), 0, y + 0.02, 0.18, Math.PI / 2 - 0.25, 0, 0).material = M(0x1a1a1a, { rough: 0.6 });
        const lm = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshBasicMaterial({ color: 0x222222 })); add(g, lm, 0, y, 0.125);
        lamps.push(lm);
      }
      g.position.set(rx, 2.55, 0); g.rotation.y = ry; root.add(g); return lamps;
    };
    const L1 = head(0, 0), L2 = head(0.26, Math.PI / 2);
    add(root, box(grey, 0.2, 0.08, 0.08), 0.1, 2.9, 0);
    const walk = canvasTex(64, 64, (g) => { g.fillStyle = '#111'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ff6a20'; g.beginPath(); g.moveTo(22, 50); g.lineTo(22, 26); g.lineTo(28, 16); g.lineTo(36, 16); g.lineTo(42, 26); g.lineTo(42, 50); g.fill(); });
    add(root, boxUp(M(0x1a1a1a), 0.3, 0.3, 0.2, 0.02), 0, 1.9, 0.12);
    add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ map: walk })), 0, 2.05, 0.225);
    const cols = [0xff2a1a, 0xffb020, 0x30ff80];
    const pose = (f) => { const on = { A: 2, B: 1, C: 0 }[f]; [L1, L2].forEach((L) => L.forEach((m, k) => m.material.color.setHex(k === on ? cols[k] : [0x3a0a08, 0x3a2a08, 0x08301a][k]))); };
    await prop(F, { prefix: 'DTRF', root, frames: 'ABC', w: 1.4, top: 3.6, yaw: 0.35, elev: 6, pose });
  }

  // ------------------------------------------------------------ DNWS: newspaper box
  if (want('DNWS')) {
    const root = new THREE.Group();
    const blue = M(0x1c4a9a, { rough: 0.45, metal: 0.3 });
    add(root, boxUp(M(0x2a2a2a, { metal: 0.5 }), 0.46, 0.35, 0.38, 0.01), 0, 0, 0);
    add(root, boxUp(blue, 0.5, 0.62, 0.44, 0.03), 0, 0.35, 0);
    add(root, boxUp(blue, 0.52, 0.06, 0.46, 0.02), 0, 0.97, 0);
    const paper = canvasTex(128, 96, (g) => {
      g.fillStyle = '#ece8dc'; g.fillRect(0, 0, 128, 96);
      g.fillStyle = '#111'; g.font = 'bold 11px "DejaVu Serif", serif'; g.textAlign = 'center'; g.fillText('The Capital Ledger', 64, 12);
      g.fillRect(6, 15, 116, 1);
      g.font = 'bold 22px "DejaVu Sans", sans-serif'; g.fillText('INVASION!', 64, 40);
      g.fillStyle = '#333'; g.fillRect(8, 48, 50, 38); g.fillStyle = '#aab'; g.beginPath(); g.ellipse(33, 62, 18, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#444'; for (let y = 50; y < 88; y += 5) g.fillRect(64, y, 56, 2);
    });
    add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), K.texMat(paper, { rough: 0.3 })), 0, 0.72, 0.222);
    add(root, box(M(0x9aa0a4, { metal: 0.8, rough: 0.3 }), 0.4, 0.02, 0.02), 0, 0.55, 0.23);
    const lbl = canvasTex(128, 24, (g) => { g.fillStyle = '#fff'; g.font = 'bold 15px "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.fillText('50¢  DAILY', 64, 18); });
    add(root, decal(lbl, 0.4, 0.075), 0, 0.46, 0.222);
    await prop(F, { prefix: 'DNWS', root, w: 0.9, top: 1.2, yaw: 0.5, elev: 12 });
  }

  // ------------------------------------------------------------ DBRL: burning barrel (A-D)
  if (want('DBRL')) {
    const root = new THREE.Group();
    const rust = burntTex(931, [120, 64, 34]);
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.28, 0.88, 24, 1, true), new THREE.MeshStandardMaterial({ map: rust.map, roughness: 0.9, metalness: 0.3, side: THREE.DoubleSide })), 0, 0.44, 0);
    for (const y of [0.02, 0.3, 0.58, 0.86]) add(root, torus(M(0x5a3420, { rough: 0.8 }), 0.292, 0.014, 6, 28), 0, y, 0, Math.PI / 2, 0, 0);
    add(root, cyl(M(0xff7a20, { emissive: 0xff5010 }), 0.27, 0.02, 20), 0, 0.8, 0);
    // punched air holes glowing
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(root, new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: 0xffa040 })), Math.sin(a) * 0.295, 0.2, Math.cos(a) * 0.295, 0, a, 0); }
    const post = (f, img, ox, oy, px, proj) => {
      const t = 'ABCD'.indexOf(f) / 4;
      FL(img, proj, 0, 0.84, 0, 0.3, 1.0, { t, seed: 31 });
      FL(img, proj, 0.12, 0.84, 0.05, 0.14, 0.55, { t: t + 0.4, seed: 32 });
      FL(img, proj, -0.13, 0.84, 0, 0.13, 0.5, { t: t + 0.7, seed: 33 });
    };
    await renderFrames(F, { prefix: 'DBRL', root, frames: [...'ABCD'], w: 1.0, top: 2.2, yaw: 0.2, elev: 10, post });
  }
}

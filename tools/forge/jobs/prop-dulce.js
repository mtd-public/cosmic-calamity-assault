// MAP02 Dulce props: the black helicopter (8 rotations, 32 texels/m), the
// helipad decal (flat sprite, 32 texels/m), radar dish, antenna mast and a
// jersey barrier (rotation 0, 64 texels/m).
import { kit, prop } from '../lib/env/kit.js';
import { Surf, rng, clamp, fbm, hash, mix, sstep, textMask } from '../lib/env/tex.js';
import { DP, boardForm, stencil, rustAt } from '../lib/env/dulce.js';

export default async function (F, params = {}) {
  const K = kit(F);
  const { THREE, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, decal, basic, group, M } = K;
  const only = params.only ? params.only.split(',') : null;
  const want = (n) => !only || only.includes(n);

  // ------------------------------------------------------------ DHEL: unmarked matte-black Black Hawk-style helicopter, doors open
  // 8 rotations: A-B rotor running (smeared disc), C-D idling (slow, visible blades). The main rotor mast is at the origin.
  if (want('DHEL')) {
    const scene = new THREE.Scene();
    F.lightRig(scene, { hemi: 1.9, key: 2.8, fill: 1.0, rim: 1.4 });
    const black = M(0x34373c, { rough: 0.8, metal: 0.2, detail: 'metal' }), blackDk = M(0x26282c, { rough: 0.85, metal: 0.2 });
    const glass = M(0x1a2430, { rough: 0.12, metal: 0.6 }), inside = M(0x0e0e10, { rough: 1 }), seat = M(0x3a3a34, { rough: 0.9, detail: 'weave' });
    const root = new THREE.Group(); scene.add(root);
    // cabin and nose (nose toward +z)
    add(root, K.box(black, 2.3, 1.8, 6.0, 0.4), 0, 1.45, 0.4);
    const nose = sphere(black, 1, 24, 16); nose.scale.set(1.12, 0.82, 2.0); add(root, nose, 0, 1.3, 3.6);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), glass); canopy.scale.set(1.02, 0.78, 1.55); add(root, canopy, 0, 1.75, 3.55);
    add(root, K.box(blackDk, 0.12, 0.1, 1.7), 0, 2.48, 3.4, 0.35, 0, 0);                           // canopy frame
    for (const sx of [-1, 1]) add(root, new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), glass), sx * 1.16, 1.85, 2.75, 0, sx * Math.PI / 2, 0);  // cockpit side windows
    add(root, sphere(blackDk, 0.28, 12, 10), 0, 0.62, 4.3);                                        // FLIR ball under the nose
    // the open cabin doors: dark interior, troop seats, the slid-back door panels
    for (const sx of [-1, 1]) {
      add(root, new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.35), inside), sx * 1.165, 1.4, 0.1, 0, sx * Math.PI / 2, 0);
      add(root, K.boxUp(seat, 0.12, 0.5, 1.6, 0.03), sx * 0.95, 0.85, 0.1);
      add(root, K.box(black, 0.08, 1.45, 1.95, 0.04), sx * 1.24, 1.42, -1.75);
      add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.45), glass), sx * 1.29, 1.65, -1.6, 0, sx * Math.PI / 2, 0);
      add(root, K.box(blackDk, 0.06, 0.06, 4.2), sx * 1.2, 2.25, -0.6);                             // door rail
    }
    // engine deck, twin nacelles, exhausts, mast and hub
    add(root, K.box(black, 1.7, 0.6, 4.6, 0.2), 0, 2.6, -0.3);
    for (const sx of [-1, 1]) {
      add(root, cyl(black, 0.42, 2.6, 16), sx * 0.82, 2.72, -0.5, Math.PI / 2, 0, 0);
      add(root, cyl(inside, 0.3, 0.1, 12), sx * 0.82, 2.72, 0.82, Math.PI / 2, 0, 0);
      add(root, cyl(blackDk, 0.3, 0.6, 12), sx * 1.1, 2.75, -1.9, Math.PI / 2, 0, sx * 0.5);
    }
    add(root, cyl(blackDk, 0.2, 0.7, 12), 0, 3.25, 0);
    add(root, cyl(blackDk, 0.5, 0.25, 16), 0, 3.6, 0);
    // tail boom, fin, canted tail rotor (on the right, -x), stabilator
    add(root, taper(black, [[0, 1.85, -2.4], [0, 2.05, -5.5], [0, 2.3, -8.9]], (t) => mix(0.78, 0.24, t), 24, 12));
    const fin = extrude(black, [[-0.4, 0], [0.6, 0], [0.1, 2.5], [-0.7, 2.6]], 0.16, 0.02); add(root, fin, 0, 2.2, -9.0, 0, Math.PI / 2, 0);
    const stab = K.box(black, 4.2, 0.1, 0.95, 0.04); add(root, stab, 0, 2.35, -9.1, 0, 0, 0.02);
    const tr = new THREE.Group(); tr.position.set(-0.3, 4.1, -9.25); tr.rotation.z = -0.35; root.add(tr);
    add(tr, cyl(blackDk, 0.12, 0.3, 10), 0, 0, 0, 0, 0, Math.PI / 2);
    const trBlades = []; for (let k = 0; k < 4; k++) { const b = new THREE.Group(); b.rotation.x = k * Math.PI / 2; tr.add(b); add(b, K.box(blackDk, 0.05, 1.65, 0.22, 0.01), -0.1, 0.85, 0); trBlades.push(b); }
    const trDisc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 12; k++) { if (k % 3 === 0) continue; g.beginPath(); g.moveTo(32, 32); g.arc(32, 32, 31, k / 12 * 6.283, (k + 0.8) / 12 * 6.283); g.fill(); } }), alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.8 }));
    trDisc.material.map.format = THREE.RGBAFormat; add(tr, trDisc, -0.12, 0, 0, 0, -Math.PI / 2, 0);
    // landing gear
    for (const sx of [-1, 1]) {
      add(root, tube(blackDk, [[sx * 1.0, 0.9, 1.0], [sx * 1.45, 0.45, 1.1]], 0.07, 2, 6));
      add(root, cyl(M(0x161616, { rough: 0.9 }), 0.38, 0.28, 16), sx * 1.5, 0.38, 1.1, 0, 0, Math.PI / 2);
    }
    add(root, tube(blackDk, [[0, 1.9, -7.2], [0, 0.3, -7.45]], 0.08, 2, 6));
    add(root, tube(blackDk, [[0, 1.9, -6.6], [0, 0.45, -7.4]], 0.05, 2, 6));
    add(root, cyl(M(0x161616, { rough: 0.9 }), 0.2, 0.14, 12), 0, 0.2, -7.4, 0, 0, Math.PI / 2);
    // lights: red beacon on the deck, white tail strobe, nav lights (port red at +x, starboard green at -x)
    const beacon = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    add(root, sphere(beacon, 0.12, 10, 8), 0, 2.95, -2.3);
    add(root, sphere(new THREE.MeshBasicMaterial({ color: 0xfff8e0 }), 0.1, 10, 8), 0, 4.75, -9.45);
    add(root, sphere(new THREE.MeshBasicMaterial({ color: 0xff3020 }), 0.09, 8, 6), 2.12, 2.4, -9.1);
    add(root, sphere(new THREE.MeshBasicMaterial({ color: 0x30ff70 }), 0.09, 8, 6), -2.12, 2.4, -9.1);
    // the main rotor lives in the scene, not the airframe: it is symmetric about the mast, and tilting it 8 degrees
    // toward the camera shows the disc as a player on the roof sees it (from below the hub, not edge-on)
    const rotor = new THREE.Group(); rotor.position.set(0, 3.72, 0); rotor.rotation.x = 0.14; scene.add(rotor);
    const blades = new THREE.Group(); rotor.add(blades);
    for (let k = 0; k < 4; k++) { const b = new THREE.Group(); b.rotation.y = k * Math.PI / 2; blades.add(b); const bl = K.box(blackDk, 0.55, 0.07, 7.7, 0.02); bl.position.set(0, -0.12, 4.2); bl.rotation.x = 0.025; b.add(bl); }
    // blurred disc: smeared blade wedges and the tip path, hard-alpha (alpha-tested) for Doom
    const discTex = (phase) => canvasTex(256, 256, (g, w, h) => {
      const r = rng(4101 + Math.round(phase * 10));
      g.translate(128, 128);
      for (let k = 0; k < 4; k++) {
        const a0 = phase + k * Math.PI / 2;
        for (let j = 0; j < 220; j++) {   // dithered smear: denser at the blade, thinning behind it
          const t = Math.pow(r(), 1.6), a = a0 - t * 0.85, rr = 16 + r() * 110;
          g.fillStyle = `rgba(40,42,46,${0.95})`; g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, 2.2 + (1 - t) * 1.6, 0, 7); g.fill();
        }
        g.strokeStyle = 'rgba(30,32,36,1)'; g.lineWidth = 9; g.beginPath(); g.moveTo(Math.cos(a0) * 14, Math.sin(a0) * 14); g.lineTo(Math.cos(a0) * 126, Math.sin(a0) * 126); g.stroke();
      }
      g.strokeStyle = 'rgba(70,72,76,1)'; g.lineWidth = 3; g.setLineDash([10, 7]); g.beginPath(); g.arc(0, 0, 124, 0, 7); g.stroke();
    });
    const discA = discTex(0.2), discB = discTex(0.2 + Math.PI / 4);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8.2, 48), new THREE.MeshBasicMaterial({ map: discA, alphaTest: 0.5, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -0.1; rotor.add(disc);
    const pose = (f) => {
      const run = f === 'A' || f === 'B';
      disc.visible = run; blades.visible = !run;
      disc.material.map = f === 'A' ? discA : discB;
      blades.rotation.y = f === 'C' ? 0.35 : 0.35 + Math.PI / 8;
      trDisc.visible = run; trBlades.forEach((b) => (b.visible = !run));
      tr.children.forEach(() => {}); trBlades.forEach((b, k) => (b.rotation.x = k * Math.PI / 2 + (f === 'D' ? 0.5 : 0)));
      beacon.color.setHex(f === 'A' || f === 'C' ? 0xff2a1a : 0x4a0a06);
    };
    await F.spriteSet({ prefix: 'DHEL', dir: 'sprites/props', model: { root, pose }, frames: 'ABCD', rotations: 8, bounds: { w: 19.6, top: 5.6, bottom: -0.1 }, pxPerM: 32, elev: 0, scene });
  }

  // ------------------------------------------------------------ DHPD: helipad marking, a yellow H in a circle on concrete (flat sprite, 12 m at 32 texels/m)
  if (want('DHPD')) {
    const S = 386, s = new Surf(S, S), c = S / 2, R = 190;
    s.fill(DP.conc, 0.1);
    s.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 5, 4111), m = fbm(u, v, 40, 40, 2, 4112), g = hash(x, y, 4113);
      const k = 0.8 + n * 0.24 + (m - 0.5) * 0.08 + (g - 0.5) * 0.06;
      s.C[i * 3] *= k; s.C[i * 3 + 1] *= k; s.C[i * 3 + 2] *= k * 0.98; s.H[i] = n * 1.2 + m * 0.4;
      const d = Math.hypot(x - c, y - c);
      s.A[i] = d < R ? 1 : 0;
      // pour joints across the pad
      if (Math.abs(((x - c) % 96 + 96) % 96 - 48) < 0.7 || Math.abs(((y - c) % 96 + 96) % 96 - 48) < 0.7) { s.H[i] -= 0.5; s.setC(i, [116, 112, 104], 0.4); }
    });
    // white edge band with recessed perimeter lights
    s.ring(c, c, R - 6, 8, { color: [222, 220, 210], alpha: 0.9, h: 0.3 });
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = c + Math.cos(a) * (R - 6), y = c + Math.sin(a) * (R - 6); s.circle(x, y, 4, { h: 1.5, bevel: 1.5, color: [60, 60, 58] }); s.circle(x, y, 2.4, { h: 2, color: k % 2 ? [255, 230, 160] : [190, 255, 190], E: k % 2 ? [255, 210, 120] : [150, 255, 150], eAlpha: 0.7 }); }
    // the yellow circle and the H, painted and worn
    const paint = (mask, col) => { for (let i = 0; i < s.n; i++) { if (mask[i] <= 0) continue; const x = i % S, y = (i / S) | 0, wn = fbm(x / S, y / S, 24, 24, 3, 4114); s.setC(i, col, mask[i] * sstep(0.28, 0.42, wn) * 0.95); } };
    const ring = s.mask((g) => { g.lineWidth = 14; g.beginPath(); g.arc(c, c, 140, 0, 7); g.stroke(); }, { wrap: false });
    const H = s.mask((g) => { g.fillRect(c - 62, c - 78, 28, 156); g.fillRect(c + 34, c - 78, 28, 156); g.fillRect(c - 34, c - 13, 68, 26); }, { wrap: false });
    paint(ring, DP.yellow); paint(H, DP.yellow);
    // skid marks, oil stains, cracks
    s.grime([40, 38, 34], (u, v) => clamp(0.4 - Math.hypot(u - 0.62, v - 0.56) * 4), { seed: 4115, fx: 8, fy: 8 });
    const r = rng(4116);
    for (let k = 0; k < 6; k++) { const x = c + (r() - 0.5) * 220, y = c + (r() - 0.5) * 220, a = r() * 6.28, L = 20 + r() * 50; s.seg(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 2 + r() * 2, { color: [44, 42, 40], alpha: 0.3 }); }
    for (let k = 0; k < 4; k++) { let x = c + (r() - 0.5) * 300, y = c + (r() - 0.5) * 300; const pts = [[x, y]]; for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 20; y += (r() - 0.5) * 20; pts.push([x, y]); } s.tube(pts, 0.5, { h: -1, op: 'add', color: [70, 68, 62], alpha: 0.8 }); }
    const img = s.bake({ light: [-0.35, -0.55, 0.76], amb: 0.5, shadow: 3, specK: 0.5 });
    for (let i = 0; i < s.n; i++) img.data[i * 4 + 3] = s.A[i] >= 0.5 ? 255 : 0;
    await F.emit('sprites/props/DHPDA0.png', img, [c, c]);
  }

  // ------------------------------------------------------------ DRAD: radar dish on a lattice mount (A-B turning)
  if (want('DRAD')) {
    const root = new THREE.Group();
    const galv = M(0xa8acac, { metal: 0.6, rough: 0.45, detail: 'metal' }), white = M(0xdedcd4, { rough: 0.5 }), dark = M(0x3a3c3e, { rough: 0.6 });
    add(root, boxUp(M(0x9a968c, { rough: 0.9 }), 3.0, 0.3, 3.0, 0.04), 0, 0, 0);
    // four-legged tapering lattice tower with X bracing
    const leg = (sx, sz) => [[sx * 1.2, 0.3, sz * 1.2], [sx * 0.6, 4.6, sz * 0.6]];
    const lp = (sx, sz, t) => { const [a, b] = leg(sx, sz); return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(root, tube(galv, leg(sx, sz), 0.07, 2, 6));
    const faces = [[[-1, 1], [1, 1]], [[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]]];
    for (const [[ax, az], [bx, bz]] of faces) for (let k = 0; k < 4; k++) {
      const t0 = k / 4, t1 = (k + 1) / 4;
      add(root, tube(galv, [lp(ax, az, t0), lp(bx, bz, t1)], 0.035, 2, 4));
      add(root, tube(galv, [lp(bx, bz, t0), lp(ax, az, t1)], 0.035, 2, 4));
      add(root, tube(galv, [lp(ax, az, t1), lp(bx, bz, t1)], 0.04, 2, 4));
    }
    // platform, railing and the rotating pedestal
    add(root, boxUp(M(0x6a6e70, { metal: 0.5, rough: 0.5 }), 1.8, 0.1, 1.8, 0.02), 0, 4.6, 0);
    for (const [x, z, w2, d2] of [[0, 0.9, 1.8, 0.04], [0, -0.9, 1.8, 0.04], [0.9, 0, 0.04, 1.8], [-0.9, 0, 0.04, 1.8]]) add(root, boxUp(galv, w2, 0.04, d2), x, 5.6, z);
    for (const sx of [-0.9, 0.9]) for (const sz of [-0.9, 0.9]) add(root, boxUp(galv, 0.04, 1.0, 0.04), sx, 4.7, sz);
    add(root, cyl(dark, 0.42, 0.7, 16), 0, 5.05, 0);
    const head = new THREE.Group(); head.position.set(0, 5.45, 0); root.add(head);
    add(head, boxUp(M(0xc8c6be, { rough: 0.5 }), 0.8, 0.6, 0.8, 0.06), 0, 0, 0);
    // the dish: a paraboloid with panel seams, back frame and the feed on a tripod
    const D = 4.4, depth = 0.7;
    const prof = []; for (let k = 0; k <= 16; k++) { const r2 = k / 16 * D / 2; prof.push(new THREE.Vector2(r2, depth * (r2 / (D / 2)) ** 2)); }
    const panelTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e4e2da'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(110,110,104,0.7)'; g.lineWidth = 1.5; for (let x = 0; x < w; x += w / 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (const y of [h * 0.35, h * 0.7]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
    const dishM = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.55, side: THREE.DoubleSide });
    const dish = new THREE.Group(); dish.position.set(0, 1.9, 0.25); dish.rotation.x = Math.PI / 2 - 0.3; head.add(dish);
    add(dish, new THREE.Mesh(new THREE.LatheGeometry(prof, 40), dishM), 0, 0, 0, Math.PI, 0, 0);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; add(dish, tube(galv, [[Math.cos(a) * D * 0.42, -depth * 0.7, Math.sin(a) * D * 0.42], [0, -1.7, 0]], 0.03, 2, 4)); }
    add(dish, cyl(dark, 0.14, 0.4, 10), 0, -1.75, 0);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(dish, tube(galv, [[0, 0.05, 0], [Math.cos(a) * D * 0.45, 0.35, Math.sin(a) * D * 0.45]], 0.04, 2, 4)); }
    add(head, tube(galv, [[0, 0.6, 0], [0, 1.9, 0.25]], 0.12, 2, 8));
    add(head, box(dark, 0.6, 0.4, 0.5), 0, 0.85, -0.45);
    add(root, sphere(new THREE.MeshBasicMaterial({ color: 0xff2a1a }), 0.08, 8, 6), 0.85, 5.68, 0.85);
    const pose = (f) => { head.rotation.y = f === 'A' ? 0.7 : 1.75; };
    await prop(F, { prefix: 'DRAD', root, frames: 'AB', pose, w: 6.2, top: 10.0, bottom: -0.3, yaw: 0.35, elev: 8, lights: { hemi: 1.6, key: 2.6 } });
  }

  // ------------------------------------------------------------ DANT: antenna mast with a red light (A-B blink)
  if (want('DANT')) {
    const root = new THREE.Group();
    const galv = M(0xb0b4b4, { metal: 0.6, rough: 0.45, detail: 'metal' }), red = M(0xc8321e, { rough: 0.5, metal: 0.2 }), white = M(0xe0ded6, { rough: 0.5 });
    add(root, boxUp(M(0x9a968c, { rough: 0.9 }), 1.2, 0.3, 1.2, 0.04), 0, 0, 0);
    const R = 0.28, Hm = 9.5;
    const legP = (k, y) => { const a = k / 3 * Math.PI * 2 + 0.3; return [Math.cos(a) * R, y, Math.sin(a) * R]; };
    for (let k = 0; k < 3; k++) {
      // alternate red/white bands on the legs for aviation marking
      for (let b = 0; b < 7; b++) { const y0 = 0.3 + b * (Hm - 0.3) / 7, y1 = y0 + (Hm - 0.3) / 7; add(root, tube(b % 2 ? white : red, [legP(k, y0), legP(k, y1)], 0.035, 1, 6)); }
      for (let y = 0.3; y < Hm - 0.3; y += 0.45) { add(root, tube(galv, [legP(k, y), legP(k + 1, y + 0.45)], 0.015, 1, 4)); add(root, tube(galv, [legP(k, y + 0.45), legP(k + 1, y + 0.45)], 0.015, 1, 4)); }
    }
    // antennas: whips, panel antennas, a microwave drum, and the beacon on top
    add(root, cyl(galv, 0.02, 2.6, 6), 0, Hm + 1.3, 0);
    add(root, cyl(galv, 0.015, 1.6, 6), 0.25, Hm + 0.6, 0.1);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.3; add(root, boxUp(white, 0.22, 1.1, 0.1, 0.02), Math.cos(a) * 0.42, 7.6, Math.sin(a) * 0.42, 0, -a + Math.PI / 2, 0); }
    add(root, cyl(M(0xd8d6ce, { rough: 0.6 }), 0.42, 0.3, 20), 0.3, 5.6, 0.45, Math.PI / 2, 0, 0.3);
    add(root, box(galv, 0.12, 0.12, 0.5), 0.15, 5.6, 0.2, 0, 0.3, 0);
    const bm = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    add(root, cyl(galv, 0.1, 0.12, 10), 0, Hm + 0.06, 0);
    add(root, sphere(bm, 0.14, 12, 10), 0, Hm + 0.22, 0);
    add(root, sphere(bm, 0.09, 10, 8), 0, 5.0, 0).position.x = R + 0.05;
    const pose = (f) => bm.color.setHex(f === 'A' ? 0xff3a20 : 0x3a0806);
    await prop(F, { prefix: 'DANT', root, frames: 'AB', pose, w: 1.8, top: 12.6, bottom: -0.15, yaw: 0.2, elev: 4, lights: { hemi: 1.7, key: 2.6 } });
  }

  // ------------------------------------------------------------ DBRR: concrete jersey barrier
  if (want('DBRR')) {
    const root = new THREE.Group();
    const cs = new Surf(256, 128);
    boardForm(cs, { seed: 4131, board: 128, ties: false, pits: 60 });
    cs.each((u, v, x, y, i) => { const k = 0.95 + fbm(u, v, 4, 2, 3, 4132) * 0.1; cs.C[i * 3] *= k; cs.C[i * 3 + 1] *= k; cs.C[i * 3 + 2] *= k; });
    cs.grime([110, 104, 92], (u, v) => sstep(0.6, 1, v) * 0.5, { seed: 4133, fx: 8, fy: 4 });
    stencil(cs, 'U.S. GOVT', 128, 56, { size: 22, align: 'center', color: [30, 30, 30], seed: 4134, wear: 0.3, spacing: 2 });
    stencil(cs, 'DULCE  NM-17', 128, 80, { size: 13, align: 'center', color: [30, 30, 30], seed: 4135, wear: 0.3, spacing: 1 });
    const concM = K.texMat(K.surfTex(cs, { lit: true, bake: { amb: 0.6, shadow: 3 } }), { rough: 0.9 });
    const L = 3.05;
    const profile = [[-0.305, 0], [0.305, 0], [0.305, 0.075], [0.12, 0.33], [0.075, 0.81], [-0.075, 0.81], [-0.12, 0.33], [-0.305, 0.075]];
    const sh = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 }); geo.translate(0, 0, -L / 2);
    // planar UVs on the long faces: u along the length, v up
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getZ(k) + L / 2) / L, pos.getY(k) / 0.81);
    const bar = new THREE.Mesh(geo, concM); add(root, bar, 0, 0, 0, 0, Math.PI / 2, 0);
    // drain slots, lifting loops, a reflector placard
    for (const x of [-0.9, 0.9]) for (const sz of [-1, 1]) add(root, box(M(0x141414), 0.4, 0.09, 0.02), x, 0.045, sz * 0.31);
    for (const x of [-0.8, 0.8]) add(root, torus(M(0x7a5a3a, { metal: 0.5, rough: 0.6 }), 0.07, 0.015, 6, 12, Math.PI), x, 0.81, 0);
    const hz = canvasTex(64, 32, (g) => { for (let k = -2; k < 10; k++) { g.fillStyle = k % 2 ? '#1a1a1a' : '#f0b020'; g.beginPath(); g.moveTo(k * 8, 32); g.lineTo(k * 8 + 8, 32); g.lineTo(k * 8 + 24, 0); g.lineTo(k * 8 + 16, 0); g.fill(); } });
    add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), K.texMat(hz, { rough: 0.4 })), 1.05, 0.62, 0.1, -0.08, 0, 0);
    await prop(F, { prefix: 'DBRR', root, w: 3.6, top: 1.2, bottom: -0.3, yaw: 0.35, elev: 12 });
  }
}

// MAP04 street props: the burning Checker-style taxi (rotation 0, A-C flames),
// the wrecked CTA bus (8 rotations) and the Daley Plaza Picasso (8 rotations,
// 32 texels per metre).
import { kit, prop } from '../lib/env/kit.js';
import { rng, Surf, clamp, fbm, hash, mix, sstep } from '../lib/env/tex.js';
import { flame, ball, renderFrames } from '../lib/env/fire.js';
import { rustAt } from '../lib/env/dulce.js';

export default async function (F, params = {}) {
  const K = kit(F);
  const { THREE, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, decal, basic, group, M } = K;
  const P = K.P;
  const only = params.only ? params.only.split(',') : null;
  const want = (n) => !only || only.includes(n);
  const FL = (img, proj, x, y, z, w, h, o) => { const [cx, cy] = proj(x, y, z); flame(img, { x: cx, y: cy, w: w * 64, h: h * 64 / 1.2, ...o }); };
  const BL = (img, proj, x, y, z, r, o) => { const [cx, cy] = proj(x, y, z); ball(img, { cx, cy, rx: r * 64, ry: r * 64 / 1.2, ...o }); };

  // ------------------------------------------------------------ DTXI: yellow Checker-style taxi wreck (A-C flames)
  if (want('DTXI')) {
    const root = new THREE.Group();
    const ys = new Surf(128, 128);
    ys.each((u, v, x, y, i) => {
      const n = fbm(u, v, 6, 6, 4, 3201), b = fbm(u, v, 2, 2, 5, 3202), g = hash(x, y, 3203);
      let c = [214, 168, 34];
      const soot = clamp((0.5 - b) * 3.2), blister = clamp((b - 0.62) * 4);
      c = [c[0] * (1 - soot * 0.8), c[1] * (1 - soot * 0.82), c[2] * (1 - soot * 0.7)];
      c = [mix(c[0], 110, blister), mix(c[1], 64, blister), mix(c[2], 34, blister)];
      const k = 0.85 + n * 0.25 + (g - 0.5) * 0.08; ys.setC(i, [c[0] * k, c[1] * k, c[2] * k]);
    });
    const body = K.texMat(K.surfTex(ys, { repeat: [0.5, 0.5] }), { rough: 0.6, metal: 0.25 });
    const dark = M(0x141312, { rough: 0.9 }), glassM = M(0x0e1218, { rough: 0.1, metal: 0.5 }), chrome = M(0x8a8680, { metal: 0.7, rough: 0.4 });
    const car = new THREE.Group(); root.add(car); car.rotation.z = -0.03;
    // boxy Checker profile (x along the length), extruded across the width
    add(car, extrude(body, [[-2.45, 0.32], [2.45, 0.32], [2.5, 0.56], [2.42, 0.92], [0.95, 0.98], [-1.55, 1.0], [-2.42, 0.95], [-2.5, 0.6]], 1.86, 0.03));
    add(car, extrude(glassM, [[0.95, 0.96], [0.55, 1.55], [-1.2, 1.57], [-1.55, 0.98]], 1.7, 0.02));
    add(car, extrude(body, [[0.5, 1.53], [0.58, 1.62], [-1.24, 1.64], [-1.2, 1.53]], 1.74, 0.02));
    for (const [a, b] of [[[0.95, 0.96], [0.55, 1.55]], [[-0.3, 0.98], [-0.3, 1.57]], [[-1.55, 0.98], [-1.2, 1.57]]]) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      for (const z of [-0.86, 0.86]) add(car, box(body, 0.08, L, 0.06, 0.01), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z, 0, 0, Math.atan2(dy, dx) - Math.PI / 2);
    }
    // checker band along both sides
    const chk = canvasTex(256, 16, (g, w, h) => { for (let k = 0; k < 32; k++) for (let r2 = 0; r2 < 2; r2++) { g.fillStyle = (k + r2) % 2 ? '#141414' : '#ece8dc'; g.fillRect(k * 8, r2 * 8, 8, 8); } });
    for (const [z, ry] of [[0.965, 0], [-0.965, Math.PI]]) add(car, new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.14), new THREE.MeshBasicMaterial({ map: chk })), -0.2, 0.74, z, 0, ry, 0);
    // roof sign, bumpers, lamps, crumpled hood
    add(car, boxUp(M(0xe8d070, { rough: 0.5 }), 0.5, 0.2, 0.22, 0.03), -0.3, 1.64, 0);
    const tx = canvasTex(64, 24, (g) => { g.fillStyle = '#e8d070'; g.fillRect(0, 0, 64, 24); g.fillStyle = '#1a1a1a'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText('TAXI', 32, 18); });
    for (const [z, ry] of [[0.112, 0], [-0.112, Math.PI]]) add(car, new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17), K.texMat(tx, { rough: 0.5 })), -0.3, 1.74, z, 0, ry, 0);
    for (const x of [-2.55, 2.55]) add(car, box(chrome, 0.1, 0.18, 1.9, 0.03), x, 0.42, 0);
    for (const z of [-0.6, 0.6]) add(car, box(M(0x6a6050, { rough: 0.3 }), 0.04, 0.16, 0.2, 0.01), 2.5, 0.72, z);
    add(car, box(body, 1.2, 0.07, 1.7, 0.02), 1.75, 0.98, 0, 0.05, 0, -0.16);
    for (const [x, z, flat] of [[1.6, 0.85, 0], [1.6, -0.85, 0], [-1.55, 0.85, 1], [-1.55, -0.85, 0]]) {
      const wh = new THREE.Group(); wh.position.set(x, 0.36, z); car.add(wh);
      add(wh, cyl(dark, 0.36, 0.24, 18), 0, 0, 0, Math.PI / 2, 0, 0);
      add(wh, cyl(M(0x5a5650, { metal: 0.7, rough: 0.4 }), 0.18, 0.26, 12), 0, 0, 0, Math.PI / 2, 0, 0);
      if (flat) wh.scale.y = 0.78;
    }
    const post = (f, img, ox, oy, px, proj) => {
      const t = 'ABC'.indexOf(f) / 3;
      FL(img, proj, 1.75, 1.0, 0.2, 0.55, 1.2, { t, seed: 3211 });
      FL(img, proj, 2.0, 0.95, -0.4, 0.32, 0.8, { t: t + 0.3, seed: 3212 });
      FL(img, proj, -0.3, 1.05, 0.3, 0.5, 1.4, { t: t + 0.5, seed: 3213 });
      FL(img, proj, -0.95, 1.0, -0.2, 0.32, 0.95, { t: t + 0.1, seed: 3214 });
      BL(img, proj, 0.3, 2.9 + t * 0.2, 0, 0.6, { seed: 3215 + 'ABC'.indexOf(f), heat: 0.12, smoke: 1, turb: 0.9 });
    };
    await renderFrames(F, { prefix: 'DTXI', root, frames: [...'ABC'], post, w: 5.8, top: 3.8, bottom: -0.4, yaw: -0.55, elev: 14 });
  }

  // ------------------------------------------------------------ DBUS: CTA city bus wreck, white with blue/red stripes (8 rotations)
  if (want('DBUS')) {
    const L = 12.2, Wd = 2.6, H0 = 0.35, H1 = 3.1, BH = H1 - H0;
    const side = (curb) => canvasTex(1024, 232, (g, w, h) => {
      const mx = w / L, my = h / BH, Y = (m) => h - (m - H0) * my, X = (m) => (curb ? m * mx : w - m * mx);   // X: metres from the rear (the driver side runs the other way)
      const R = (a, b, y0, hh) => g.fillRect(Math.min(X(a), X(b)), y0, Math.abs(X(b) - X(a)), hh);
      g.fillStyle = '#e8e6de'; g.fillRect(0, 0, w, h);
      // stripes under the windows
      g.fillStyle = '#b8231e'; g.fillRect(0, Y(1.16), w, (1.16 - 1.06) * my);
      g.fillStyle = '#1d3f8f'; g.fillRect(0, Y(1.28), w, (1.28 - 1.18) * my);
      // window band with frames; some panes blown out
      const r = rng(curb ? 3221 : 3222);
      g.fillStyle = '#16181c'; R(0.4, L - 2.9, Y(2.45), (2.45 - 1.36) * my);
      for (let m = 0.5; m < L - 3.0; m += 1.3) {
        const x0 = Math.min(X(m), X(m + 1.18)), x1 = Math.max(X(m), X(m + 1.18)), y0 = Y(2.4), y1 = Y(1.4);
        const broken = r() < 0.35;
        const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, broken ? '#050505' : '#3a4a5a'); gr.addColorStop(1, broken ? '#0a0a0a' : '#1a2228');
        g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (broken) { g.fillStyle = 'rgba(200,220,220,0.6)'; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0 + 10, y1 - 14); g.lineTo(x0 + 22, y1 - 4); g.lineTo(x0 + 34, y1 - 18); g.lineTo(x1, y1); g.fill(); }
        else { g.fillStyle = 'rgba(200,220,240,0.25)'; g.beginPath(); g.moveTo(x0 + 8, y0); g.lineTo(x0 + 22, y0); g.lineTo(x0 + 6, y1); g.lineTo(x0 - 8, y1); g.fill(); }
      }
      // driver's window / windshield edge at the front
      g.fillStyle = '#20282e'; R(L - 2.6, L - 0.1, Y(2.45), (2.45 - 1.4) * my);
      // doors (curb side): front door behind the front axle, rear door mid-ship
      if (curb) for (const [m0, m1] of [[L - 2.5, L - 1.4], [4.6, 5.8]]) {
        g.fillStyle = '#2a2e32'; R(m0, m1, Y(2.6), (2.6 - H0) * my);
        g.fillStyle = '#3a4a56'; for (const q of [0, 1]) R(m0 + 0.06 + q * (m1 - m0) / 2, m0 + (q + 1) * (m1 - m0) / 2 - 0.06, Y(2.5), (2.5 - 0.6) * my);
      }
      // wheel arches
      for (const m of [2.9, L - 3.8]) { g.fillStyle = '#121214'; g.beginPath(); g.arc(X(m), h, 0.6 * mx, Math.PI, 0); g.fill(); }
      // unit number, route, soot and grime
      g.textAlign = 'center';
      g.fillStyle = '#222'; g.font = 'bold 22px sans-serif'; g.fillText('8412', X(L - 3.0), Y(0.75));
      g.fillStyle = '#1d3f8f'; g.font = 'bold 26px sans-serif'; g.fillText('CHICAGO TRANSIT', X(3.2), Y(0.6));
      const sr = rng(3223);
      for (let k = 0; k < 6; k++) { const x = sr() * w, rad = 40 + sr() * 90; const gr2 = g.createRadialGradient(x, 0, 0, x, 0, rad); gr2.addColorStop(0, 'rgba(20,16,14,0.85)'); gr2.addColorStop(1, 'rgba(20,16,14,0)'); g.fillStyle = gr2; g.fillRect(x - rad, 0, rad * 2, rad); }
      const gb = g.createLinearGradient(0, h, 0, h - 50); gb.addColorStop(0, 'rgba(60,50,40,0.6)'); gb.addColorStop(1, 'rgba(60,50,40,0)'); g.fillStyle = gb; g.fillRect(0, h - 50, w, 50);
      for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(40,36,30,0.25)'; g.fillRect(sr() * w, Y(1.36), 2, 6 + sr() * 30); }
    });
    const front = canvasTex(256, 272, (g, w, h) => {
      const my = h / BH, Y = (m) => h - (m - H0) * my;
      g.fillStyle = '#e8e6de'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#101010'; g.fillRect(8, Y(3.02), w - 16, (3.02 - 2.72) * my);
      g.fillStyle = '#ffa020'; g.font = 'bold 22px monospace'; g.textAlign = 'center'; g.fillText('NOT IN SERVICE', w / 2, Y(2.8));
      const gr = g.createLinearGradient(0, Y(2.65), w, Y(1.3)); gr.addColorStop(0, '#46586a'); gr.addColorStop(0.5, '#1c242c'); gr.addColorStop(1, '#2c3a46');
      g.fillStyle = gr; g.fillRect(8, Y(2.65), w - 16, (2.65 - 1.3) * my);
      g.strokeStyle = 'rgba(220,240,240,0.8)'; g.lineWidth = 1.5; const cx = w * 0.62, cy = Y(1.9);
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 45); g.stroke(); }
      g.fillStyle = '#16181a'; g.fillRect(w / 2 - 2, Y(2.65), 4, (2.65 - 1.3) * my);
      g.fillStyle = '#b8231e'; g.fillRect(0, Y(1.2), w, 10); g.fillStyle = '#1d3f8f'; g.fillRect(0, Y(1.28), w, 8);
      for (const x of [34, w - 34]) { g.fillStyle = '#f0ecd0'; g.beginPath(); g.arc(x, Y(0.82), 13, 0, 7); g.fill(); g.fillStyle = '#e09020'; g.fillRect(x - 10, Y(1.02), 20, 8); }
      g.fillStyle = '#1a1a1a'; g.fillRect(0, Y(0.6), w, (0.6 - H0) * my);
      g.fillStyle = '#222'; g.font = 'bold 20px sans-serif'; g.fillText('8412', w / 2, Y(0.98));
    });
    const back = canvasTex(256, 272, (g, w, h) => {
      const my = h / BH, Y = (m) => h - (m - H0) * my;
      g.fillStyle = '#e8e6de'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#20282e'; g.fillRect(30, Y(2.7), w - 60, (2.7 - 2.0) * my);
      g.fillStyle = '#2a2a2a'; for (let y = Y(1.7); y < Y(0.7); y += 8) g.fillRect(30, y, w - 60, 4);
      for (const x of [16, w - 16]) { g.fillStyle = '#c01818'; g.fillRect(x - 10, Y(1.3), 20, 30); g.fillStyle = '#e09020'; g.fillRect(x - 10, Y(1.45), 20, 12); }
      g.fillStyle = '#1a1a1a'; g.fillRect(0, Y(0.6), w, (0.6 - H0) * my);
      g.fillStyle = 'rgba(20,16,14,0.6)'; g.fillRect(0, 0, w, 40);
    });
    const roof = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#d8d6ce'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(30,26,22,0.5)'; g.fillRect(0, 0, w, h * 0.3); });
    // facing +z, the bus's right (curb) side is -x; BoxGeometry runs the +x face's u toward -z, so that texture is laid out front-first
    const mats = [K.texMat(side(false), { rough: 0.55 }), K.texMat(side(true), { rough: 0.55 }), K.texMat(roof, { rough: 0.6 }), M(0x1a1a1a), K.texMat(front, { rough: 0.45 }), K.texMat(back, { rough: 0.55 })];
    const root = new THREE.Group();
    const busG = new THREE.Group(); root.add(busG); busG.rotation.z = 0.025; busG.rotation.x = -0.008;
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(Wd, BH, L), mats);
    add(busG, bodyM, 0, H0 + BH / 2, 0);
    add(busG, boxUp(M(0xd0cec6, { rough: 0.6 }), 1.6, 0.32, 2.6, 0.08), 0, H1, -2.0);          // roof A/C pod
    add(busG, box(M(0x1a1a1a), Wd + 0.04, 0.28, 0.25, 0.04), 0, 0.5, L / 2 + 0.05);
    add(busG, box(M(0x1a1a1a), Wd + 0.04, 0.28, 0.25, 0.04), 0, 0.5, -L / 2 - 0.05);
    for (const s2 of [-1, 1]) add(busG, box(M(0x1a1a1a), 0.05, 0.3, 0.05), s2 * (Wd / 2 + 0.25), 2.4, L / 2 - 0.2);   // mirrors
    for (const [z, dual] of [[L / 2 - 3.8, 0], [-L / 2 + 2.9, 1]]) for (const s2 of [-1, 1]) {
      const wh = new THREE.Group(); wh.position.set(s2 * (Wd / 2 - 0.25 - dual * 0.05), 0.5, z); busG.add(wh);
      add(wh, cyl(M(0x161616, { rough: 0.9 }), 0.5, 0.3 + dual * 0.25, 18), 0, 0, 0, 0, 0, Math.PI / 2);
      add(wh, cyl(M(0x8a8a86, { metal: 0.6, rough: 0.4 }), 0.26, 0.32 + dual * 0.25, 10), 0, 0, 0, 0, 0, Math.PI / 2);
      if (z > 0 && s2 > 0) wh.scale.y = 0.8;          // a flat front tyre
    }
    await F.spriteSet({ prefix: 'DBUS', dir: 'sprites/props', model: { root, pose() {} }, frames: 'A', rotations: 8, bounds: { w: 12.8, top: 3.5, bottom: -0.1 }, elev: 0, lights: { hemi: 1.5, key: 2.4 } });
  }

  // ------------------------------------------------------------ DPIC: the Daley Plaza Picasso, a Cor-Ten steel homage (8 rotations, 32 texels/m)
  if (want('DPIC')) {
    const cs = new Surf(256, 256);
    cs.each((u, v, x, y, i) => { const [c] = rustAt(u, v, x, y, 3231, [90, 50, 34], 0.9); const k = 0.85 + fbm(u, v, 3, 3, 3, 3232) * 0.25; cs.setC(i, [c[0] * 0.82 * k, c[1] * 0.72 * k, c[2] * 0.66 * k]); });
    const steel = new THREE.MeshStandardMaterial({ map: K.surfTex(cs, { repeat: [0.25, 0.25] }), roughness: 0.75, metalness: 0.35, side: THREE.DoubleSide });
    const rodM = M(0x5a3220, { rough: 0.6, metal: 0.5 });
    const T = 0.16;                                  // plate thickness
    const root = new THREE.Group();
    // granite base
    add(root, boxUp(M(0x6a5c58, { rough: 0.6, detail: 'metal' }), 7.4, 0.45, 9.4, 0.06), 0, 0, -0.6);
    // plate from a 2D outline in the (z, y) plane, placed at x; optional elliptical holes
    const yzPlate = (pts, x, holes = [], tilt = 0, yaw = 0) => {
      const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
      for (const [hz, hy, rz, ry] of holes) { const p = new THREE.Path(); p.absellipse(hz, hy, rz, ry, 0, Math.PI * 2, false, 0); sh.holes.push(p); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -T / 2);
      const m = new THREE.Mesh(g, steel); const grp = new THREE.Group(); grp.add(m); m.rotation.y = -Math.PI / 2; grp.position.x = x; grp.rotation.set(0, yaw, tilt, 'YXZ'); root.add(grp); return grp;
    };
    const xyPlate = (pts, z, holes = []) => {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const [hx, hy, rx, ry] of holes) { const p = new THREE.Path(); p.absellipse(hx, hy, rx, ry, 0, Math.PI * 2, false, 0); sh.holes.push(p); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, z - T / 2);
      return add(root, new THREE.Mesh(g, steel));
    };
    const rod = (a, b, r = 0.05) => add(root, tube(rodM, [a, b], r, 2, 6));
    const curve = (pts, n = 12) => { const c = new THREE.CatmullRomCurve3(pts.map(([a, b]) => new THREE.Vector3(a, b, 0))); return c.getPoints(n).map((p) => [p.x, p.y]); };
    // the wings: two big curved sheets either side of the head, each with an open oval strung with rods
    const wing = [...curve([[2.4, 0.45], [2.6, 4.0], [1.6, 9.5], [-0.2, 13.6], [-2.6, 13.0], [-4.4, 9.8], [-4.6, 5.5], [-3.6, 2.2], [-2.6, 0.45]], 40)];
    for (const sx of [-1, 1]) {
      const wg = yzPlate(wing, sx * 2.1, [[-1.3, 8.4, 1.7, 3.0]], sx * 0.06, -sx * 0.5);
      for (let k = -4; k <= 4; k++) { const z = -1.3 + k * 0.36, hh = 3.0 * Math.sqrt(Math.max(0, 1 - (k * 0.36 / 1.7) ** 2)); if (hh > 0.2) add(wg, tube(rodM, [[0, 8.4 - hh, z], [0, 8.4 + hh, z]], 0.045, 2, 6)); }
    }
    // the spine: a tall sheet down the back of the head
    yzPlate(curve([[-2.6, 0.45], [-3.4, 3.5], [-3.8, 8.5], [-3.0, 13.2], [-1.6, 15.0], [-0.9, 14.6], [-1.8, 12.0], [-2.2, 7.5], [-1.4, 3.0], [-0.6, 0.45]], 40), 0);
    // the face: a long narrow plate, two eyes and a nose ridge
    xyPlate(curve([[-1.05, 5.6], [-1.25, 9.5], [-0.9, 12.8], [0, 14.2], [0.9, 12.8], [1.25, 9.5], [1.05, 5.6], [0, 4.6], [-1.05, 5.6]], 30), 1.5, [[-0.48, 11.0, 0.24, 0.16], [0.48, 11.0, 0.24, 0.16]]);
    yzPlate(curve([[1.5, 12.4], [2.05, 10.0], [1.95, 8.6], [1.5, 8.2]], 12), 0);
    add(root, box(steel, 0.12, 0.12, 0.6), 0, 7.2, 1.75);                      // the mouth bar
    // the ramp (the children's slide) from the plaza up to the chin
    add(root, box(steel, 2.2, 5.6, 0.16, 0.02), 0, 2.6, 2.5, -1.12, 0, 0);
    // cross-braces and the parallel rods strung across the top of the head
    for (let k = 0; k < 9; k++) { const t = k / 8; rod([-2.3 + t * 4.6, 13.0 - Math.abs(t - 0.5) * 1.6, 0.9], [-2.3 + t * 4.6, 12.0 - Math.abs(t - 0.5) * 1.2, -3.0], 0.05); }
    add(root, box(steel, 3.4, 0.2, 0.2), 0, 4.6, 0.4); add(root, box(steel, 5.2, 0.2, 0.2), 0, 3.0, -3.2);
    await F.spriteSet({ prefix: 'DPIC', dir: 'sprites/props', model: { root, pose() {} }, frames: 'A', rotations: 8, bounds: { w: 11.5, top: 15.6, bottom: -0.1 }, pxPerM: 32, elev: 0, lights: { hemi: 1.5, key: 2.6, fill: 0.9, rim: 1.2 } });
  }
}

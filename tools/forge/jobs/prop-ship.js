// MAP04 mothership props (sprites/props, rotation 0).
import { kit, prop } from '../lib/env/kit.js';
import { rng, Surf, clamp, fbm, hash, mix, fract } from '../lib/env/tex.js';
import { A, hullPlates, boneRibs } from '../lib/env/alien.js';

export default async function (F) {
  const K = kit(F);
  const { THREE, add, box, boxUp, cyl, sphere, lathe, torus, tube, taper, extrude, canvasTex, decal, basic, group, M } = K;
  const only = null;
  const want = (n) => !only || only.includes(n);
  const fleshTex = (seed, rep = [1, 1], base = A.violet) => { const s = new Surf(128, 128); s.fill(base); hullPlates(s, { fx: 2, fy: 3, seed, glow: 0.25, base }); return K.texMat(K.surfTex(s, { lit: true, bake: { amb: 0.6 }, repeat: rep }), { rough: 0.3, metal: 0.25 }); };
  const darkMetal = (() => { const s = new Surf(128, 128); s.fill([44, 46, 56]); for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 * 16; x < 160; x += 32) s.rect(x + 1, y + 1, x + 31, y + 31, { h: 2, bevel: 1.5, op: 'set', color: [48 + hash(x, y, 3) * 10, 50 + hash(x, y, 3) * 10, 62 + hash(x, y, 3) * 10] }); return K.texMat(K.surfTex(s, { lit: true, bake: { amb: 0.6 }, repeat: [2, 2] }), { rough: 0.35, metal: 0.6 }); })();
  const cyanM = new THREE.MeshBasicMaterial({ color: 0x46e6ff });

  // ------------------------------------------------------------ DATK: attack craft on a rack (large, ID4)
  if (want('DATK')) {
    const root = new THREE.Group();
    const hs = new Surf(256, 256); hs.fill([112, 114, 120], 0.6);
    for (let k = 0; k < 40; k++) { const r = rng(k + 5); const x = r() * 256, y = r() * 256, w2 = 20 + r() * 60, h2 = 10 + r() * 30; hs.rect(x, y, x + w2, y + h2, { h: 1.5, bevel: 1, op: 'set', color: [100 + r() * 30, 102 + r() * 30, 110 + r() * 30] }); }
    hs.mottle(0.1, 6, 6, 4, 9);
    const hull = K.texMat(K.surfTex(hs, { lit: true, bake: { amb: 0.6 }, repeat: [0.5, 0.5] }), { rough: 0.35, metal: 0.6 });
    const craft = new THREE.Group(); craft.position.set(0, 1.9, 0); craft.rotation.x = 0.1; root.add(craft);
    const wing = [[-3.5, 1.2], [-2.6, 0.1], [-1.4, -0.9], [0, -1.7], [1.4, -0.9], [2.6, 0.1], [3.5, 1.2], [2.6, 1.0], [1.2, 0.35], [0, 0.2], [-1.2, 0.35], [-2.6, 1.0]];
    const wm = extrude(hull, wing.map(([x, z]) => [x, -z]), 0.34, 0.08); wm.rotation.x = -Math.PI / 2; craft.add(wm);
    const hump = sphere(hull, 1, 28, 14); hump.scale.set(1.1, 0.5, 1.2); add(craft, hump, 0, 0.1, -0.5);
    const cock = sphere(M(0x20242c, { rough: 0.15, metal: 0.6 }), 1, 20, 10); cock.scale.set(0.5, 0.22, 0.45); add(craft, cock, 0, 0.45, -1.0);
    for (const s2 of [-1, 1]) { add(craft, box(hull, 0.12, 0.5, 1.0, 0.03), s2 * 2.6, 0.3, 0.6, 0, 0, s2 * 0.2); add(craft, box(M(0x3a3c44, { metal: 0.6 }), 0.9, 0.12, 0.3, 0.03), s2 * 1.4, -0.1, -0.4, 0, s2 * 0.5, 0); }
    // underside glows (weapon ports, engine)
    const glowO = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    for (const x of [-2.2, -1.2, 1.2, 2.2]) add(craft, sphere(glowO, 0.08, 8, 6), x, -0.2, x < 0 ? -0.1 + (x + 2.2) * -0.4 : -0.1 + (2.2 - x) * -0.4);
    add(craft, box(new THREE.MeshBasicMaterial({ color: 0x66e0ff }), 1.2, 0.06, 0.08), 0, 0.02, 0.35);
    // the rack: gantry legs, top beam, clamps
    const rack = new THREE.Group(); root.add(rack);
    for (const x of [-3.6, 3.6]) { add(rack, boxUp(darkMetal, 0.35, 4.4, 0.5, 0.05), x, 0, 0.2); add(rack, boxUp(darkMetal, 0.8, 0.2, 1.0, 0.05), x, 0, 0.2); }
    add(rack, box(darkMetal, 7.6, 0.4, 0.6, 0.06), 0, 4.3, 0.2);
    for (const x of [-1.8, 1.8]) { add(rack, box(darkMetal, 0.18, 1.8, 0.18, 0.03), x, 3.3, 0.2); add(rack, box(darkMetal, 0.6, 0.18, 0.5, 0.04), x, 2.35, 0.2); }
    for (const x of [-3.6, 3.6]) for (const y of [1.2, 2.6, 3.8]) add(rack, box(cyanM, 0.05, 0.3, 0.02), x, y, 0.46);
    await prop(F, { prefix: 'DATK', root, w: 8.4, top: 4.9, yaw: 0.25, elev: 14 });
  }

  // ------------------------------------------------------------ DPOD: abduction pod with a human inside (A-B glow)
  if (want('DPOD')) {
    const root = new THREE.Group();
    const flesh = fleshTex(301, [1, 1]);
    const R = 0.45, H0 = 0.35, GH = 1.9;
    // clamps
    add(root, lathe(flesh, [[0, 0], [0.62, 0], [0.64, 0.12], [0.55, 0.3], [0.48, 0.4], [0, 0.4]], 28));
    add(root, lathe(flesh, [[0, H0 + GH + 0.4], [0.3, H0 + GH + 0.4], [0.5, H0 + GH + 0.2], [0.55, H0 + GH], [0.48, H0 + GH - 0.1], [0, H0 + GH - 0.1]], 28));
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; add(root, taper(M(0xb8aa92, { rough: 0.5, detail: 'alien' }), [[Math.sin(a) * 0.5, 0.35, Math.cos(a) * 0.5], [Math.sin(a) * 0.56, 1.3, Math.cos(a) * 0.56], [Math.sin(a) * 0.5, 2.3, Math.cos(a) * 0.5]], (t) => 0.05 * (1 - Math.abs(t - 0.5)), 20, 6)); }
    for (const x of [-0.15, 0.2]) add(root, tube(flesh, [[x, H0 + GH + 0.35, 0], [x * 1.5, H0 + GH + 0.8, 0.1], [x * 2, 3.3, 0]], 0.06, 12, 8));
    // glowing fluid backdrop + human silhouette + membrane front
    const back = new THREE.MeshBasicMaterial({ color: 0x1a8a6a, side: THREE.BackSide });
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, GH, 28, 1, true), back), 0, H0 + GH / 2, 0);
    const skin = M(0x1a2a2a, { rough: 0.8 });
    const man = new THREE.Group(); add(root, man, 0, H0 + 0.15, -0.02, 0.05, 0, 0);
    add(man, sphere(skin, 0.1, 12, 10), 0, 1.58, 0.03);
    add(man, taper(skin, [[0, 1.45, 0], [0, 1.1, 0], [0, 0.85, 0]], (t) => 0.16 - t * 0.03, 10, 8));
    for (const s2 of [-1, 1]) { add(man, taper(skin, [[s2 * 0.18, 1.42, 0], [s2 * 0.22, 1.1, 0.02], [s2 * 0.24, 0.8, 0.05]], (t) => 0.045 - t * 0.01, 10, 6)); add(man, taper(skin, [[s2 * 0.08, 0.85, 0], [s2 * 0.1, 0.45, 0.02], [s2 * 0.09, 0.02, 0.05]], (t) => 0.065 - t * 0.02, 12, 6)); }
    const mem = new THREE.MeshBasicMaterial({ color: 0x5affd0, transparent: true, opacity: 0.35, depthWrite: false });
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(R, R, GH, 28, 1, true), mem), 0, H0 + GH / 2, 0);
    for (const x of [-0.26, 0.3]) add(root, new THREE.Mesh(new THREE.PlaneGeometry(0.04, GH * 0.9), new THREE.MeshBasicMaterial({ color: 0xd8fff0, transparent: true, opacity: 0.4, depthWrite: false })), x, H0 + GH / 2, Math.sqrt(R * R - x * x) + 0.005);
    const pose = (f) => { back.color.setHex(f === 'A' ? 0x14705a : 0x22b08a); mem.opacity = f === 'A' ? 0.3 : 0.42; mem.color.setHex(f === 'A' ? 0x4ae8c0 : 0x8affe8); };
    await prop(F, { prefix: 'DPOD', root, frames: 'AB', w: 1.6, top: 3.0, yaw: 0.2, elev: 8, pose });
  }

  // ------------------------------------------------------------ DCNS: alien console (A-B)
  if (want('DCNS')) {
    const root = new THREE.Group();
    add(root, lathe(darkMetal, [[0, 0], [0.5, 0], [0.5, 0.06], [0.28, 0.2], [0.18, 0.6], [0.22, 0.9], [0.1, 0.95], [0, 0.95]], 24));
    const desk = new THREE.Group(); desk.position.set(0, 0.98, 0.05); desk.rotation.x = 0.45; root.add(desk);
    add(desk, boxUp(darkMetal, 1.1, 0.07, 0.62, 0.02), 0, -0.07, 0);
    const padTex = (ph) => canvasTex(128, 64, (g) => { g.fillStyle = '#0a0e14'; g.fillRect(0, 0, 128, 64); const r = rng(5 + ph); for (let k = 0; k < 10; k++) { const on = r() < (ph ? 0.8 : 0.5); g.fillStyle = on ? (r() < 0.7 ? '#46e6ff' : '#ffa040') : '#1a2a30'; g.beginPath(); const x = 12 + (k % 5) * 24, y = 18 + Math.floor(k / 5) * 26; g.moveTo(x, y - 7); g.lineTo(x + 8, y); g.lineTo(x, y + 7); g.lineTo(x - 8, y); g.fill(); } });
    const pA = padTex(0), pB = padTex(1);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.5), new THREE.MeshBasicMaterial({ map: pA })); add(desk, pad, 0, 0.004, 0, -Math.PI / 2, 0, 0);
    // hologram: cut-out glyph panels floating above
    const holo = (ph) => canvasTex(128, 96, (g) => {
      g.strokeStyle = '#6af0ff'; g.fillStyle = '#6af0ff'; g.lineWidth = 2.5;
      g.strokeRect(4, 4, 120, 88);
      g.beginPath(); g.arc(40, 48, 22, ph, ph + 4.5); g.stroke(); g.beginPath(); g.arc(40, 48, 12, -ph, -ph + 3); g.stroke();
      const r = rng(11 + ph * 10); for (let k = 0; k < 6; k++) g.fillRect(76, 14 + k * 12, 10 + r() * 34, 5);
    });
    const hA = holo(0.2), hB = holo(1.8);
    const hm = new THREE.MeshBasicMaterial({ map: hA, alphaTest: 0.5, side: THREE.DoubleSide, transparent: true });
    const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), hm); add(root, h1, 0, 1.55, -0.05, -0.15, 0, 0);
    const pose = (f) => { pad.material.map = f === 'A' ? pA : pB; hm.map = f === 'A' ? hA : hB; };
    await prop(F, { prefix: 'DCNS', root, frames: 'AB', w: 1.4, top: 2.0, yaw: 0.3, elev: 12, pose });
  }

  // ------------------------------------------------------------ DPLR: alien pillar
  if (want('DPLR')) {
    const root = new THREE.Group();
    const pts = [[0, 0], [0.7, 0], [0.62, 0.15], [0.45, 0.3]];
    for (let k = 0; k < 10; k++) { const y = 0.4 + k * 0.3; pts.push([0.36, y], [0.42, y + 0.1], [0.36, y + 0.2]); }
    pts.push([0.45, 3.5], [0.6, 3.7], [0.7, 3.8], [0, 3.8]);
    add(root, lathe(darkMetal, pts, 24));
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.3; add(root, box(cyanM, 0.05, 2.9, 0.05), Math.sin(a) * 0.43, 1.9, Math.cos(a) * 0.43); }
    const flesh = fleshTex(311);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; add(root, taper(flesh, [[Math.sin(a) * 0.4, 0.3, Math.cos(a) * 0.4], [Math.sin(a) * 0.7, 0.12, Math.cos(a) * 0.7], [Math.sin(a) * 1.0, 0.02, Math.cos(a) * 1.0]], (t) => 0.14 * (1 - t * 0.7), 16, 8)); }
    await prop(F, { prefix: 'DPLR', root, w: 2.2, top: 4.0, yaw: 0, elev: 6 });
  }

  // ------------------------------------------------------------ DHVC: hive conduit (A-C pulse)
  if (want('DHVC')) {
    const root = new THREE.Group();
    const flesh = fleshTex(321, [2, 3]);
    const prof = [[0, 0], [0.75, 0], [0.62, 0.2]];
    for (let k = 0; k <= 12; k++) { const y = 0.3 + k * 0.28; prof.push([0.4 + Math.sin(k * 1.3) * 0.05 + (k % 3 === 0 ? 0.06 : 0), y]); }
    prof.push([0.45, 3.9], [0, 3.9]);
    add(root, lathe(flesh, prof, 28));
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; add(root, taper(M(0xc2b494, { rough: 0.5, detail: 'alien' }), Array.from({ length: 8 }, (_, j) => [Math.sin(a + j * 0.35) * 0.47, 0.2 + j * 0.5, Math.cos(a + j * 0.35) * 0.47]), (t) => 0.05, 40, 6)); }
    const rings = [];
    for (let k = 0; k < 4; k++) { const m = new THREE.MeshBasicMaterial({ color: 0x40f0d0 }); const r = torus(m, 0.47, 0.035, 8, 28); add(root, r, 0, 0, 0, Math.PI / 2, 0, 0); rings.push(r); }
    const veinM = new THREE.MeshBasicMaterial({ color: 0x2ab8a0 });
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; add(root, tube(veinM, Array.from({ length: 6 }, (_, j) => [Math.sin(a + Math.sin(j) * 0.2) * 0.43, 0.3 + j * 0.65, Math.cos(a + Math.sin(j) * 0.2) * 0.43]), 0.015, 30, 4)); }
    // A dim → C bright swell, for the ZScript's DHVC ABCB loop (A is also the dead frame)
    const pose = (f) => { const k = 'ABC'.indexOf(f); rings.forEach((r, j) => { r.position.y = 0.55 + j * 1.0; r.scale.setScalar(1 + k * 0.07); r.material.color.setHex([0x1c8a78, 0x40f0d0, 0xb0fff4][k]); }); veinM.color.setHex([0x1a7a6a, 0x30c8b0, 0x8affec][k]); };
    await prop(F, { prefix: 'DHVC', root, frames: 'ABC', w: 1.8, top: 4.1, yaw: 0, elev: 6, pose });
  }
}

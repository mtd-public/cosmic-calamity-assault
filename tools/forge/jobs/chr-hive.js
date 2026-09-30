// HIVE: the Hive Mind, the boss: a brain-coral mass about 4 m wide in a ribbed
// organic-mechanical cradle, four glowing conduits plugged into it. All rotation 0.
//   A-C pulse, D-E attack glow, F pain, G-L death
// The coral's meandering grooves are cut below an inner glowing shell, so the
// grooves show as teal light; one material drives the whole pulse.
import * as THREE from 'three';
import { renderChar } from '../lib/chr/job.js';
import { mesh, mat, glow, sph, cyl, V3, fbm, mulberry32, tubeGeo, ellipsoidGeo } from '../lib/chr/core.js';
import { pool, glowOrb } from '../lib/chr/parts.js';

const C = V3(0, 1.75, 0);          // brain centre
const RX = 2.0, RY = 1.3, RZ = 1.6; // brain radii

function coralGeo(detail = 6) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  const col = new Float32Array(p.count * 3);
  const ridge = new THREE.Color(0xd2aeb6), side = new THREE.Color(0x8a5f86), groove = new THREE.Color(0x3a2440);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const u = Math.atan2(v.x, v.z) / (Math.PI * 2) + 0.5, w = v.y * 0.5 + 0.5;
    // meandering ridges: a stripe field bent by two noise warps; big lobes on top
    const w1 = fbm(u * 4, w * 3, 4, 3, 71), w2 = fbm(u * 5 + 3, w * 4, 5, 3, 73);
    const s = Math.sin((u * 26 + w1 * 5.5) * Math.PI * 2 * 0.5 + (w * 10 + w2 * 4) * Math.PI);
    const r = Math.abs(s);                    // 0 in a groove, 1 on a ridge crest
    const lobe = 1 + 0.08 * (fbm(u * 3, w * 2, 3, 3, 79) - 0.5) + 0.05 * Math.sin(u * Math.PI * 6) * Math.sin(w * Math.PI * 3);
    const h = r < 0.28 ? 0.86 + 0.1 * (r / 0.28) : 0.96 + 0.04 * Math.sin((r - 0.28) / 0.72 * Math.PI / 2);
    // flatter underside where it sits in the cradle
    const k = h * lobe;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x * RX, v.y * RY, v.z * RZ);
    const c = r < 0.28 ? groove.clone().lerp(side, r / 0.28) : side.clone().lerp(ridge, Math.min(1, (r - 0.28) / 0.5));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildHive() {
  const root = new THREE.Group();
  const brain = new THREE.Group(); brain.position.copy(C); root.add(brain);
  const coralM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.0 });
  const coral = new THREE.Mesh(coralGeo(6), coralM); brain.add(coral);
  const innerM = new THREE.MeshBasicMaterial({ color: 0x2ee8d0, toneMapped: false });
  const inner = mesh(ellipsoidGeo(RX * 0.915, RY * 0.915, RZ * 0.915, 40, 24), innerM); brain.add(inner);
  // the core: a glowing eye of light at the front that swells to fire
  const core = glowOrb(0.35, 0xffffff, 0x7ffff0, 1); core.position.set(0, -0.1, RZ * 0.93); core.visible = false; brain.add(core);
  const flare = new THREE.Group(); flare.position.copy(core.position); flare.visible = false; brain.add(flare);
  for (let i = 0; i < 8; i++) { const c = mesh(new THREE.ConeGeometry(0.12, 1.1, 6), glow(i % 2 ? 0x9ffff4 : 0xffffff, 1), 0, 0, 0.55, Math.PI / 2, 0, 0); const q = new THREE.Group(); q.rotation.set(Math.sin(i * 1.3) * 0.6, Math.cos(i * 2.1) * 0.7, 0); q.add(c); flare.add(q); }
  flare.add(glowOrb(0.55, 0xffffff, 0xa0fff4, 1));
  // the cradle: a squat ribbed pedestal and curved ribs rising round the brain
  const dark = mat(0x3c3444, { rough: 0.35, metal: 0.5, env: true, envI: 0.5 });
  const boneM = mat(0xcbbf9f, { rough: 0.45 });
  const cradle = new THREE.Group(); root.add(cradle);
  cradle.add(mesh(cyl(2.25, 1.9, 0.45, 40), dark, 0, 0.225, 0));
  for (const y of [0.1, 0.28, 0.43]) cradle.add(mesh(new THREE.TorusGeometry(2.08 - y * 0.3, 0.05, 6, 40), boneM, 0, y, 0, Math.PI / 2, 0, 0));
  cradle.add(mesh(cyl(1.8, 1.5, 0.35, 32), dark, 0, 0.6, 0));
  const ribs = [];
  const NR = 12;
  for (let i = 0; i < NR; i++) {
    const a = (i / NR) * Math.PI * 2 + 0.13;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, el = -1.2 + t * 1.55;         // elevation up the brain's side
      const rr = 1.07 + 0.04 * Math.sin(t * Math.PI);
      pts.push(V3(Math.sin(a) * Math.cos(el) * RX * rr, C.y + Math.sin(el) * RY * rr, Math.cos(a) * Math.cos(el) * RZ * rr));
    }
    pts[0].y = 0.5; pts[0].multiply(V3(0.9, 1, 0.9));
    const rib = mesh(tubeGeo(pts, 0.085, 24, 7), i % 2 ? boneM : dark); cradle.add(rib);
    // knuckles along the rib
    for (const k of [2, 4]) cradle.add(mesh(sph(0.11, 8, 6), boneM, ...pts[k].toArray()));
    ribs.push(rib);
  }
  // conduits: four armoured cables with glowing bands, plugged into sockets on the brain
  const cabM = mat(0x2c2834, { rough: 0.4, metal: 0.6, env: true, envI: 0.4 });
  const bandM = new THREE.MeshBasicMaterial({ color: 0x35e8d0, toneMapped: false });
  const conduits = [];
  const paths = [
    { from: V3(-3.3, 0.02, 0.9), mid: V3(-3.0, 1.2, 0.6), to: V3(-1.75, 1.75, 0.55) },
    { from: V3(3.3, 0.02, 0.9), mid: V3(3.0, 1.2, 0.6), to: V3(1.75, 1.75, 0.55) },
    { from: V3(-2.4, 0.02, -2.2), mid: V3(-2.3, 3.4, -1.4), to: V3(-0.8, 2.85, -0.6) },
    { from: V3(2.4, 0.02, -2.2), mid: V3(2.3, 3.4, -1.4), to: V3(0.8, 2.85, -0.6) },
  ];
  for (const P of paths) {
    const g = new THREE.Group(); root.add(g);
    conduits.push({ g, ...P, home: P.to.clone() });
  }
  const buildConduit = (c, to, droop = 0) => {
    c.g.clear();
    const mid = c.mid.clone(); mid.y -= droop;
    const curve = new THREE.CatmullRomCurve3([c.from, c.from.clone().lerp(mid, 0.5).add(V3(0, 0.3, 0)), mid, mid.clone().lerp(to, 0.55), to]);
    c.g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.2, 10, false), cabM));
    for (let k = 1; k <= 7; k++) { const t = k / 8.5, p = curve.getPoint(t), tan = curve.getTangent(t); const ring = mesh(new THREE.TorusGeometry(0.215, 0.035, 5, 14), k % 2 ? bandM : cabM); ring.position.copy(p); ring.lookAt(p.clone().add(tan)); c.g.add(ring); }
    const end = curve.getPoint(1), tan = curve.getTangent(1);
    const sock = mesh(cyl(0.34, 0.26, 0.3, 14), cabM); sock.position.copy(end); sock.quaternion.setFromUnitVectors(V3(0, 1, 0), tan); c.g.add(sock);
    const cap = mesh(sph(0.2, 12, 8), bandM); cap.position.copy(end).addScaledVector(tan, 0.12); c.g.add(cap);
    c.g.add(mesh(cyl(0.3, 0.36, 0.1, 14), cabM, c.from.x, 0.05, c.from.z)); // floor socket
  };
  // ichor and sparks for pain/death
  const rnd = mulberry32(9);
  const spray = new THREE.Group(); root.add(spray);
  for (let i = 0; i < 24; i++) { const s = mesh(sph(0.06 + rnd() * 0.1, 8, 6), glow(i % 3 ? 0x4cf07a : 0xb8ffc8, 1)); s.dir = V3(rnd() * 2 - 1, rnd() * 1.2, rnd() * 0.8 + 0.4).normalize(); s.sp = 0.6 + rnd(); spray.add(s); }
  const sparks = new THREE.Group(); root.add(sparks);
  for (const c of conduits) for (let i = 0; i < 5; i++) { const s = mesh(new THREE.ConeGeometry(0.03, 0.35, 4), glow(i % 2 ? 0xffffff : 0x9ffff4, 1)); s.position.copy(c.to).add(V3((rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, 0.1)); s.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); sparks.add(s); }
  const smoke = new THREE.Group(); root.add(smoke);
  for (let i = 0; i < 12; i++) { const s = mesh(sph(0.3 + rnd() * 0.35, 10, 8), mat(i % 2 ? 0x34303a : 0x4c4652, { rough: 1 })); s.base = V3((rnd() - 0.5) * 3.2, 2.6 + rnd() * 1.0, (rnd() - 0.2) * 1.4); smoke.add(s); }
  const puddle = pool(1.6, 0x3fd06c, 21, { glow: true, sx: 1.5, sz: 0.8 }); puddle.position.z = 0.8; root.add(puddle);
  const H = { root, brain, coral, coralM, inner, innerM, core, flare, conduits, buildConduit, spray, sparks, smoke, puddle, cradle, ribs };
  H.reset = () => {
    brain.position.copy(C); brain.scale.set(1, 1, 1); brain.rotation.set(0, 0, 0);
    innerM.color.set(0x2ee8d0); coralM.color.set(0xffffff); coralM.emissive.set(0x000000);
    bandM.color.set(0x35e8d0);
    core.visible = false; flare.visible = false; core.scale.setScalar(1);
    spray.visible = false; sparks.visible = false; smoke.visible = false; puddle.visible = false;
    for (const c of conduits) buildConduit(c, c.home);
  };
  H.bandM = bandM;
  return H;
}

export default async function (F, params = {}) {
  const H = buildHive();
  const { brain, innerM, coralM, core, flare, conduits, spray, sparks, smoke, puddle } = H;
  const pulse = (k) => { const c = new THREE.Color(0x0c5a52).lerp(new THREE.Color(0x7ffff0), k); innerM.color.copy(c); H.bandM.color.copy(c); };
  const poses = {
    A: () => { pulse(0.25); brain.scale.setScalar(0.99); },
    B: () => { pulse(0.6); brain.scale.setScalar(1.0); },
    C: () => { pulse(1.0); brain.scale.setScalar(1.015); },
    // attack: the core swells at the front, then the salvo leaves in a blaze
    D: () => { pulse(1.0); innerM.color.set(0xb8fff8); brain.scale.setScalar(1.02); core.visible = true; core.scale.setScalar(1.3); coralM.emissive.set(0x0a2a28); },
    E: () => { innerM.color.set(0xffffff); H.bandM.color.set(0xffffff); brain.scale.setScalar(1.03); flare.visible = true; coralM.emissive.set(0x154a46); },
    // pain: the light turns bruised violet, the mass flinches, the sockets spark
    F: () => { innerM.color.set(0xd04cff); H.bandM.color.set(0xd04cff); brain.scale.set(0.97, 0.95, 0.97); brain.position.y = C.y - 0.04; sparks.visible = true; coralM.emissive.set(0x2a0a30); },
  };
  // death: convulse, burst, deflate, collapse into the cradle, the husk
  const death = (k) => {
    const sy = [1.02, 1.05, 0.82, 0.62, 0.48, 0.44][k], sxz = [1.0, 1.04, 1.05, 1.1, 1.13, 1.14][k];
    brain.scale.set(sxz, sy, sxz);
    brain.position.y = 0.55 + RY * sy * 0.95;
    brain.rotation.z = [0.03, -0.04, 0.05, 0.08, 0.09, 0.09][k];
    const glowC = [0xffffff, 0x9ffff4, 0x2a9a8c, 0x165a52, 0x0c2a28, 0x080c0c][k];
    innerM.color.set(glowC); H.bandM.color.set(k < 2 ? 0xffffff : glowC);
    coralM.color.set([0xffffff, 0xffffff, 0xe0d4dc, 0xbcb0b8, 0x9a9098, 0x8a8088][k]);
    sparks.visible = k <= 2;
    spray.visible = k === 1 || k === 2;
    for (const s of spray.children) { const t = k === 1 ? 0.6 : 1.1; s.position.copy(C).add(V3(0, 0.3, 0.6)).addScaledVector(s.dir, s.sp * t * 1.6); if (k === 2) s.position.y -= 0.8; }
    smoke.visible = k >= 2 && k <= 4;
    for (const s of smoke.children) { s.position.copy(s.base); s.position.y += (k - 2) * 0.3; s.scale.setScalar(1 + (k - 2) * 0.25); }
    puddle.visible = k >= 2; puddle.scale.setScalar([0, 0, 0.5, 0.8, 1, 1.1][k]);
    // conduits tear loose one after another and droop
    conduits.forEach((c, i) => {
      const loose = k >= [1, 2, 2, 3][i];
      if (loose) { const to = c.home.clone().add(V3(Math.sign(c.home.x) * 0.9, -0.9 - k * 0.15, 0.6)); to.y = Math.max(0.25, to.y); H.buildConduit(c, to, 0.4 + k * 0.1); }
      else H.buildConduit(c, c.home.clone().multiplyScalar(1).setY(c.home.y - (1.3 - RY * sy) * 0.6));
    });
    if (k === 0) { core.visible = true; core.scale.setScalar(0.9); }
  };
  for (const [i, f] of [...'GHIJKL'].entries()) poses[f] = () => death(i);
  await renderChar(F, params, {
    prefix: 'HIVE', dir: 'sprites/monsters', root: H.root,
    reset: () => H.reset(),
    poses, rot0: 'ABCDEFGHIJKL',
    bounds0: { w: 7.4, top: 4.4, bottom: -0.5 }, elev0: 10,
  });
}

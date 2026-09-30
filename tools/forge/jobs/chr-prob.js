// PROB: the Probe, a floating 1 m sphere of chrome plates on bone ribs, one big
// glowing lens, three trailing antennae.
//   A-B hover (8), C-D fire (8), E pain (8), F-J death / explode (0)
import * as THREE from 'three';
import { renderChar } from '../lib/chr/job.js';
import { mesh, mat, glow, sph, cyl, limb, ellipsoidGeo, V3, mulberry32, camo } from '../lib/chr/core.js';
import { rockGeo } from '../lib/gb.js';

const R0 = 0.45;       // sphere radius
const CY = 0.62;       // hover height of the centre above the actor's origin

function buildProbe() {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = CY; root.add(body);
  const chrome = mat(0xe2e8f0, { rough: 0.14, metal: 1.0, env: true });
  const chromeD = mat(0xa8b0ba, { rough: 0.22, metal: 1.0, env: true });
  const bone = mat(0xdcd0b0, { rough: 0.5, map: camo('alien', 0.25) });
  const coreM = mat(0x1d1724, { rough: 0.6, emissive: 0x241036, ei: 1 });
  const core = mesh(sph(R0 * 0.93, 24, 16), coreM); body.add(core);
  const coreHot = mesh(sph(R0 * 0.8, 20, 14), glow(0xff9a40, 1)); coreHot.visible = false; body.add(coreHot);
  // chrome plates: two rings of three, separated by the ribs; the front is left open for the lens
  const plates = [];
  const GAP = 0.2;
  for (const [t0, t1] of [[0.08, 1.46], [1.68, 2.9]]) {
    for (let i = 0; i < 3; i++) {
      const p0 = Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / 3) - Math.PI / 3 + GAP / 2; // ribs at the front and ±120°
      const g = new THREE.SphereGeometry(R0, 14, 8, p0, Math.PI * 2 / 3 - GAP, t0, t1 - t0);
      const pl = new THREE.Group(); body.add(pl);
      pl.add(mesh(g, i === 1 ? chromeD : chrome));
      // panel seam lines + rivets
      const mid = new THREE.Vector3().setFromSphericalCoords(R0, (t0 + t1) / 2, p0 + (Math.PI * 2 / 3 - GAP) / 2 - Math.PI / 2);
      // SphereGeometry uses x = -r cos(phi) sin(theta), z = r sin(phi) sin(theta); convert:
      const ph = p0 + (Math.PI * 2 / 3 - GAP) / 2, th = (t0 + t1) / 2;
      mid.set(-R0 * Math.cos(ph) * Math.sin(th), R0 * Math.cos(th), R0 * Math.sin(ph) * Math.sin(th));
      pl.dir = mid.clone().normalize();
      pl.add(mesh(sph(0.018, 8, 6), chromeD, ...mid.clone().multiplyScalar(1.01).toArray()));
      plates.push(pl);
    }
  }
  // bone ribs along the three meridians, and an equatorial bone band
  const ribs = [];
  for (const i of [1, 2]) {
    const az = Math.PI * 1.5 + i * (Math.PI * 2 / 3); // the rear gaps (the front gap holds the lens)
    const rg = new THREE.Group(); rg.rotation.y = az; body.add(rg);
    const t = new THREE.TorusGeometry(R0 * 1.02, 0.035, 6, 20, Math.PI); t.rotateZ(-Math.PI / 2);
    rg.add(mesh(t, bone));
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k + 0.5) * Math.PI / 5; rg.add(mesh(sph(0.045, 8, 6), bone, Math.cos(a) * R0 * 1.03, Math.sin(a) * R0 * 1.03, 0)); }
    rg.dir = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    ribs.push(rg);
  }
  // front rib stubs above and below the lens
  for (const sgn of [1, -1]) {
    const t = new THREE.TorusGeometry(R0 * 1.02, 0.035, 6, 8, Math.PI / 2 - 0.45); t.rotateZ(sgn > 0 ? 0.45 : -Math.PI / 2); t.rotateY(-Math.PI / 2);
    body.add(mesh(t, bone));
  }
  const band = mesh(new THREE.TorusGeometry(R0 * 1.03, 0.03, 6, 28, Math.PI * 1.55), bone); band.rotation.set(Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.225); body.add(band);
  // the lens: a chrome housing, a glowing iris, a bright core
  const eye = new THREE.Group(); eye.position.z = R0 * 0.9; body.add(eye);
  eye.add(mesh(cyl(0.2, 0.19, 0.1, 24), chromeD, 0, 0, 0.0, Math.PI / 2, 0, 0));
  eye.add(mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 24), chrome, 0, 0, 0.05));
  const irisM = glow(0x3fe6e0, 1), coreE = glow(0xe8ffff, 1);
  const iris = mesh(new THREE.CircleGeometry(0.15, 24), irisM, 0, 0, 0.056); eye.add(iris);
  const pupil = mesh(new THREE.CircleGeometry(0.07, 20), coreE, 0, 0, 0.06); eye.add(pupil);
  const glass = mesh(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, 0.9), mat(0x9fd8e0, { rough: 0.05, metal: 0.1, opacity: 0.35 }), 0, 0, -0.03, Math.PI / 2, 0, 0);
  eye.add(glass);
  const irisDim = glow(0x1a5a58, 1);
  // aperture blades that open when charging
  const blades = [];
  for (let i = 0; i < 6; i++) {
    const bg = new THREE.Group(); bg.rotation.z = i * Math.PI / 3; eye.add(bg);
    const bl = mesh(new THREE.BoxGeometry(0.07, 0.03, 0.02), chromeD, 0, 0.2, 0.06); bg.add(bl); blades.push(bl);
  }
  const charge = new THREE.Group(); charge.position.z = 0.1; eye.add(charge);
  charge.add(mesh(sph(0.06, 12, 8), glow(0xffffff, 1)));
  const halo = new THREE.MeshBasicMaterial({ color: 0x7ffff0, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
  charge.add(mesh(sph(0.12, 14, 10), halo));
  charge.visible = false;
  const burst = new THREE.Group(); burst.position.z = 0.12; eye.add(burst);
  for (let i = 0; i < 6; i++) { const c = mesh(new THREE.ConeGeometry(0.05, 0.35, 5), glow(i % 2 ? 0x9ffff4 : 0xffffff, 1), 0, 0, 0.17, Math.PI / 2, 0, 0); const p = new THREE.Group(); p.rotation.set(Math.sin(i) * 0.5, Math.cos(i * 1.7) * 0.5, 0); p.add(c); burst.add(p); }
  burst.add(mesh(sph(0.13, 12, 8), glow(0xffffff, 1)));
  burst.visible = false;
  // antennae: three segmented whips trailing from the back, beaded tips
  const antM = mat(0x8a8494, { rough: 0.3, metal: 0.8, env: true });
  const ants = [];
  for (let i = 0; i < 3; i++) {
    const az = (i - 1) * 0.7;
    const base = new THREE.Group();
    base.position.set(Math.sin(az) * R0 * 0.75, -R0 * 0.35, -Math.cos(az) * R0 * 0.75);
    base.rotation.set(-1.25, az * 0.9, 0);
    body.add(base);
    base.add(mesh(cyl(0.05, 0.04, 0.08, 10), chromeD, 0, 0, 0, Math.PI / 2, 0, 0));
    const segs = [];
    let parent = base;
    for (let k = 0; k < 5; k++) {
      const b = limb(parent, 0.16, 0.028 - k * 0.004, 0.024 - k * 0.004, antM, { seg: 6 });
      segs.push(b.joint); parent = b.end;
    }
    parent.add(mesh(sph(0.03, 8, 6), glow(0x3fe6e0, 1)));
    ants.push({ base, segs, i });
  }
  // debris for the explosion
  const rnd = mulberry32(5);
  const debris = [];
  for (let i = 0; i < 16; i++) {
    const m = mesh(rockGeo(i * 1.7, 0, 0.5), i % 3 === 0 ? bone : i % 3 === 1 ? chrome : chromeD);
    const s = 0.04 + rnd() * 0.06; m.scale.set(s * 1.4, s * 0.5, s);
    m.dir = V3(rnd() * 2 - 1, rnd() * 1.4 - 0.2, rnd() * 2 - 1).normalize();
    m.sp = 0.6 + rnd() * 0.8; m.spin = V3(rnd() * 5, rnd() * 5, rnd() * 5);
    m.visible = false; root.add(m); debris.push(m);
  }
  const fire = new THREE.Group(); root.add(fire);
  const fireCols = [0xfff4c8, 0xffd060, 0xff9a30, 0xe8581c];
  for (let i = 0; i < 26; i++) {
    const r = i < 10 ? 0.16 + rnd() * 0.2 : 0.05 + rnd() * 0.09;
    const spread = i < 10 ? 0.7 : 1.4;
    const f = mesh(sph(r, 12, 8), glow(fireCols[i < 10 ? i % 3 : 1 + (i % 3)], 1), (rnd() - 0.5) * spread, CY + (rnd() - 0.5) * spread * 0.85, (rnd() - 0.5) * spread * 0.7);
    f.base = f.position.clone(); f.r = r; fire.add(f);
  }
  const smoke = new THREE.Group(); root.add(smoke);
  for (let i = 0; i < 10; i++) {
    const r = 0.12 + rnd() * 0.18;
    const s = mesh(sph(r, 10, 8), mat(i % 2 ? 0x2c2a2e : 0x4a4648, { rough: 1 }), (rnd() - 0.5) * 0.8, CY + (rnd() - 0.3) * 0.7, (rnd() - 0.5) * 0.6);
    s.base = s.position.clone(); smoke.add(s);
  }
  const P = { root, body, plates, ribs, band, eye, iris, irisM, irisDim, pupil, blades, charge, burst, ants, core, coreHot, debris, fire, smoke };
  P.reset = () => {
    body.position.set(0, CY, 0); body.rotation.set(0, 0, 0); body.visible = true; body.scale.setScalar(1);
    for (const p of plates) { p.position.set(0, 0, 0); p.rotation.set(0, 0, 0); p.visible = true; }
    for (const r of ribs) { r.position.set(0, 0, 0); r.visible = true; }
    band.visible = true; eye.visible = true; eye.position.set(0, 0, R0 * 0.9); eye.rotation.set(0, 0, 0);
    iris.material = irisM; charge.visible = false; burst.visible = false;
    for (const b of blades) b.position.y = 0.2;
    coreHot.visible = false; core.visible = true;
    for (const d of debris) d.visible = false;
    fire.visible = false; smoke.visible = false;
    antPose(0);
  };
  const antPose = (ph, k = 1) => {
    for (const a of ants) a.segs.forEach((j, n) => j.rotation.set(-0.12 + Math.sin(ph + n * 0.8 + a.i * 2) * 0.14 * k, 0, Math.sin(ph * 0.7 + n + a.i) * 0.12 * k));
  };
  P.antPose = antPose;
  return P;
}

export default async function (F, params = {}) {
  const P = buildProbe();
  const { body, plates, ribs, eye, iris, charge, burst, blades, ants } = P;
  const poses = {
    A: () => { body.position.y = CY; body.rotation.set(0.05, 0, 0.04); P.antPose(0); },
    B: () => { body.position.y = CY + 0.04; body.rotation.set(-0.02, 0, -0.04); P.antPose(2.2); },
    // charging: the aperture opens, light gathers in the lens
    C: () => { body.position.y = CY + 0.02; body.rotation.set(-0.08, 0, 0); P.antPose(1, 1.6); for (const b of blades) b.position.y = 0.26; charge.visible = true; charge.scale.setScalar(1); },
    // fire: the pulse leaves in a burst of light, the body kicks back
    D: () => { body.position.set(0, CY + 0.03, -0.04); body.rotation.set(-0.18, 0, 0); P.antPose(3, 2); for (const b of blades) b.position.y = 0.28; burst.visible = true; },
    // pain: knocked askew, the lens dims, a plate jolted loose
    E: () => {
      body.position.set(0.05, CY - 0.05, -0.03); body.rotation.set(0.3, 0.2, 0.35); P.antPose(4, 2.5);
      iris.material = P.irisDim;
      plates[1].position.copy(plates[1].dir).multiplyScalar(0.06); plates[1].rotation.set(0.2, 0, 0.15);
    },
  };
  // death: shudder and crack, blow apart, fireball, falling debris, wreckage on the floor
  const DY = 0.5;
  const death = (k) => {
    P.root.rotation.y = 0;
    body.rotation.set(0.3, DY, 0.2 + k * 0.3);
    if (k === 0) {
      body.position.set(0, CY - 0.08, 0);
      for (const [i, p] of plates.entries()) { p.position.copy(p.dir).multiplyScalar(0.04 + (i % 2) * 0.03); }
      P.coreHot.visible = true; P.coreHot.scale.setScalar(0.95);
      iris.material = glow(0xffffff, 1);
      P.antPose(5, 3);
      return;
    }
    if (k === 1) {
      // blown apart: plates and ribs fly outward from a white-hot core
      body.position.set(0, CY - 0.05, 0);
      for (const [i, p] of plates.entries()) { p.position.copy(p.dir).multiplyScalar(0.28 + (i % 3) * 0.06); p.rotation.set(i * 0.4, i * 0.3, i * 0.5); }
      for (const [i, r] of ribs.entries()) r.position.copy(r.dir).multiplyScalar(0.18 + i * 0.03);
      P.band.visible = false;
      eye.position.set(0, 0.1, R0 + 0.3); eye.rotation.set(0.6, 0.3, 0);
      P.core.visible = false; P.coreHot.visible = true; P.coreHot.scale.setScalar(1.2);
      P.fire.visible = true;
      for (const f of P.fire.children) { f.position.copy(f.base).sub(V3(0, CY, 0)).multiplyScalar(0.5).add(V3(0, CY, 0)); f.scale.setScalar(0.6); }
      P.antPose(6, 3);
      return;
    }
    // k 2..4: fireball → smoke and falling debris → wreckage
    body.visible = false;
    const t = [0, 0, 0.25, 0.6, 1][k];
    P.fire.visible = k === 2 || k === 3;
    for (const f of P.fire.children) { f.position.copy(f.base).sub(V3(0, CY, 0)).multiplyScalar(k === 2 ? 1.1 : 1.35).add(V3(0, CY + (k === 3 ? 0.15 : 0), 0)); f.scale.setScalar(k === 2 ? 1.2 : 0.55); }
    P.smoke.visible = k === 3 || k === 4;
    for (const s of P.smoke.children) { s.position.copy(s.base).sub(V3(0, CY, 0)).multiplyScalar(1.3).add(V3(0, CY + 0.35, 0)); s.scale.setScalar(k === 3 ? 1 : 0.6); s.visible = k === 3 || s.base.y < CY; if (k === 4) s.position.y = 0.1 + (s.base.y - CY + 0.3) * 0.2; }
    for (const d of P.debris) {
      d.visible = true;
      const h = d.dir.clone().multiplyScalar(d.sp * t * 1.1);
      let y = CY + d.dir.y * d.sp * t * 1.3 - 2.0 * t * t;
      if (k === 4) y = 0;
      d.position.set(h.x, Math.max(0.03, y), h.z);
      d.rotation.set(d.spin.x * t, d.spin.y * t, d.spin.z * t);
      if (k === 4) d.rotation.set(0, d.spin.y, 0);
    }
    if (k === 4) {
      // the lens housing and a couple of plates lie in the wreck
      body.visible = true; P.core.visible = false; P.coreHot.visible = false;
      for (const p of plates) p.visible = false; for (const r of ribs) r.visible = false; P.band.visible = false;
      for (const a of ants) a.base.visible = true;
      body.position.set(0.05, 0.12, 0.05); body.rotation.set(-1.3, 0.4, 0);
      eye.position.set(0, 0, 0); iris.material = P.irisDim;
      plates[0].visible = true; plates[0].position.set(0.3, -0.05, -0.2); plates[0].rotation.set(1.2, 0, 0.3);
      plates[4].visible = true; plates[4].position.set(-0.4, 0.1, 0.1); plates[4].rotation.set(-0.5, 0.8, 1.9);
      ribs[0].visible = true; ribs[0].position.set(-0.1, 0.05, -0.3); ribs[0].rotation.set(0, 0.5, 1.5);
      P.antPose(0, 0.3);
    }
  };
  for (const [i, f] of [...'FGHIJ'].entries()) poses[f] = () => death(i);
  await renderChar(F, params, {
    prefix: 'PROB', dir: 'sprites/monsters', root: P.root,
    reset: () => P.reset(),
    poses, rot8: 'ABCDE', rot0: 'FGHIJ',
    bounds: { w: 1.5, top: 1.3, bottom: -0.05 },
    bounds0: { w: 2.6, top: 2.0, bottom: -0.3 }, elev0: 12,
  });
}

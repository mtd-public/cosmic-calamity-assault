// Vehicle models. Built at real scale, centred on the ground under the chassis,
// nose down -z. Returns named parts the renderer animates: wheels (spin +
// steer), suspension, the turret (yaw / pitch), headlights, thrusters.
import * as THREE from 'three';
import { GB, MAT, glowMat, basicGlow, emissiveMat, mesh, cboxGeo } from './models.js';
import { makeWeapon } from './gunmodels.js';
import { VEHICLES } from './vehicles.js';

const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const at = (m, x, y, z, rx = 0, ry = 0, rz = 0, parent) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };

export function makeVehicle(type) {
  const d = VEHICLES[type];
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body); // pitch/roll live here; g carries yaw
  const r = { group: g, body, type, wheels: [], lamps: [], parts: {} };
  const box = (mat, w, h, dd, x, y, z, c = 0.05, parent = body, rx = 0, ry = 0, rz = 0) => at(cboxGeo(mat, w, h, dd, c), x, y, z, rx, ry, rz, parent);
  if (type === 'mule') {
    // chassis: a curved side profile (raked hood, rounded cab, bed) extruded across, with rounded wheel arches
    const arc = (cx, cy, r, a0, a1, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
    const gb = new GB();
    const prof = [[-2.75, 0.62], ...arc(-2.45, 0.92, 0.3, Math.PI, Math.PI / 2, 5), [-1.5, 1.28], ...arc(-1.05, 1.28, 0.28, Math.PI, Math.PI / 2, 4), [0.9, 1.6], ...arc(1.3, 1.25, 0.4, Math.PI / 2, 0, 5), [2.55, 1.2], ...arc(2.55, 0.9, 0.3, 0, -Math.PI / 2, 4), [-2.4, 0.5], ...arc(-2.55, 0.62, 0.2, -Math.PI / 2, -Math.PI, 3)].map(([z, y]) => [z, y]);
    gb.extrude('ecs', prof, 'x', -1.0, 1.0);
    // side sills + rounded wheel arches (half tubes) + bumpers + bed + skid plate
    for (const sx of [-1, 1]) {
      gb.addGeo('ecs', new THREE.CylinderGeometry(0.28, 0.28, 2.6, 12, 1, true, 0, Math.PI), new THREE.Matrix4().compose(new THREE.Vector3(sx * 1.0, 1.0, 0.35), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)), { su: 1, sv: 2 });
      for (const az of [-1.55, 1.55]) gb.addGeo('gunmetal', new THREE.CylinderGeometry(0.78, 0.78, 0.5, 14, 1, true, -Math.PI / 2, Math.PI), new THREE.Matrix4().compose(new THREE.Vector3(sx * 1.08, 0.62, az), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)), { su: 2, sv: 0.5 });
    }
    gb.addGeo('gunmetal', new THREE.CylinderGeometry(0.12, 0.12, 2.3, 10), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.95, -2.85), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)), { su: 3, sv: 0.3 }); // tube bumper
    gb.cbox('gunmetal', [-1.05, 0.5, -1.9], [1.05, 0.7, 2.2], 0.1); // skid plate
    gb.cbox('black', [-0.95, 1.2, 1.15], [0.95, 1.4, 2.3], 0.08); // rear bed
    gb.addGeo('gunmetal', new THREE.CylinderGeometry(0.16, 0.16, 0.6, 10), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.15, -2.95), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))); // winch drum
    for (const m of gb.meshes()) { m.matrixAutoUpdate = true; body.add(m); }
    // roll cage
    const tube = (x0, y0, z0, x1, y1, z1, rr = 0.045) => { const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0); const m = mesh(new THREE.CylinderGeometry(rr, rr, L, 7), 'gunmetal'); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.lookAt(x1, y1, z1); m.rotateX(Math.PI / 2); body.add(m); return m; };
    for (const sx of [-1, 1]) { tube(sx * 0.95, 1.4, -0.9, sx * 0.9, 2.55, -0.5); tube(sx * 0.95, 1.4, 1.0, sx * 0.9, 2.55, 0.5); tube(sx * 0.9, 2.55, -0.5, sx * 0.9, 2.55, 0.5); }
    tube(-0.9, 2.55, -0.5, 0.9, 2.55, -0.5); tube(-0.9, 2.55, 0.5, 0.9, 2.55, 0.5);
    // windscreen frame + glass, seats, wheel, dash
    for (const [y, z] of [[2.2, -1.25], [1.62, -1.35]]) { const bar = mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), 'gunmetal'); bar.rotation.z = Math.PI / 2; bar.position.set(0, y, z); body.add(bar); }
    for (const sx of [-1, 1]) { const post = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), 'gunmetal'); post.position.set(sx * 0.98, 1.9, -1.3); post.rotation.x = -0.15; body.add(post); }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.56), MAT('glass')); glass.position.set(0, 1.9, -1.3); glass.rotation.x = -0.15; body.add(glass);
    for (const sx of [-0.55, 0.55]) { const cush = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12), 'black'); cush.position.set(sx, 1.05, -0.3); cush.scale.set(1, 1, 1.0); body.add(cush); const back = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12, 1, false), 'black'); back.rotation.x = Math.PI / 2 - 0.2; back.position.set(sx, 1.35, 0.0); back.scale.set(1, 1, 1); body.add(back); }
    const wheel = mesh(new THREE.TorusGeometry(0.19, 0.03, 6, 14), 'black'); wheel.position.set(-0.55, 1.55, -1.2); wheel.rotation.x = -0.5; body.add(wheel); r.parts.steering = wheel;
    box('gunmetal', 1.8, 0.16, 0.3, 0, 1.55, -1.15, 0.03);
    // wheels: a rim, a tyre, tread blocks, on a suspension arm; front pair steers
    for (const [sx, sz, front] of [[-1, -1.55, true], [1, -1.55, true], [-1, 1.55, false], [1, 1.55, false]]) {
      const hub = new THREE.Group(); hub.position.set(sx * 1.05, d.wheelR, sz); body.add(hub); // steer pivot
      const spin = new THREE.Group(); hub.add(spin);
      const tyre = mesh(new THREE.TorusGeometry(d.wheelR - 0.16, 0.17, 10, 22), 'tire'); tyre.rotation.y = Math.PI / 2; tyre.scale.set(1, 1, 1.25); spin.add(tyre);
      for (let i = 0; i < 18; i++) { const tr = mesh(new THREE.BoxGeometry(0.36, 0.035, 0.05), 'tire'); const a = (i / 18) * Math.PI * 2; tr.position.set(0, Math.cos(a) * (d.wheelR - 0.01), Math.sin(a) * (d.wheelR - 0.01)); tr.rotation.x = -a; spin.add(tr); }
      const rim = mesh(new THREE.CylinderGeometry(d.wheelR * 0.62, d.wheelR * 0.62, 0.4, 16), 'gunmetal'); rim.rotation.z = Math.PI / 2; spin.add(rim);
      for (let i = 0; i < 6; i++) { const spoke = mesh(new THREE.BoxGeometry(0.06, d.wheelR * 0.5, 0.08), 'black'); const a = (i / 6) * Math.PI * 2; spoke.position.set(sx * 0.2, Math.cos(a) * d.wheelR * 0.3, Math.sin(a) * d.wheelR * 0.3); spoke.rotation.x = -a; spin.add(spoke); }
      const hubcap = mesh(new THREE.SphereGeometry(0.12, 8, 6), 'ecs'); hubcap.position.x = sx * 0.24; spin.add(hubcap);
      const arm = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), 'gunmetal'); arm.rotation.z = Math.PI / 2; arm.position.set(sx * 0.65, d.wheelR + 0.15, sz); body.add(arm);
      const spring = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6), 'c_orange'); spring.position.set(sx * 0.8, d.wheelR + 0.45, sz); spring.rotation.z = sx * 0.3; body.add(spring);
      r.wheels.push({ hub, spin, front, arm, spring, side: sx });
    }
    // turret: ring, pintle, the chaingun, a gunner's shield plate
    const ring = mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 16), 'gunmetal'); ring.rotation.x = Math.PI / 2; ring.position.set(0, 1.45, 1.55); body.add(ring);
    const tYaw = new THREE.Group(); tYaw.position.set(...d.turret.pos); body.add(tYaw); r.parts.turretYaw = tYaw;
    const post = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), 'gunmetal'); post.position.y = -0.2; tYaw.add(post);
    const tPitch = new THREE.Group(); tPitch.position.y = 0.05; tYaw.add(tPitch); r.parts.turretPitch = tPitch;
    const gun = makeWeapon('chaingun'); gun.group.position.set(0, 0.25, -0.3); tPitch.add(gun.group); r.gun = gun;
    const plate = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12, 1, true, -0.8, 1.6), 'ecs'); plate.position.set(0, 0.55, -0.25); plate.rotation.y = Math.PI; tPitch.add(plate);
    const seat = mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), 'black'); seat.position.set(0, -0.15, 0.3); tYaw.add(seat);
    // headlights, tail lights, antenna
    for (const L of d.lights) { const sp = new THREE.Sprite(glowMat(0xfff0c0, 0.9)); sp.scale.set(0.6, 0.6, 1); sp.position.set(...L); body.add(sp); const lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), basicGlow(0xffffff, 0.9)); lens.position.set(L[0], L[1], L[2] - 0.02); body.add(lens); r.lamps.push(sp); }
    for (const sx of [-1, 1]) { const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.03), emissiveMat(0xff3020, 2)); tl.position.set(sx * 0.85, 1.1, 2.62); body.add(tl); }
    const ant = mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.4, 5), 'black'); ant.position.set(-1.1, 2.0, 1.6); body.add(ant);
    const stripe = mesh(new THREE.BoxGeometry(1.6, 0.03, 0.4), 'c_orange'); stripe.position.set(0, 1.585, -1.8); stripe.rotation.x = 0.15; body.add(stripe);
    r.exhaust = new THREE.Vector3(1.0, 0.7, 2.4);
  } else {
    // SLIVER: a fuselage lathe, canard wings with the cannons, handlebars, saddle, anti-grav dish, rear thruster
    const fus = mesh(lathe([[0.02, -1.8], [0.3, -1.4], [0.5, -0.6], [0.55, 0.3], [0.42, 1.0], [0.28, 1.4], [0.02, 1.6]], 12), 'vyrr'); fus.rotation.x = Math.PI / 2; fus.position.set(0, 0.55, 0); fus.scale.set(1.2, 0.8, 1); body.add(fus);
    const dish = mesh(lathe([[0.02, 0], [0.9, 0.06], [1.15, 0.22], [1.05, 0.34], [0.02, 0.36]], 14), 'vyrrGold'); dish.position.set(0, 0.05, 0.1); body.add(dish);
    const gl = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.15, 20), basicGlow(0x9b6bff, 0.55)); gl.rotation.x = Math.PI / 2; gl.position.set(0, 0.04, 0.1); body.add(gl); r.parts.glowRing = gl;
    for (const sx of [-1, 1]) {
      const gb = new GB();
      const arcW = (cx, cy, r, a0, a1, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
      gb.extrude('vyrr', [[-1.1, 0.0], ...arcW(-0.3, -0.05, 0.3, Math.PI * 1.15, Math.PI * 1.55, 5), [1.0, -0.42], ...arcW(1.0, -0.1, 0.32, -Math.PI / 2, 0.3, 5), [0.4, 0.3]].map(([z, y]) => [z + 0.2, y + 0.55]), 'x', sx > 0 ? 0.35 : -1.5, sx > 0 ? 1.5 : -0.35);
      for (const m of gb.meshes()) { m.matrixAutoUpdate = true; body.add(m); }
      const can = mesh(lathe([[0.04, -0.6], [0.12, -0.4], [0.14, 0.2], [0.09, 0.5]], 8), 'vyrrGold'); can.rotation.x = Math.PI / 2; can.position.set(sx * 1.05, 0.55, -0.9); body.add(can);
      const mz = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), emissiveMat(0x9b6bff, 3)); mz.position.set(sx * 1.05, 0.55, -1.32); body.add(mz);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.6), emissiveMat(0x8cffb0, 1.6)); tip.position.set(sx * 1.45, 0.58, 0.2); body.add(tip);
    }
    const saddle = mesh(new THREE.BoxGeometry(0.5, 0.14, 0.9), 'black'); saddle.position.set(0, 0.85, 0.35); body.add(saddle);
    const bars = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), 'vyrrGold'); bars.rotation.z = Math.PI / 2; bars.position.set(0, 1.2, -0.55); body.add(bars); r.parts.bars = bars;
    const stem = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 6), 'vyrr'); stem.position.set(0, 0.95, -0.6); stem.rotation.x = 0.4; body.add(stem);
    const canopy = mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, 1.1), 'pod'); canopy.position.set(0, 0.7, -0.7); canopy.scale.set(0.9, 0.5, 1.4); body.add(canopy);
    const thr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.3, 10, 1, true), basicGlow(0x9b6bff, 0.7)); thr.rotation.x = Math.PI / 2; thr.position.set(0, 0.6, 1.55); body.add(thr);
    const jet = new THREE.Sprite(glowMat(0xb68cff, 0.9)); jet.scale.set(1.2, 1.2, 1); jet.position.set(0, 0.6, 1.7); body.add(jet); r.parts.jet = jet;
    r.exhaust = new THREE.Vector3(0, 0.6, 1.7);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return r;
}

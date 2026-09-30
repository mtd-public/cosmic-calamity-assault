// OVSR: the Overseer, a 2.4 m Grey elder in a ribbed carapace mantle, floating.
//   A-D float (8), E-F raise hands (8), G-H lance (8), I pain (8), J-O death (0)
import * as THREE from 'three';
import { buildOverseer } from '../lib/chr/aliens.js';
import { handQ } from '../lib/chr/biped.js';
import { headTurn } from '../lib/chr/poses.js';
import { renderChar } from '../lib/chr/job.js';
import { pool } from '../lib/chr/parts.js';
import { V3 } from '../lib/chr/core.js';

export default async function (F, params = {}) {
  const R = buildOverseer();
  const { rig, pelvis, spine, chest, arms, hands, plates, orbs, lance, robe } = R;
  const ichor = pool(0.55, 0x4cf07a, 14, { glow: true, sx: 1.4, sz: 0.9 }); ichor.visible = false; R.root.add(ichor);
  const sway = (ph, amt = 0.05) => { for (const p of plates) p.rotation.set(Math.sin(ph + p.a * 2) * amt, 0, Math.cos(ph + p.a * 3) * amt * 0.5); };
  const splay = (amt, droop = 0) => {
    for (const p of plates) {
      const axis = V3(Math.cos(p.a), 0, -Math.sin(p.a));
      p.setRotationFromAxisAngle(axis, amt * (0.8 + 0.4 * Math.sin(p.a * 5)));
      p.position.y = 0.11 - droop;
    }
  };
  const float = (k) => {
    rig.position.y = [0, 0.03, 0.045, 0.02][k];
    spine.rotation.set(0.04, 0, 0); chest.rotation.set(0.06, [0.05, 0, -0.05, 0][k], 0);
    headTurn(R, 0.1, [0.15, 0.05, -0.12, -0.03][k], [0.05, 0.0, -0.05, 0][k]);
    for (const A of arms) {
      const s = R.shPos(A.i);
      const ph = k * Math.PI / 2 + A.i * Math.PI;
      R.arm(A.i, s.clone().add(V3(-A.side * 0.12, -0.72 + Math.sin(ph) * 0.03, 0.2 + Math.cos(ph) * 0.05)), { pole: V3(-A.side * 0.4, 0, -1), hand: handQ(V3(-A.side * 0.1, -0.6, 0.8), V3(A.side * 0.7, 0, 0.3), A.side) });
      hands[A.i].pose(0.25 + 0.15 * Math.sin(ph), 0.5);
    }
    sway(k * Math.PI / 2);
  };
  const poses = {
    A: () => float(0), B: () => float(1), C: () => float(2), D: () => float(3),
    // raising the dead: the arms lift, palms up, the cranium lighting violet
    E: () => {
      rig.position.y = 0.03; spine.rotation.set(-0.03, 0, 0); chest.rotation.set(-0.05, 0, 0);
      headTurn(R, -0.1, 0, 0);
      for (const A of arms) { const s = R.shPos(A.i); R.arm(A.i, s.clone().add(V3(-A.side * 0.4, -0.12, 0.4)), { pole: V3(-A.side, -0.8, 0), hand: handQ(V3(-A.side * 0.3, 0.1, 1), V3(0, 1, 0), A.side) }); hands[A.i].pose(0.2, 0.9); orbs[A.i].visible = true; orbs[A.i].scale.setScalar(0.7); }
      R.glow(0.8); sway(1, 0.08);
    },
    F: () => {
      rig.position.y = 0.06; spine.rotation.set(-0.08, 0, 0); chest.rotation.set(-0.12, 0, 0);
      headTurn(R, -0.35, 0, 0);
      for (const A of arms) { const s = R.shPos(A.i); R.arm(A.i, s.clone().add(V3(-A.side * 0.36, 0.62, 0.12)), { pole: V3(-A.side, -0.5, -0.3), hand: handQ(V3(-A.side * 0.2, 1, 0.1), V3(A.side * 0.8, 0.2, 0.3), A.side) }); hands[A.i].pose(0.1, 1); orbs[A.i].visible = true; orbs[A.i].scale.setScalar(1.3); }
      R.glow(2.2); sway(2, 0.12);
    },
    // the lance: hands brought together, then thrust out as the beam leaves them
    G: () => {
      rig.position.y = 0.02; spine.rotation.set(0.05, 0, 0); chest.rotation.set(0.05, 0, 0);
      headTurn(R, 0.05, 0, 0);
      const c = R.toRig(chest, V3(0, 0.12, 0.42));
      for (const A of arms) { R.arm(A.i, c.clone().add(V3(-A.side * 0.09, 0, -0.02)), { pole: V3(-A.side, -0.8, -0.2), hand: handQ(V3(A.side * 0.4, 0.4, 0.8), V3(A.side, 0, 0.4), A.side) }); hands[A.i].pose(0.3, 0.6); }
      lance.visible = true; lance.position.copy(c).add(V3(0, 0.02, 0.1)); lance.scale.setScalar(0.55);
      for (const ch of lance.children) if (ch.type === 'Group' && ch.children[0]?.geometry?.type === 'ConeGeometry') ch.visible = false;
      R.glow(1.2); sway(3, 0.06);
    },
    H: () => {
      rig.position.y = 0.02; rig.position.z = -0.04; spine.rotation.set(0.12, 0, 0); chest.rotation.set(0.1, 0, 0);
      headTurn(R, 0.05, 0, 0);
      const c = R.toRig(chest, V3(0, 0.1, 0.62));
      for (const A of arms) { R.arm(A.i, c.clone().add(V3(-A.side * 0.12, 0, -0.04)), { pole: V3(-A.side, -0.8, -0.2), hand: handQ(V3(0, 0.5, 1), V3(0, 0, 1), A.side) }); hands[A.i].pose(0.05, 1); }
      lance.visible = true; lance.position.copy(c).add(V3(0, 0.02, 0.14)); lance.scale.setScalar(1.25);
      for (const ch of lance.children) ch.visible = true;
      R.glow(2.6); sway(4, 0.1);
    },
    // pain: jerked back, the light in the skull stuttering
    I: () => {
      rig.position.y = 0.0; rig.rotation.x = -0.12; spine.rotation.set(-0.1, 0.1, 0.05); chest.rotation.set(-0.1, 0.15, 0.05);
      headTurn(R, -0.4, 0.3, 0.3);
      const s0 = R.shPos(0), s1 = R.shPos(1);
      R.arm(0, s0.clone().add(V3(-0.35, 0.05, 0.25)), { pole: V3(0, -1, -0.4) }); R.arm(1, s1.clone().add(V3(0.3, -0.2, 0.35)), { pole: V3(0, -1, -0.4) });
      hands[0].pose(0.1, 1); hands[1].pose(0.3, 0.8);
      R.glow(0.35); sway(5, 0.12);
    },
  };
  // death: a last blaze, the float fails, the mantle folds, it topples onto its face
  const death = (k) => {
    rig.rotation.y = 1.15;
    if (k === 0) {
      rig.position.y = 0.08; spine.rotation.set(-0.15, 0, 0); chest.rotation.set(-0.2, 0, 0);
      headTurn(R, -0.8, 0.2, 0.2);
      for (const A of arms) { const s = R.shPos(A.i); R.arm(A.i, s.clone().add(V3(-A.side * 0.5, 0.5, 0.2)), { pole: V3(0, -1, 0) }); hands[A.i].pose(0.5, 1); }
      R.glow(3.0); splay(0.15);
      return;
    }
    if (k === 1) {
      rig.position.y = -0.09; spine.rotation.set(0.15, 0, 0.05); chest.rotation.set(0.15, 0, 0);
      headTurn(R, 0.5, 0.1, 0.2);
      for (const A of arms) R.armHang(A.i, 0.2, { reach: 0.97, out: 0.25 });
      R.glow(0.25); splay(0.2, 0.0);
      return;
    }
    if (k === 2) { // folding down: the robe crumples, the body sinks into it
      rig.position.y = -0.45; spine.rotation.set(0.35, 0, 0.1); chest.rotation.set(0.25, 0, 0.05);
      headTurn(R, 0.7, -0.2, 0.3);
      for (const A of arms) R.armHang(A.i, 0.35, { reach: 0.97, out: 0.35 });
      robe.scale.set(1.15, 0.62, 1.15); splay(0.55, 0.0);
      R.glow(0.0);
      const low = R.lowestOf(robe); robe.position.y -= low - 0.01;
      return;
    }
    // k 3..5: the body slumps forward out of the collapsing mantle, which opens flat on the floor
    const j = k - 3;
    rig.position.y = [-0.78, -0.98, -1.03][j];
    pelvis.rotation.set([0.2, 0.35, 0.4][j], 0, 0.1);
    spine.rotation.set([0.55, 0.85, 0.9][j], 0.1, 0.1); chest.rotation.set([0.35, 0.4, 0.35][j], 0.1, 0.05);
    headTurn(R, [0.7, 0.2, -0.1][j], [-0.2, 0.6, 1.1][j], [0.3, 0.3, 0.4][j]);
    if (j === 0) for (const A of arms) R.armHang(A.i, 0.2, { reach: 0.98, out: 0.3 });
    else {
      const AZ = [[1.3, 0.9], [1.7, 0.6]][j - 1];
      for (const A of arms) { A.sh.rotation.set(-0.9, 0, -A.side * AZ[A.i]); A.el.rotation.set(0, 0, -A.side * 0.5); A.wrist.rotation.set(0, 0, 0); }
    }
    for (const h of hands) h.pose(0.5, 0.5);
    robe.scale.set(1.1, [0.55, 0.45, 0.42][j], 1.1);
    robe.rotation.set(-pelvis.rotation.x, 0, -pelvis.rotation.z); // the mantle stays level as the body folds out of it
    splay([0.95, 1.3, 1.42][j]);
    for (const c of R.cplates) c.rotation.x = [0.2, 0.05, 0.0][j];
    R.collar.scale.set(1, [0.9, 0.75, 0.7][j], 1);
    R.collar.visible = j === 0;
    R.glow(0);
    R.ground();
    // the mantle settles on the floor
    const low = R.lowestOf(robe); robe.position.y -= low - 0.01;
    if (k === 5) { ichor.visible = true; R.sync(); const p = R.head.getWorldPosition(V3()); R.root.worldToLocal(p); ichor.position.set(p.x, 0.004, p.z); }
  };
  for (const [i, f] of [...'JKLMNO'].entries()) poses[f] = () => death(i);
  await renderChar(F, params, {
    prefix: 'OVSR', dir: 'sprites/monsters', root: R.root,
    reset: () => { R.reset(); ichor.visible = false; robe.position.y = 0; rig.position.set(0, 0, 0); R.collar.scale.set(1, 1, 1); R.collar.visible = true; R.cplates.forEach((c, i) => { c.rotation.x = 0.28 + Math.abs((i / 8 - 0.5) * Math.PI * 1.15) * 0.12; }); },
    poses, rot8: 'ABCDEFGHI', rot0: 'JKLMNO',
    bounds: { w: 2.2, top: 3.2, bottom: -0.05 },
    bounds0: { w: 3.2, top: 3.2, bottom: -0.8 }, elev0: 18,
  });
}

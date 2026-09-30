// Vehicle definitions (data only; sim, renderer, HUD and audio all read this).
//
//   MULE   the ECS jeep: a Warthog-shaped 4x4 with a driver seat and a rear
//          turret seat carrying a rotary chaingun. Steers toward where you look
//          (Halo's rule), climbs anything a jeep would, splatters what it hits.
//   SLIVER a Vyrr anti-grav bike: fast, twin plasma cannons on the wings,
//          a boost that drains and refills, drifts wide in the turns. The
//          Vyrr ride them too; kill the rider and the bike is yours.
export const VEHICLES = {
  mule: {
    name: 'M12 MULE', short: 'MULE', side: 'human', kind: 'wheeled', hp: 900,
    maxSpeed: 17, reverseMax: 7, accel: 9, brake: 14, drag: 3.5, turnRate: 2.0, grip: 6,
    radius: 1.55, length: 5.2, width: 2.6, height: 2.0, wheelbase: 3.1, track: 2.0, wheelR: 0.55, ram: 70,
    seats: {
      driver: { pos: [-0.55, 1.05, -0.35], hands: [[-0.85, 1.55, -1.2], [-0.25, 1.55, -1.2]], label: 'DRIVE THE MULE' },
      gunner: { pos: [0, 1.65, 1.55], hands: [[-0.25, 2.25, 1.1], [0.25, 2.25, 1.1]], weapon: 'chaingun', label: 'MAN THE TURRET' },
    },
    turret: { pos: [0, 1.85, 1.35], muzzle: [0, 0.35, -1.1] },
    cam: { back: 8.5, up: 3.2 }, lights: [[-0.85, 1.15, -2.6], [0.85, 1.15, -2.6]],
  },
  sliver: {
    name: 'VYRR SLIVER', short: 'SLIVER', side: 'vyrr', kind: 'hover', hp: 420,
    maxSpeed: 20, boostSpeed: 31, reverseMax: 6, accel: 13, brake: 11, drag: 2.5, turnRate: 2.7, grip: 3.2, hover: 0.75,
    radius: 1.2, length: 3.6, width: 2.6, height: 1.4, ram: 50, boost: true,
    seats: { driver: { pos: [0, 0.72, 0.25], hands: [[-0.45, 1.2, -0.55], [0.45, 1.2, -0.55]], weapon: 'sliverGun', label: 'RIDE THE SLIVER' } },
    guns: [[-1.05, 0.55, -1.3], [1.05, 0.55, -1.3]],
    cam: { back: 8, up: 3.4 }, lights: [],
  },
};

// Mounted weapons: the turret's rotary chaingun (hitscan) and the Sliver's twin plasma cannons (bolts).
export const MOUNTED = {
  chaingun: { name: 'M41 CHAINGUN', short: 'CHAINGUN', side: 'human', kind: 'ballistic', pellets: 1, damage: 9, shieldMult: 0.85, headMult: 1.3, spread: 0.02, range: 120, rate: 0.065, reticle: 'chain', sound: 'chaingun', recoil: 0.004, flash: 1.2 },
  sliverGun: { name: 'SLIVER CANNONS', short: 'CANNONS', side: 'vyrr', kind: 'plasma', damage: 12, shieldMult: 1.7, headMult: 1.2, speed: 58, spread: 0.018, range: 90, rate: 0.11, reticle: 'arc', sound: 'carbine', color: 0x9b6bff, recoil: 0.003, flash: 0.9 },
};
export const ENEMY_VEHICLE_SHOTS = { sliverGun: { speed: 44, damage: 9, color: 0x9b6bff, size: 0.2 } };

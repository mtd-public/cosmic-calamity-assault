// Weapon definitions (data only; sim, renderer and HUD all read this).
//
// kind 'ballistic' = magazine + reserve, hitscan, reload.
// kind 'plasma'    = battery %, heat, projectile bolts, no reload, overheat vents.
// shieldMult: damage multiplier against shields; plasma strips shields,
// bullets are better on flesh (Halo's "noob combo" logic).
// headMult applies to the head hitbox (for shielded targets only once the
// shield is down).
export const WEAPONS = {
  sidearm: {
    name: 'M6-K SIDEARM', short: 'SIDEARM', side: 'human', kind: 'ballistic',
    mag: 12, reserveMax: 96, startReserve: 48, rate: 0.26, auto: false, pellets: 1,
    damage: 22, shieldMult: 0.9, headMult: 3.2, spread: 0.004, bloom: 0.01, bloomMax: 0.02, range: 90,
    reload: 1.4, zoom: 2, reticle: 'cross', recoil: 0.018, sound: 'pistol', flash: 1.0,
    note: 'Semi-auto, 2x scope. A head shot on an unshielded target is lethal.',
  },
  rifle: {
    name: 'MA7 ASSAULT RIFLE', short: 'ASSAULT RIFLE', side: 'human', kind: 'ballistic',
    mag: 32, reserveMax: 320, startReserve: 192, rate: 0.085, auto: true, pellets: 1,
    damage: 7.5, shieldMult: 0.8, headMult: 1.5, spread: 0.018, bloom: 0.004, bloomMax: 0.055, range: 55,
    reload: 2.0, zoom: 0, reticle: 'circle', recoil: 0.006, sound: 'rifle', flash: 1.0,
    note: 'Full auto. Spread blooms if you hold the trigger: fire in bursts at range.',
  },
  burst: {
    name: 'BR-9 BATTLE RIFLE', short: 'BATTLE RIFLE', side: 'human', kind: 'ballistic',
    mag: 36, reserveMax: 216, startReserve: 108, rate: 0.42, auto: true, pellets: 1, burst: 3, burstGap: 0.055,
    damage: 11, shieldMult: 0.9, headMult: 2.5, spread: 0.006, bloom: 0, bloomMax: 0, range: 110,
    reload: 2.1, zoom: 2.3, reticle: 'burst', recoil: 0.012, sound: 'burst', flash: 1.0,
    note: 'Three-round burst, 2.3x scope. Four bursts kill a Trooper.',
  },
  shotgun: {
    name: 'SG-12 BREACHER', short: 'SHOTGUN', side: 'human', kind: 'ballistic',
    mag: 8, reserveMax: 48, startReserve: 24, rate: 0.85, auto: false, pellets: 9, shellReload: true,
    damage: 14, shieldMult: 0.9, headMult: 1.2, spread: 0.075, bloom: 0, bloomMax: 0, range: 22, falloff: 12,
    reload: 0.5, zoom: 0, reticle: 'wide', recoil: 0.06, sound: 'shotgun', flash: 1.6,
    note: 'Nine pellets. Loads one shell at a time; fire interrupts a reload.',
  },
  caster: {
    name: 'VYRR PLASMA CASTER', short: 'PLASMA CASTER', side: 'vyrr', kind: 'plasma',
    battery: 100, perShot: 0.8, heatPerShot: 0.085, cool: 0.55, ventTime: 2.2, rate: 0.14, auto: false,
    damage: 13, shieldMult: 2.2, headMult: 1.3, speed: 42, spread: 0.01, range: 70,
    charge: { time: 0.9, damage: 70, shieldMult: 3, perShot: 8, homing: 2.6, speed: 30 },
    reticle: 'arc', recoil: 0.008, sound: 'plasma', color: 0x6cff9a, flash: 0.8,
    note: 'Tap to fire bolts. Hold to overcharge a homing shot that strips a shield.',
  },
  carbine: {
    name: 'VYRR PULSE CARBINE', short: 'PULSE CARBINE', side: 'vyrr', kind: 'plasma',
    battery: 100, perShot: 0.45, heatPerShot: 0.045, cool: 0.5, ventTime: 2.6, rate: 0.1, auto: true,
    damage: 10, shieldMult: 1.6, headMult: 1.3, speed: 55, spread: 0.022, range: 70,
    reticle: 'arc', recoil: 0.006, sound: 'carbine', color: 0x9b6bff, flash: 0.8,
    note: 'Automatic plasma. Watch the heat bar; it vents when it overheats.',
  },
  needler: {
    name: 'VYRR SHARD NEEDLER', short: 'SHARD NEEDLER', side: 'vyrr', kind: 'ballistic', projectile: true,
    mag: 20, reserveMax: 80, startReserve: 40, rate: 0.12, auto: true, pellets: 1,
    damage: 6, shieldMult: 1.0, headMult: 1.0, speed: 34, spread: 0.02, homing: 3.2, range: 60,
    supercombine: { count: 7, damage: 130, radius: 2.6 },
    reload: 2.2, zoom: 0, reticle: 'needle', recoil: 0.005, sound: 'needler', color: 0xff5fd2, flash: 0.6,
    note: 'Homing crystal shards. Seven in one target within 2 s set off a supercombine.',
  },
  lance: {
    name: 'VYRR FUEL LANCE', short: 'FUEL LANCE', side: 'vyrr', kind: 'ballistic', projectile: true,
    mag: 5, reserveMax: 20, startReserve: 10, rate: 0.75, auto: false, pellets: 1,
    damage: 40, shieldMult: 1.0, headMult: 1.0, speed: 36, gravity: 3, spread: 0.004, range: 90,
    splash: { radius: 4.2, damage: 120 },
    reload: 2.6, zoom: 1.6, reticle: 'lance', recoil: 0.05, sound: 'lance', color: 0x7dff4f, flash: 1.4,
    note: 'Heavy weapon. Arcing explosive bolts. Keep your distance.',
  },
};

export const WEAPON_ORDER = ['sidearm', 'rifle', 'burst', 'shotgun', 'caster', 'carbine', 'needler', 'lance'];

// Enemy weapons are the same guns, with enemy-side bolt tuning.
export const ENEMY_SHOTS = {
  caster: { speed: 30, damage: 8, color: 0x6cff9a, size: 0.22 },
  carbine: { speed: 38, damage: 7, color: 0x9b6bff, size: 0.18 },
  needler: { speed: 26, damage: 6, color: 0xff5fd2, size: 0.14, homing: 1.3 },
  lance: { speed: 26, damage: 30, color: 0x7dff4f, size: 0.4, gravity: 3, splash: { radius: 4, damage: 70 } },
  drone: { speed: 34, damage: 6, color: 0xffb040, size: 0.14 },
};

export function newWeaponState(id, full = false) {
  const d = WEAPONS[id];
  if (d.kind === 'plasma') return { id, battery: d.battery, heat: 0, vent: 0, charge: 0 };
  return { id, mag: d.mag, reserve: full ? d.reserveMax : d.startReserve };
}

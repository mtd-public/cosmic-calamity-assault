// The Vyrr order of battle (data only). Reptilian occupiers from Metal Snake:
// Cosmic Calamity, now fighting in the open. Each one borrows a Halo role so
// the combat reads instantly:
//   Skitter  ~ Grunt:  small, loud, panics when its Trooper dies
//   Trooper  ~ Elite:  shielded, strafes, dodges, berserks at low health
//   Bulwark  ~ Hunter: armoured front, weak back, comes in bonded pairs
//   Drone    ~ Drone/Sentinel: flies, flanks, fragile
export const ENEMIES = {
  skitter: {
    name: 'SKITTER', hp: 32, shield: 0, speed: 3.3, radius: 0.45, height: 1.3, head: { y: 1.08, r: 0.27 },
    weapon: 'caster', burst: [2, 4], burstGap: 0.26, pause: [1.6, 2.8], range: [9, 20], accuracy: 0.085,
    react: [0.7, 1.2], melee: { dmg: 14, range: 1.6, windup: 0.35 }, flee: true, points: 10, drops: ['caster', 'needler'],
  },
  trooper: {
    name: 'TROOPER', hp: 58, shield: 60, shieldDelay: 3.2, shieldRate: 30, speed: 4.7, radius: 0.5, height: 2.25,
    head: { y: 2.02, r: 0.25 }, weapon: 'carbine', burst: [4, 6], burstGap: 0.12, pause: [1.0, 1.8], range: [7, 17],
    accuracy: 0.05, react: [0.35, 0.6], melee: { dmg: 38, range: 1.9, windup: 0.3 }, dodge: 0.45, grenades: 2,
    berserk: true, points: 30, drops: ['carbine', 'needler', 'caster'],
  },
  heavy: {
    name: 'BULWARK', hp: 440, shield: 0, speed: 2.6, radius: 1.0, height: 2.9, head: null, armorFront: 0.1, backMult: 2.6,
    weapon: 'lance', burst: [1, 1], burstGap: 0.2, pause: [2.4, 3.6], range: [4, 28], accuracy: 0.02, react: [0.8, 1.2],
    melee: { dmg: 120, range: 3.3, windup: 0.6, knock: 11 }, bonded: true, points: 100, drops: ['lance'],
  },
  drone: {
    name: 'DRONE', hp: 28, shield: 0, speed: 6.5, radius: 0.55, height: 0.8, head: null, fly: true, alt: [3, 7],
    weapon: 'drone', burst: [3, 5], burstGap: 0.1, pause: [1.0, 2.0], range: [6, 16], accuracy: 0.06, react: [0.3, 0.5],
    melee: null, points: 15, drops: [],
  },
  // Proving Grounds holo-targets: stand still, never shoot, come back.
  dummy: {
    name: 'HOLO-TARGET', hp: 60, shield: 0, speed: 0, radius: 0.5, height: 2.1, head: { y: 1.9, r: 0.25 }, dummy: true,
    weapon: null, respawn: 3, points: 0, drops: [],
  },
  dummyShield: {
    name: 'SHIELDED TARGET', hp: 58, shield: 60, shieldDelay: 3.2, shieldRate: 30, speed: 0, radius: 0.5, height: 2.25,
    head: { y: 2.02, r: 0.25 }, dummy: true, weapon: null, respawn: 3, points: 0, drops: [],
  },
};

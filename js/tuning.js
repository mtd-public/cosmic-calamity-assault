// TUNING: every number the feel depends on, with the reason it has that value.
// Halo 1/2 is the reference: a heavy, floaty super-soldier, a shield that buys
// you one mistake, and a health bar that does not come back on its own.
export const TUNING = {
  // ---- player body
  walkSpeed: 5.4,        // m/s. Halo's Chief covers ~5.5 m/s: brisk enough that strafing dodges plasma at 12 m
  crouchSpeed: 2.5,      // half speed: crouching is for aim and the motion tracker, not travel
  airControl: 0.35,      // fraction of ground accel in the air: a committed jump, but you can nudge it
  accel: 11,             // 1/s. Reach full speed in ~0.25 s: responsive without feeling weightless
  gravity: 13,           // m/s². Slightly under Earth·1.3: the classic floaty Halo arc
  jumpVel: 5.9,          // m/s. Apex ≈ 1.34 m: clears a crate (1.2 m) but not a wall
  stepHeight: 0.55,      // m. Walk up stairs and kerbs without jumping
  radius: 0.42,          // m. Cylinder collider
  height: 1.9,           // m standing
  crouchHeight: 1.25,    // m crouched
  eye: 1.68,             // m eye height standing
  crouchEye: 1.05,
  maxSlope: 1.1,         // terrain gradient (rise/run ≈ 48°) above which you slide instead of climb
  fallDamageSpeed: 17,   // m/s impact before fall damage: Halo lets you drop a storey freely
  fallKillSpeed: 26,

  // ---- player vitality (Halo 1 model: shield recharges, health needs packs)
  shieldMax: 75,
  healthMax: 45,          // three Halo 1 health segments of 15
  shieldDelay: 4.2,       // s after the last hit before recharge starts (Halo ~5 s; a touch quicker for tablets)
  shieldRate: 42,         // per s: an empty shield refills in ~1.8 s, the iconic whine
  meleeDamage: 75,        // one melee pops a Trooper's shield, kills a Skitter
  meleeRange: 2.1,
  meleeLunge: 4.5,        // m: melee reaches a target this far out and pulls you to it
  meleeCooldown: 0.75,

  // ---- grenades
  gMaxEach: 4,
  throwSpeed: 16,         // m/s along the aim, plus a small up-kick
  throwUp: 3.5,
  fragFuse: 2.4,
  plasmaFuse: 1.9,
  fragRadius: 5.5,
  plasmaRadius: 4.2,
  fragDamage: 170,
  plasmaDamage: 190,
  grenadeCooldown: 0.8,
  stickRadius: 0.75,      // plasma grenade sticks to anything that comes this close

  // ---- look
  pitchLimit: 1.45,       // rad, just under straight up/down
  padLookSpeed: 3.1,      // rad/s at full right-stick deflection (sensitivity 5 of 10)
  padLookAccel: 0.5,      // extra turn speed ramp after 0.35 s at full tilt (Halo's "turn ramp")
  touchLook: 0.0052,      // rad per CSS px dragged (sensitivity 5 of 10)
  mouseLook: 0.0023,      // rad per mouse px
  zoomFov: 2.0,           // default zoom magnification for scoped weapons

  // ---- aim assist (gamepad + touch only; off with a mouse)
  assistAngle: 0.07,      // rad cone around an enemy where look slows ("friction")
  assistFriction: 0.45,   // look speed multiplier inside the cone
  assistPull: 1.4,        // rad/s the view drifts toward a target while you move and it is in the cone
  magnetism: 0.035,       // rad: hitscan bullets bend to an enemy this close to the ray

  // ---- AI
  sightRange: 42,         // m. Enemies notice you inside this, with LOS and inside their 120° view
  hearRange: 26,          // m. Your gunfire wakes enemies this close
  alertShare: 18,         // m. An alerted enemy wakes friends this close
  navStep: 1,             // m per nav cell
  flowEvery: 0.35,        // s between flow-field rebuilds toward the player
  checkpointPause: 1.4,   // s before "CHECKPOINT… DONE" shows (Halo's little delay)
};

// Halo's four difficulties. Enemy damage, enemy vitality, how often they fire,
// how well they aim, how quickly your shield comes back.
export const DIFFICULTY = [
  { id: 'easy', name: 'EASY', dmg: 0.55, hp: 0.8, rof: 0.75, aim: 1.6, shieldDelay: 0.8 },
  { id: 'normal', name: 'NORMAL', dmg: 0.82, hp: 1.0, rof: 1.0, aim: 1.0, shieldDelay: 1.0 },
  { id: 'heroic', name: 'HEROIC', dmg: 1.55, hp: 1.25, rof: 1.2, aim: 0.75, shieldDelay: 1.15 },
  { id: 'legendary', name: 'LEGENDARY', dmg: 2.4, hp: 1.5, rof: 1.35, aim: 0.55, shieldDelay: 1.3 },
];

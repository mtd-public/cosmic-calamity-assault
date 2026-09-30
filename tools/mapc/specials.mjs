// Hexen-format (UDMF "zdoom" namespace) line specials mapc knows by name.
// Numbers from GZDoom src/playsim/actionspecials.h.
export const SPECIALS = {
  Door_Close: 10, Door_Open: 11, Door_Raise: 12, Door_LockedRaise: 13,
  Floor_LowerByValue: 20, Floor_LowerToLowest: 21, Floor_LowerToNearest: 22, Floor_RaiseByValue: 23,
  Floor_RaiseToNearest: 25, Line_SetBlocking: 55, Plat_DownWaitUpStay: 62, Teleport: 70, Teleport_NoFog: 71,
  ACS_Execute: 80, Door_WaitRaise: 105, Light_ChangeToValue: 112, Light_Fade: 113, Thing_Activate: 130,
  Sector_Set3DFloor: 160, Plat_DownWaitUpStayLip: 206, Sector_SetColor: 212, Sector_SetFade: 213,
  Sector_SetDamage: 214, Exit_Normal: 243, Exit_Secret: 244, Ceiling_RaiseToHighest: 262,
};
export const SPECIAL_NAMES = Object.fromEntries(Object.entries(SPECIALS).map(([k, v]) => [v, k]));

// Lock numbers, as the mod's own mod/LOCKDEFS.txt defines them (ClearLocks, then
//   1 = CCABlueCard, 2 = CCARedCard, 3 = CCAYellowCard). Note this is NOT GZDoom's stock Doom
// numbering (1 red, 2 blue). Map sources always say lock=blue|red|yellow; this table is the only
// place the numbers live.
export const LOCKS = { blue: 1, red: 2, yellow: 3 };

// Door / lift speeds (map units per 8 tics, as in Hexen specials)
export const DOOR_SPEED = 32;     // Doom "normal" door (4 units/tic)
export const BLAST_SPEED = 12;    // slow heavy blast door
export const DOOR_DELAY = 150;    // tics open before closing (Doom's 4.3 s)
export const LIFT_SPEED = 32;
export const LIFT_DELAY = 105;    // 3 s, Doom's lift wait
export const LIFT_LIP = 8;        // Plat_DownWaitUpStay stops 8 above the lowest neighbour floor

// Things/args may name a special instead of its number.
export function specialNumber(name) {
  if (typeof name === 'number') return name;
  if (/^\d+$/.test(name)) return +name;
  if (!(name in SPECIALS)) throw new Error(`unknown special "${name}"`);
  return SPECIALS[name];
}

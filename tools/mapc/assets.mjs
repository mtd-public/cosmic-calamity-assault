// The asset contract as mapc sees it:
//   * texture / flat names come from docs/ASSETS.md §5 (a name outside that list FAILS the compile);
//   * whether the PNG exists yet in mod/textures or mod/flats (missing only WARNS: the painters
//     run in parallel);
//   * thing classes, DoomEdNums and documented args come from tools/data/things.json.
import fs from 'node:fs';
import path from 'node:path';

// Names the engine provides and maps may always use.
const ENGINE_NAMES = new Set(['F_SKY1', '-']);

export function loadTextureContract(root) {
  const md = fs.readFileSync(path.join(root, 'docs/ASSETS.md'), 'utf8');
  const start = md.indexOf('## 5.'), end = md.indexOf('## 6.', start);
  if (start < 0) throw new Error('docs/ASSETS.md has no "## 5." section');
  const sec = md.slice(start, end < 0 ? undefined : end);
  const walls = new Set(), flats = new Set(), skies = new Set();
  for (const line of sec.split('\n')) {
    const kind = /Flats:/.test(line) ? flats : /Skies/.test(line) ? skies : walls;
    // expand ranges written as `GOO1`-`GOO4`
    const withRanges = line.replace(/`([A-Z_]+)(\d+)`-`\1(\d+)`/g, (m, p, a, b) => {
      const out = [];
      for (let i = +a; i <= +b; i++) out.push('`' + p + i + '`');
      return out.join(' ');
    });
    for (const m of withRanges.matchAll(/`([A-Z0-9_]{1,8})`/g)) kind.add(m[1]);
  }
  const all = new Set([...walls, ...flats, ...ENGINE_NAMES]);
  const onDisk = new Set();
  for (const dir of ['mod/textures', 'mod/flats']) {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of walk(d)) {
      const base = path.basename(f).replace(/\.[^.]+$/, '').toUpperCase();
      onDisk.add(base);
    }
  }
  return { walls, flats, skies, all, onDisk };
}

function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

export function loadThings(root) {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'tools/data/things.json'), 'utf8'));
  const things = new Map();
  for (const [k, v] of Object.entries(j)) if (!k.startsWith('_')) things.set(k, v);
  return things;
}

// Checker semantics per class (mapc-side only; the actors themselves live in ZScript).
export const MONSTERS = new Set(['ManInBlack', 'Thrall', 'ThrallTrooper', 'Grey', 'Hybrid', 'Stalker', 'Probe', 'Overseer', 'HiveMind']);
export const FLYERS = new Set(['Probe', 'Overseer']);
export const NPCS = new Set(['Scientist', 'LabTech', 'DownedGuard', 'OfficeWorker', 'OfficeWorkerF']);
export const CORPSES = new Set(['DeadGuard', 'DeadScientist', 'DeadLabTech', 'DeadSoldier', 'DeadOfficeWorker']);
export const KEYS = { CCABlueCard: 'blue', CCARedCard: 'red', CCAYellowCard: 'yellow' };
// default objective id an item completes (override per thing with obj=N)
export const OBJECTIVE_ITEMS = { Dossier: 1, HDDCache: 2, CaseFile: 1, NavShard: 1 };
export const DOWNED_GUARD_KEYS = { 1: 'blue', 2: 'red', 3: 'yellow' };
export const isPickup = (cls) => /^(Pickup|Ammo|AlienEnergy|Frag|Detonator|Stim$|Medkit$|AlienImplant$|KevlarVest$|TacticalArmor$|FlashlightBattery$)/.test(cls);

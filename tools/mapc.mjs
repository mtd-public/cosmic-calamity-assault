#!/usr/bin/env node
// mapc — ASCII map sources (maps-src/*.txt) -> UDMF maps (mod/maps/MAPxx.wad), with a
// provability check and a top-down PNG preview per map (shots/maps/MAPxx.png).
//
//   node tools/mapc.mjs                 compile every maps-src/map*.txt
//   node tools/mapc.mjs map01 map03     compile some
//   options: --no-nodes (skip zdbsp)  --no-preview  --quiet  --out DIR
//
// Exit status 1 if any map fails (geometry, unknown textures/things, or provability).
//
// ==================================================================================== FORMAT
// One cell = 32x32 map units. Row 0 of the grid is the north edge; columns grow east.
// Outside the grid blocks, ';' or '//' start a comment.
//
//   map MAP01 "Groom Lake"          lump name (+ title, informational)
//   sky SKYA51                      informational (MAPINFO sets the sky)
//   defaults k=v ...                defaults for every non-solid legend entry
//   tag @name N                     pin a symbolic tag (otherwise @names get 100, 101, ...)
//
//   legend                          <char> <kind> [key=value | flag]...
//     #  solid                      wall; its faces use the adjoining sector's wall=
//     %  solid tex=CONCWALL         wall with its own face texture
//     .  room floor=0 ceil=128 ff=LABTILE cf=LABCEIL wall=LABWALL1 light=144
//     D  door tex=LABDOOR track=SUPPORT
//   end
//
//   kinds and keys
//     solid / void  tex=                   (' ' is always void; '#' is a plain wall if undefined)
//     room    floor ceil ff cf wall upper lower light color=#RRGGBB fade=#RRGGBB   (sky = cf F_SKY1;
//             a sky in defaults applies to entries without their own cf=; nosky cancels it)
//             damage=N dmgtype= secret sky (ceiling F_SKY1) tag=N|@name[,..] merge block
//             enter=Special(args) [enterrepeat]   walk-over trigger on every line into/out of the region
//             slab=z0..z1 slabtop= slabbot= slabside= slablight= slabtype= slabalpha=
//                                            a solid 3D floor (Sector_Set3DFloor) inside the region;
//                                            mapc makes the control sector below the map
//             lowerself=                     texture for this sector's own lower walls (pits)
//             scenery                        backdrop the player never enters (excluded from coverage)
//     door    tex= (the face) track= (jambs, lower-unpegged) lock=blue|red|yellow speed= delay=
//             stay (Door_Open) blast (slow) secret (looks like wall= tex, secret line, stays open;
//             give the room behind it `secret`)
//             remote (no use special; opened by a switch/terminal/gate through tag=) open
//             Floor = the lowest neighbouring floor; it opens to the lowest neighbouring ceiling - 4.
//             Plain doors: Door_Raise(0,32,150) use+monster use; locked: Door_LockedRaise(0,..,lock).
//     lift    top= (up position) tex= (its side face) wall= (shaft) speed= delay= remote tag=
//             Plat_DownWaitUpStay(0,32,105): use-lines on its low sides, walk-over on its high sides.
//     stairs  dir=N|S|E|W (rising) floor= (level below the first step) top= (last step) riser=
//             headroom= (ceiling follows the steps) ceil=; every row/column is one step; rise <= 24.
//     window  floor= (sill) ceil= (lintel) glass=GLASS1|GLASSBRK|FENCEMID frame= pane=both|N|S|E|W
//             broken (lets hitscan/projectiles through) nowrap pegbottom (fence: drawn once from the floor)
//             Window lines are always impassable (blocking); intact glass also blocks hitscan and
//             projectiles. Both sides carry the mid texture on the chosen panes.
//
//   diagonal cells: '/' and '\' split a cell along its diagonal; each half takes the sector (or
//   wall) of the two orthogonal neighbours it touches. Use them for 45-degree corners and walls.
//
//   marks                           single-char stamps used inside the grid
//     @  PlayerStart angle=N        a thing at the cell centre; the floor under it is inferred from
//     t  Thrall angle=S skill=345   its neighbours (or on=<char>). Thing keys below.
//     s  switch Door_Open(@vault,16) tex=SW1LAB [once] [on=<solid char>]
//                                   a wall cell whose faces are use-switch lines
//   end
//
//   grid
//   ;  lines beginning with ';' are comments (rulers)
//   ##########
//   #...@....#
//   ##########
//   end
//
//   things                          <Class> <col>,<row> [keys]   (fractional cells allowed)
//     IrisTrigger 12,8 args=IRIS_101,160
//   end
//
//   thing keys: angle=E|N|W|S|NE..|deg  args=a,b,c,d,e (numbers, @tags, special names, IRIS_nnn)
//     a0..a4=  skill=12345  ambush  dormant  dx= dy= (units)  z=top (stand on the 3D slab) | z=N
//     obj=N (checker: item completes objective N)  ondeath=Special(args) (checker: what the
//     actor's death does, e.g. the Hive Mind lowering tag 666)
// ============================================================================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseSource } from './mapc/parse.mjs';
import { buildLevel } from './mapc/geometry.mjs';
import { writeTextmap } from './mapc/udmf.mjs';
import { checkLevel } from './mapc/reach.mjs';
import { renderPreview } from './mapc/preview.mjs';
import { loadTextureContract, loadThings, MONSTERS, NPCS } from './mapc/assets.mjs';
import { writeWad, readWad } from './lib/wad.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n) => argv.includes(n);
const outDir = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(ROOT, 'mod/maps');
const want = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out').map((a) => a.toLowerCase().replace(/\.txt$/, ''));

const ctx = { textures: loadTextureContract(ROOT), things: loadThings(ROOT) };
const srcDir = path.join(ROOT, 'maps-src');
const explicit = argv.filter((a) => a.endsWith('.txt') && fs.existsSync(a)).map((a) => path.resolve(a));
const files = explicit.length ? explicit : fs.readdirSync(srcDir).filter((f) => /^map\d+\.txt$/i.test(f)).sort()
  .filter((f) => !want.length || want.includes(f.replace(/\.txt$/i, '').toLowerCase()));
if (!files.length) { console.error('mapc: no map sources matched'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const shotDir = path.join(ROOT, 'shots/maps');

const hasZdbsp = !opt('--no-nodes') && spawnSync('zdbsp', ['--version'], { encoding: 'utf8' }).status === 0;
let failed = 0;

for (const f of files) {
  const file = path.isAbsolute(f) ? f : path.join(srcDir, f);
  let lv;
  try {
    const src = parseSource(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file));
    lv = buildLevel(src, ctx);
  } catch (e) {
    console.log(`\n${f}: FAIL\n  ${e.message}`);
    failed++;
    continue;
  }
  const rep = lv.errors.length ? { errors: [], warnings: [], info: [] } : checkLevel(lv);
  const errors = [...lv.errors, ...rep.errors], warnings = [...lv.warnings, ...rep.warnings];
  console.log(`\n${lv.name} "${lv.title}" (${f}) ${lv.W}x${lv.H} cells`);
  if (!lv.errors.length) {
    const text = writeTextmap(lv);
    const c = lv.counts;
    const monsters = Object.entries(rep.stats ? rep.stats.monsters : {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
    const npcs = lv.things.filter((t) => NPCS.has(t.cls)).length;
    console.log(`  geometry: ${c.sectors} sectors (${lv.controls.length} 3D-floor controls), ${c.linedefs} linedefs (${lv.mergedAway} merged away), ${c.sidedefs} sidedefs, ${c.vertices} vertices`);
    console.log(`  things:   ${c.things} total; monsters: ${monsters}; NPCs ${npcs}`);
    if (rep.stats) {
      const s = rep.stats;
      console.log(`  check:    exit ${s.exit ? 'reachable' : 'NOT reachable'}; keys ${s.keys.join('+') || '-'}; objectives ${s.objectives.join('+') || '-'}; secrets ${s.secrets}; reachable ${s.reachablePct.toFixed(1)}% of walkable area; ${s.iterations} unlock rounds; clamber adds ${s.clamberExtra} positions`);
    }
    if (lv.missingTextures) console.log(`  textures: ${lv.textures.size} used, ${lv.missingTextures} not painted yet (${[...new Set(lv.missingList)].join(' ')})`);
    else console.log(`  textures: ${lv.textures.size} used, all present`);
    // WAD: marker, TEXTMAP, [ZNODES], ENDMAP
    let lumps = [{ name: lv.name, data: '' }, { name: 'TEXTMAP', data: Buffer.from(text, 'latin1') }, { name: 'ENDMAP', data: '' }];
    let wad = writeWad(lumps);
    if (hasZdbsp && !errors.length) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mapc-'));
      const tin = path.join(tmp, 'in.wad'), tout = path.join(tmp, 'out.wad');
      fs.writeFileSync(tin, wad);
      // -X -z: extended, compressed nodes; -g: GL nodes too (the hardware renderer needs them)
      const r = spawnSync('zdbsp', ['-X', '-z', '-g', '-t', '-o', tout, tin], { encoding: 'utf8' });
      if (r.status === 0 && fs.existsSync(tout)) {
        const back = readWad(fs.readFileSync(tout));
        const names = back.lumps.map((l) => l.name);
        if (names.includes('ZNODES')) { wad = fs.readFileSync(tout); console.log(`  nodes:    zdbsp ${names.join(' ')}`); }
        else console.log(`  nodes:    zdbsp wrote no ZNODES (${names.join(' ')}); GZDoom will build them`);
      } else console.log(`  nodes:    zdbsp failed (${(r.stderr || r.stdout || '').trim().split('\n').pop()}); GZDoom will build them`);
      fs.rmSync(tmp, { recursive: true, force: true });
    } else if (!hasZdbsp) console.log('  nodes:    none (GZDoom builds UDMF nodes on load)');
    if (!errors.length) fs.writeFileSync(path.join(outDir, `${lv.name}.wad`), wad);
    if (!opt('--no-preview')) {
      fs.mkdirSync(shotDir, { recursive: true });
      fs.writeFileSync(path.join(shotDir, `${lv.name}.png`), renderPreview(lv, rep));
    }
  }
  if (opt('--unreached') && rep.walk) {
    const by = new Map();
    for (let k = 0; k < rep.walk.length; k++) {
      if (!rep.walk[k] || rep.reached[k]) continue;
      const sx = k % rep.W, sy = Math.floor(k / rep.W), cell = lv.cells[sy >> 1][sx >> 1];
      const key = `'${cell.base || cell.ch}' near col ${sx >> 1} row ${sy >> 1}`;
      const sec = `${cell.base || cell.ch}`;
      if (!by.has(sec)) by.set(sec, { n: 0, at: key });
      by.get(sec).n++;
    }
    for (const [k, v] of [...by].sort((a, b) => b[1].n - a[1].n)) console.log(`  unreached: ${v.n} sub-cells of '${k}', e.g. ${v.at}`);
  }
  if (!opt('--quiet')) for (const w of warnings) console.log(`  warn: ${w}`);
  for (const i of rep.info || []) if (!opt('--quiet')) console.log(`  info: ${i}`);
  for (const e of errors) console.log(`  FAIL: ${e}`);
  console.log(errors.length ? `  => ${lv.name} FAILED (${errors.length} problem(s))` : `  => ${lv.name} OK`);
  if (errors.length) failed++;
}
process.exit(failed ? 1 : 0);

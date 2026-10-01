// Grid -> sectors, linedefs, sidedefs, vertices, 3D-floor control sectors and things.
//
// Coordinates: cell (row r, col c) spans x = [32c, 32c+32], y = [-32r-32, -32r] (row 0 is the
// top of the ASCII = north). Every piece (a full cell or a diagonal half-cell) is a CCW polygon,
// so a piece is on the LEFT of each of its directed edges; a linedef whose front sector is S runs
// the other way (Doom: the front side is on the right of v1 -> v2).
import { LOCKS, DOOR_SPEED, BLAST_SPEED, DOOR_DELAY, LIFT_SPEED, LIFT_DELAY, LIFT_LIP, specialNumber } from './specials.mjs';
import { KEYS, OBJECTIVE_ITEMS, DOWNED_GUARD_KEYS } from './assets.mjs';

export const CELL = 32;
const SECTOR_KINDS = new Set(['room', 'door', 'lift', 'stairs', 'window']);
const SOLID_KINDS = new Set(['solid', 'void']);
const DIR4 = [['N', -1, 0], ['S', 1, 0], ['W', 0, -1], ['E', 0, 1]];
const ANGLES = { E: 0, NE: 45, N: 90, NW: 135, W: 180, SW: 225, S: 270, SE: 315 };
// which half of a diagonal cell touches a given side of that cell
const HALF_ON_SIDE = { '/': { N: 'UL', W: 'UL', S: 'LR', E: 'LR' }, '\\': { N: 'UR', E: 'UR', S: 'LL', W: 'LL' } };
const HALF_NEIGHBOURS = { UL: ['N', 'W'], LR: ['S', 'E'], UR: ['N', 'E'], LL: ['S', 'W'] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function buildLevel(src, ctx) {
  const lv = {
    src, name: src.name, title: src.title, file: src.file,
    errors: [], warnings: [],
    W: 0, H: 0, cells: [], pieces: [], sectors: [], lines: [], things: [], controls: [],
    tagOf: new Map(), usedTags: new Set([0]), switches: [], textures: new Map(),
  };
  const err = (m, line) => lv.errors.push(line ? `${src.file}:${line}: ${m}` : `${src.name}: ${m}`);
  const warn = (m, line) => lv.warnings.push(line ? `${src.file}:${line}: ${m}` : `${src.name}: ${m}`);
  lv.err = err; lv.warn = warn;

  resolveLegend(lv, ctx);
  allocateTags(lv);
  resolveCells(lv);
  if (lv.errors.length) return lv;
  makePieces(lv);
  makeSectors(lv);
  if (lv.errors.length) return lv;
  makeLines(lv);
  mergeLines(lv);
  makeControls(lv);
  makeThings(lv, ctx);
  checkTextures(lv, ctx);
  checkClosed(lv);
  return lv;
}

// ---------------------------------------------------------------- legend
function resolveLegend(lv, ctx) {
  const { src } = lv;
  lv.legend = new Map();
  for (const [ch, e] of src.legend) {
    if (!SECTOR_KINDS.has(e.kind) && !SOLID_KINDS.has(e.kind)) { lv.err(`legend '${ch}': unknown kind "${e.kind}" (room door lift stairs window solid void)`, e.line); continue; }
    const p = SOLID_KINDS.has(e.kind) ? { ...e.props } : { ...src.defaults, ...e.props };
    if (p.sky && e.props.cf === undefined && !e.props.nosky) p.cf = 'F_SKY1';   // an entry's own cf= wins over a default sky
    lv.legend.set(ch, { char: ch, kind: e.kind, p, own: e.props, line: e.line });
  }
  // implicit plain wall if the source did not define '#'
  if (!lv.legend.has('#')) lv.legend.set('#', { char: '#', kind: 'solid', p: {}, own: {}, line: 0 });
}

// Symbolic tags (@name) are numbered from 100 unless pinned with "tag @name N".
function allocateTags(lv) {
  const { src } = lv;
  const names = [];
  const scan = (v) => {
    if (typeof v === 'string' && v.startsWith('@')) { if (!names.includes(v)) names.push(v); }
    else if (typeof v === 'number') lv.usedTags.add(v);
    else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === 'object' && v.args) v.args.forEach(scan);
  };
  for (const e of src.legend.values()) { scan(e.props.tag); scan(e.props.enter); }
  for (const m of src.marks.values()) { scan(m.special); scan(m.props.args); scan(m.props.ondeath); }
  for (const t of src.things) { scan(t.props.args); scan(t.props.ondeath); }
  for (const [n, v] of Object.entries(src.pinnedTags)) { lv.tagOf.set(n, v); lv.usedTags.add(v); }
  let next = 100;
  for (const n of names) {
    if (lv.tagOf.has(n)) continue;
    while (lv.usedTags.has(next) || next === 666) next++;
    lv.tagOf.set(n, next); lv.usedTags.add(next);
  }
}

export function resolveArg(lv, v, line) {
  if (typeof v === 'number') return v;
  if (v === true || v === undefined) return 0;
  if (typeof v === 'string') {
    if (v.startsWith('@')) return lv.tagOf.get(v);
    let m;
    if ((m = /^IRIS_(\d+)$/.exec(v))) return +m[1];
    if (v in LOCKS) return LOCKS[v];
    try { return specialNumber(v); } catch (e) { lv.err(`cannot resolve argument "${v}"`, line); return 0; }
  }
  lv.err(`bad argument ${JSON.stringify(v)}`, line);
  return 0;
}

function resolveTagList(lv, v, line) {
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => resolveArg(lv, x, line)).filter((x) => x);
}

// ---------------------------------------------------------------- cells
function resolveCells(lv) {
  const { src } = lv;
  const H = src.grid.length, W = Math.max(...src.grid.map((g) => g.text.length));
  lv.W = W; lv.H = H;
  const cells = [];
  for (let r = 0; r < H; r++) {
    const row = [];
    const text = src.grid[r].text;
    for (let c = 0; c < W; c++) {
      const ch = c < text.length ? text[c] : ' ';
      const cell = { r, c, ch, kind: 'void', base: null, mark: null, line: src.grid[r].line };
      if (ch === ' ') cell.kind = 'void';
      else if (ch === '/' || ch === '\\') cell.kind = 'diag';
      else if (lv.legend.has(ch)) {
        const d = lv.legend.get(ch);
        cell.kind = d.kind === 'solid' ? 'solid' : d.kind === 'void' ? 'void' : 'sector';
        cell.base = ch;
      } else if (src.marks.has(ch)) {
        const m = src.marks.get(ch);
        cell.mark = m;
        if (m.type === 'switch') {
          cell.kind = 'solid';
          cell.base = m.props.on || '#';
          if (!lv.legend.has(cell.base) || lv.legend.get(cell.base).kind !== 'solid') lv.err(`switch mark '${ch}': on=${cell.base} is not a solid legend char`, m.line);
        } else {
          cell.kind = 'sector';
          cell.base = m.props.on || null; // inferred below
          if (cell.base && (!lv.legend.has(cell.base) || lv.legend.get(cell.base).kind === 'solid')) lv.err(`mark '${ch}': on=${cell.base} is not a sector legend char`, m.line);
        }
      } else {
        lv.err(`unknown char '${ch}' at col ${c} row ${r}`, cell.line);
      }
      row.push(cell);
    }
    cells.push(row);
  }
  lv.cells = cells;
  const at = (r, c) => (r >= 0 && r < H && c >= 0 && c < W ? cells[r][c] : null);
  lv.at = at;

  // infer the sector under thing marks: most common sector char among the 8 neighbours
  for (let pass = 0; pass < 4; pass++) {
    for (const row of cells) for (const cell of row) {
      if (cell.kind !== 'sector' || cell.base) continue;
      const counts = new Map();
      const order = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of order) {
        const n = at(cell.r + dr, cell.c + dc);
        if (!n || n.kind !== 'sector' || !n.base) continue;
        const k = lv.legend.get(n.base).kind;
        const w = (k === 'room' || k === 'stairs') ? 2 : 1; // prefer plain floor over doors/windows
        counts.set(n.base, (counts.get(n.base) || 0) + w);
      }
      let best = null, bn = 0;
      for (const [k, n] of counts) if (n > bn) { best = k; bn = n; }
      if (best) cell.base = best;
    }
  }
  for (const row of cells) for (const cell of row) {
    if (cell.kind === 'sector' && !cell.base) lv.err(`cannot infer the floor under mark '${cell.ch}' at col ${cell.c} row ${cell.r} (give it on=<char>)`, cell.line);
  }

  // diagonal half-cells take the kind of the orthogonal neighbours they touch
  const halfInfo = (r, c, side) => { // what is across `side` of cell (r,c), seen from (r,c)
    const [, dr, dc] = DIR4.find((d) => d[0] === side);
    const n = at(r + dr, c + dc);
    if (!n || n.kind === 'void') return { kind: 'void' };
    if (n.kind === 'diag') {
      const h = n.halves && n.halves[HALF_ON_SIDE[n.ch][OPP[side]]];
      return h || { kind: 'unknown' };
    }
    return { kind: n.kind, base: n.base };
  };
  for (let pass = 0; pass < 6; pass++) {
    let unresolved = 0;
    for (const row of cells) for (const cell of row) {
      if (cell.kind !== 'diag') continue;
      cell.halves = cell.halves || {};
      const names = cell.ch === '/' ? ['UL', 'LR'] : ['UR', 'LL'];
      for (const h of names) {
        if (cell.halves[h]) continue;
        const cand = HALF_NEIGHBOURS[h].map((s) => halfInfo(cell.r, cell.c, s));
        const sec = cand.find((x) => x.kind === 'sector');
        if (sec) { cell.halves[h] = { kind: 'sector', base: sec.base }; continue; }
        if (cand.some((x) => x.kind === 'unknown') && pass < 5) { unresolved++; continue; }
        const sol = cand.find((x) => x.kind === 'solid');
        cell.halves[h] = sol ? { kind: 'solid', base: sol.base } : { kind: 'solid', base: '#' };
      }
    }
    if (!unresolved) break;
  }
}

// ---------------------------------------------------------------- pieces
function cellCorners(r, c) {
  const x0 = c * CELL, x1 = x0 + CELL, yT = -r * CELL, yB = yT - CELL;
  return { TL: [x0, yT], TR: [x1, yT], BR: [x1, yB], BL: [x0, yB] };
}
const SHAPES = { // CCW corner lists
  F: ['BL', 'BR', 'TR', 'TL'],
  UL: ['BL', 'TR', 'TL'], LR: ['BL', 'BR', 'TR'],
  UR: ['TL', 'BR', 'TR'], LL: ['TL', 'BL', 'BR'],
};
const vkey = (p) => `${p[0]},${p[1]}`;
const ekey = (a, b) => { const ka = vkey(a), kb = vkey(b); return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };

function makePieces(lv) {
  const pieces = [];
  const edges = new Map(); // ekey -> [{piece, a, b, across}]
  const add = (r, c, shape, base) => {
    const k = cellCorners(r, c);
    const poly = SHAPES[shape].map((n) => k[n]);
    const piece = { id: pieces.length, r, c, shape, base, poly, sector: null };
    pieces.push(piece);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      let across;
      if (a[1] === b[1] && a[1] === k.TL[1]) across = { r: r - 1, c, side: 'S', dir: 'N' };
      else if (a[1] === b[1] && a[1] === k.BL[1]) across = { r: r + 1, c, side: 'N', dir: 'S' };
      else if (a[0] === b[0] && a[0] === k.TL[0]) across = { r, c: c - 1, side: 'E', dir: 'W' };
      else if (a[0] === b[0] && a[0] === k.TR[0]) across = { r, c: c + 1, side: 'W', dir: 'E' };
      else across = { r, c, diag: true };
      const key = ekey(a, b);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({ piece, a, b, across });
    }
    return piece;
  };
  for (const row of lv.cells) for (const cell of row) {
    if (cell.kind === 'sector') cell.pieces = { F: add(cell.r, cell.c, 'F', cell.base) };
    else if (cell.kind === 'diag') {
      cell.pieces = {};
      for (const [h, info] of Object.entries(cell.halves)) if (info.kind === 'sector') cell.pieces[h] = add(cell.r, cell.c, h, info.base);
    }
  }
  lv.pieces = pieces; lv.edges = edges;
}

// the solid legend char (or switch mark) across a one-sided edge
function solidAcross(lv, e) {
  const { across } = e;
  if (across.diag) {
    const cell = lv.cells[across.r][across.c];
    const other = Object.keys(cell.halves).find((h) => h !== e.piece.shape);
    const h = cell.halves[other];
    return { base: h && h.kind === 'solid' ? h.base : '#', mark: null };
  }
  const n = lv.at(across.r, across.c);
  if (!n || n.kind === 'void') return { base: null, mark: null };
  if (n.kind === 'diag') {
    const h = n.halves[HALF_ON_SIDE[n.ch][across.side]];
    return { base: h && h.kind === 'solid' ? h.base : '#', mark: null };
  }
  return { base: n.base, mark: n.mark && n.mark.type === 'switch' ? n.mark : null, cell: n };
}

// ---------------------------------------------------------------- sectors
function makeSectors(lv) {
  const { pieces, edges } = lv;
  const parent = pieces.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (const list of edges.values()) {
    if (list.length === 2 && list[0].piece.base === list[1].piece.base) union(list[0].piece.id, list[1].piece.id);
  }
  // merge=true: all regions of that char are one sector
  const firstOf = new Map();
  for (const p of pieces) {
    const d = lv.legend.get(p.base);
    if (!d.p.merge) continue;
    if (firstOf.has(p.base)) union(firstOf.get(p.base), p.id); else firstOf.set(p.base, p.id);
  }
  const comps = new Map();
  for (const p of pieces) {
    const k = find(p.id);
    if (!comps.has(k)) comps.set(k, []);
    comps.get(k).push(p);
  }
  const sectors = [];
  const newSector = (def, list, extra = {}) => {
    const s = { id: sectors.length, char: def.char, def, kind: def.kind, p: def.p, pieces: list, tags: [], neighbours: new Set(), ...extra };
    for (const pc of list) pc.sector = s;
    sectors.push(s);
    return s;
  };
  for (const list of comps.values()) {
    const def = lv.legend.get(list[0].base);
    if (def.kind === 'stairs') {
      const dir = String(def.p.dir || '').toUpperCase();
      if (!'NSEW'.includes(dir) || dir.length !== 1) { lv.err(`stairs '${def.char}' needs dir=N|S|E|W (the direction they rise)`, def.line); continue; }
      const rs = list.map((p) => p.r), cs = list.map((p) => p.c);
      const [r0, r1, c0, c1] = [Math.min(...rs), Math.max(...rs), Math.min(...cs), Math.max(...cs)];
      const idx = (p) => dir === 'N' ? r1 - p.r : dir === 'S' ? p.r - r0 : dir === 'E' ? p.c - c0 : c1 - p.c;
      const n = (dir === 'N' || dir === 'S' ? r1 - r0 : c1 - c0) + 1;
      const f0 = def.p.floor ?? 0, top = def.p.top;
      if (typeof top !== 'number') { lv.err(`stairs '${def.char}' needs top=<height of the last step>`, def.line); continue; }
      const rise = (top - f0) / n;
      if (Math.abs(rise) > 24) lv.err(`stairs '${def.char}' at col ${c0} row ${r0}: ${n} steps from ${f0} to ${top} rise ${rise.toFixed(1)} > 24 per step`, def.line);
      const bySteps = new Map();
      for (const p of list) { const i = idx(p); if (!bySteps.has(i)) bySteps.set(i, []); bySteps.get(i).push(p); }
      for (const [i, pl] of [...bySteps].sort((a, b) => a[0] - b[0])) {
        const fl = Math.round(f0 + (i + 1) * rise);
        newSector(def, pl, { step: i, stepFloor: fl });
      }
    } else newSector(def, list);
  }
  lv.sectors = sectors;
  // adjacency
  for (const list of edges.values()) {
    if (list.length !== 2) continue;
    const [a, b] = [list[0].piece.sector, list[1].piece.sector];
    if (!a || !b || a === b) continue;
    a.neighbours.add(b); b.neighbours.add(a);
  }
  // heights and surfaces. Rooms/stairs/windows first; doors and lifts derive from neighbours.
  for (const s of sectors) {
    const p = s.p;
    s.light = p.light ?? 160;
    s.ff = p.ff; s.cf = p.cf;
    if (s.kind === 'stairs') { s.floor = s.stepFloor; s.ceil = p.headroom ? s.floor + p.headroom : (p.ceil ?? 128); }
    else { s.floor = p.floor ?? 0; s.ceil = p.ceil ?? 128; }
  }
  for (const s of sectors) {
    const p = s.p;
    const nb = [...s.neighbours].filter((n) => n.kind !== 'door' && n.kind !== 'window' && n.kind !== 'lift');
    if (s.kind === 'door') {
      if (!nb.length) { lv.err(`door '${s.char}' at ${where(s)} has no room next to it`, s.def.line); continue; }
      const low = nb.reduce((a, b) => (b.floor < a.floor ? b : a));
      s.floor = s.def.own.floor ?? low.floor;
      if (s.def.own.ff === undefined) s.ff = low.ff;
      if (s.def.own.light === undefined) s.light = Math.min(...nb.map((n) => n.light));
      s.openCeil = Math.min(...nb.map((n) => n.ceil)) - 4;
      if (s.openCeil - s.floor < 56) lv.err(`door '${s.char}' at ${where(s)} opens only ${s.openCeil - s.floor} high (< 56)`, s.def.line);
      s.ceil = p.open ? s.openCeil : s.floor;
      const passNb = nb.filter((n) => n.floor < s.openCeil - 56);   // sides you walk through (not raised blocks at the jambs)
      for (const n of passNb) if (n.ceil - (s.openCeil + 4) > 16 && !p.secret) {
        lv.warn(`door '${s.char}' at ${where(s)}: the ${n.char} side's ceiling is ${n.ceil - s.openCeil - 4} above the doorway, so the door texture repeats above it (put a lower-ceiling frame cell in front)`, s.def.line);
        break;
      }
      s.cf = s.def.own.cf ?? 'METLFLR';
      const hiFloors = passNb.map((n) => n.floor);
      if (Math.max(...hiFloors) - s.floor > 24) lv.warn(`door '${s.char}' at ${where(s)}: neighbour floors differ by ${Math.max(...hiFloors) - s.floor}`, s.def.line);
      s.lock = p.lock ? String(p.lock) : null;
      if (s.lock && !(s.lock in LOCKS)) lv.err(`door '${s.char}': lock=${s.lock} (blue|red|yellow)`, s.def.line);
      s.remote = !!p.remote;
      s.tags.push(...resolveTagList(lv, p.tag, s.def.line));
      if (s.remote && !s.tags.length) lv.err(`remote door '${s.char}' at ${where(s)} needs tag=`, s.def.line);
    } else if (s.kind === 'lift') {
      s.top = p.top ?? p.floor ?? 0;
      s.floor = s.top;
      const lows = nb.map((n) => n.floor);
      s.low = lows.length ? Math.min(s.top, Math.min(...lows) + LIFT_LIP) : s.top;
      if (s.low >= s.top) lv.warn(`lift '${s.char}' at ${where(s)} has nothing lower next to it`, s.def.line);
      s.remote = !!p.remote;
      s.tags.push(...resolveTagList(lv, p.tag, s.def.line));
      if (s.def.own.light === undefined && nb.length) s.light = Math.max(...nb.map((n) => n.light));
    } else {
      s.tags.push(...resolveTagList(lv, p.tag, s.def.line));
    }
    if (p.enter) {
      if (!p.enter.special) lv.err(`'${s.char}': enter= needs Special(args)`, s.def.line);
      s.enter = p.enter;
    }
    if (p.slab) {
      if (!p.slab.range) lv.err(`'${s.char}': slab=z0..z1`, s.def.line);
      else {
        const [z0, z1] = p.slab.range;
        if (z0 < s.floor || z1 > s.ceil || z1 <= z0) lv.err(`'${s.char}': slab ${z0}..${z1} outside floor ${s.floor}..ceil ${s.ceil}`, s.def.line);
        s.slab = { z0, z1, top: p.slabtop || s.ff, bot: p.slabbot || s.cf, side: p.slabside || p.wall, light: p.slablight ?? Math.max(0, s.light - 24), type: p.slabtype ?? 1, flags: p.slabflags ?? 0, alpha: p.slabalpha ?? 255 };
      }
    }
    if (s.ceil - s.floor < 0) lv.err(`'${s.char}' at ${where(s)}: ceiling below floor`, s.def.line);
  }
  // texture roles
  for (const s of sectors) {
    const p = s.p;
    if (s.kind === 'door') {
      s.wall = p.track || p.wall; s.upperTex = p.tex; s.lowerTex = p.lower;
      if (!p.tex) lv.err(`door '${s.char}' needs tex=`, s.def.line);
    } else if (s.kind === 'window') {
      s.wall = p.frame || p.wall; s.upperTex = p.upper || p.frame || p.wall; s.lowerTex = p.lower || p.frame || p.wall;
    } else if (s.kind === 'lift') {
      s.wall = p.wall; s.lowerTex = p.tex || p.lower || p.wall; s.upperTex = p.upper;
    } else if (s.kind === 'stairs') {
      s.wall = p.wall; s.lowerTex = p.riser || p.lower || p.wall; s.upperTex = p.upper;
    } else {
      s.wall = p.wall; s.upperTex = p.upper; s.lowerTex = p.lower;
    }
    s.lowerSelf = s.kind === 'stairs' ? s.lowerTex : (s.p.lowerself || s.wall);
    if (!s.wall) lv.err(`'${s.char}' has no wall= texture (set it in the legend or in defaults)`, s.def.line);
    if (!s.ff || !s.cf) lv.err(`'${s.char}' has no ff=/cf= flats`, s.def.line);
  }
}

export function where(s) {
  const p = s.pieces[0];
  return `col ${p.c} row ${p.r}`;
}

// ---------------------------------------------------------------- lines
const RANK = { door: 3, lift: 3, window: 1 };
function makeLines(lv) {
  const lines = [];
  for (const list of lv.edges.values()) {
    if (list.length === 1) {
      const e = list[0], S = e.piece.sector;
      const sol = solidAcross(lv, e);
      const solidDef = sol.base ? lv.legend.get(sol.base) : null;
      let tex = (solidDef && solidDef.p.tex) || S.wall;
      const line = { v1: e.b, v2: e.a, front: { sector: S, mid: tex }, back: null, flags: {}, special: 0, args: [], role: 'wall' };
      if (S.kind === 'door') { line.front.mid = S.wall; line.flags.dontpegbottom = true; line.role = 'jamb'; }
      if (S.kind === 'window' || S.kind === 'lift') line.front.mid = S.wall;
      if (sol.mark) {
        const m = sol.mark;
        line.front.mid = m.props.tex || 'SW1LAB';
        line.special = specialNumber(m.special.special);
        line.args = m.special.args.map((a) => resolveArg(lv, a, m.line));
        line.flags.playeruse = true;
        if (!m.props.once) line.flags.repeatspecial = true;
        line.role = 'switch';
        if (m.props.lock) {
          if (!(m.props.lock in LOCKS)) lv.err(`switch '${m.char}': lock=${m.props.lock} (blue|red|yellow)`, m.line);
          else { line.locknumber = LOCKS[m.props.lock]; line.lockKey = String(m.props.lock); }
        }
        const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
        lv.switches.push({ mark: m, cell: sol.cell, special: m.special.special, args: line.args, pos: mid, sector: S, line });
        if (line.args[0] === 0 && !/^Exit_/.test(m.special.special)) lv.err(`switch '${m.char}' runs ${m.special.special} with tag 0 (a switch needs a tag)`, m.line);
      }
      lines.push(line);
      continue;
    }
    if (list.length !== 2) { lv.err(`edge shared by ${list.length} pieces (internal error)`); continue; }
    const [e1, e2] = list;
    const A = e1.piece.sector, B = e2.piece.sector;
    if (A === B) continue;
    let F, K, eF;
    const ra = RANK[A.kind] || 0, rb = RANK[B.kind] || 0;
    if (ra === 3 && rb === 3) { lv.err(`${A.kind} '${A.char}' touches ${B.kind} '${B.char}' at ${where(A)} (put a floor cell between them)`, A.def.line); continue; }
    if (ra > rb) { K = A; F = B; eF = e2; } else if (rb > ra) { K = B; F = A; eF = e1; }
    else if (A.id < B.id) { F = A; K = B; eF = e1; } else { F = B; K = A; eF = e2; }
    const line = {
      v1: eF.b, v2: eF.a, flags: { twosided: true }, special: 0, args: [], role: 'two',
      front: { sector: F, top: K.upperTex || F.wall, bottom: K.lowerTex || F.lowerSelf },
      back: { sector: K, top: F.upperTex || K.wall, bottom: F.lowerTex || K.lowerSelf },
    };
    // upper textures that continue a wall line up with the ceiling; door faces move with the door
    if (K.kind !== 'door') line.flags.dontpegtop = true;
    // windows: glass on the pane faces, impassable
    const win = K.kind === 'window' ? K : F.kind === 'window' ? F : null;
    if (win) {
      const wp = win.p;
      const eW = win === K ? (eF === e1 ? e2 : e1) : eF;
      const face = eW.across.dir; // side of the window cell this edge is on
      const panes = String(wp.pane || 'both').toUpperCase();
      if (wp.glass && (panes === 'BOTH' || panes.includes(face || '?'))) {
        line.front.mid = wp.glass; line.back.mid = wp.glass;
        if (!wp.nowrap) line.flags.wrapmidtex = true;
        line.flags.clipmidtex = true;
        if (wp.pegbottom) line.flags.dontpegbottom = true;
      }
      line.flags.blocking = true;
      if (!wp.broken) { line.flags.blockprojectiles = true; line.flags.blockhitscan = true; }
      line.role = 'window';
    }
    if (F.p.block || K.p.block) line.flags.blocking = true;
    // door specials (door is always the back sector: tag 0 = back sector)
    if (K.kind === 'door' && !K.remote) {
      const p = K.p, speed = p.speed ?? (p.blast ? BLAST_SPEED : DOOR_SPEED), delay = p.delay ?? DOOR_DELAY;
      if (K.lock) { line.special = 13; line.args = [0, speed, delay, LOCKS[K.lock]]; }
      else if (p.stay || p.secret) { line.special = 11; line.args = [0, speed]; }
      else { line.special = 12; line.args = [0, speed, delay]; line.flags.monsteruse = true; }
      line.flags.playeruse = true; line.flags.repeatspecial = true;
      if (p.secret) { line.flags.secret = true; line.front.top = p.tex; }
      line.role = 'door';
    }
    if (K.kind === 'lift' && !K.remote) {
      const p = K.p, speed = p.speed ?? LIFT_SPEED, delay = p.delay ?? LIFT_DELAY;
      line.special = 62; line.args = [0, speed, delay];
      if (F.floor < K.top - 24) line.flags.playeruse = true;
      else { line.flags.playercross = true; line.flags.playeruse = true; }
      line.flags.repeatspecial = true;
      line.role = 'lift';
    }
    const trig = F.enter || K.enter;
    if (trig) {
      if (F.enter && K.enter) lv.err(`two enter= regions touch at ${where(F)}`, F.def.line);
      if (line.special) lv.err(`enter= region '${(F.enter ? F : K).char}' touches a ${line.role} at ${where(F)}`, (F.enter ? F : K).def.line);
      else {
        const owner = F.enter ? F : K;
        line.special = specialNumber(trig.special);
        line.args = trig.args.map((a) => resolveArg(lv, a, owner.def.line));
        line.flags.playercross = true;
        if (owner.p.enterrepeat) line.flags.repeatspecial = true;
        line.role = 'trigger';
        line.trigger = owner;
      }
    }
    lines.push(line);
  }
  lv.lines = lines;
}

function sideKey(s) {
  if (!s) return '-';
  return `${s.sector.id}/${s.top || ''}/${s.mid || ''}/${s.bottom || ''}`;
}
function lineKey(l) {
  return `${sideKey(l.front)}|${sideKey(l.back)}|${l.special}|${l.args.join(',')}|${Object.keys(l.flags).sort().join(',')}|${l.role}`;
}

function mergeLines(lv) {
  const lines = lv.lines;
  for (const l of lines) { l.key = lineKey(l); l.alive = true; }
  const starts = new Map(), ends = new Map(), deg = new Map();
  const bump = (m, k, l) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(l); };
  for (const l of lines) {
    bump(starts, vkey(l.v1), l); bump(ends, vkey(l.v2), l);
    deg.set(vkey(l.v1), (deg.get(vkey(l.v1)) || 0) + 1); deg.set(vkey(l.v2), (deg.get(vkey(l.v2)) || 0) + 1);
  }
  const dir = (l) => [Math.sign(l.v2[0] - l.v1[0]), Math.sign(l.v2[1] - l.v1[1])];
  let merged = 0;
  for (const [v, d] of deg) {
    if (d !== 2) continue;
    const ins = ends.get(v), outs = starts.get(v);
    if (!ins || !outs || ins.size !== 1 || outs.size !== 1) continue;
    const A = [...ins][0], B = [...outs][0];
    if (A === B || A.key !== B.key || A.role === 'switch') continue;
    const da = dir(A), db = dir(B);
    if (da[0] !== db[0] || da[1] !== db[1]) continue;
    // merge B into A
    ends.get(vkey(A.v2)).delete(A);
    starts.get(vkey(B.v1)).delete(B);
    ends.get(vkey(B.v2)).delete(B);
    A.v2 = B.v2;
    bump(ends, vkey(A.v2), A);
    B.alive = false; merged++;
  }
  lv.lines = lines.filter((l) => l.alive);
  lv.mergedAway = merged;
  // world-aligned horizontal texture offsets
  for (const l of lv.lines) {
    const dx = l.v2[0] - l.v1[0], dy = l.v2[1] - l.v1[1], len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const off = (p, sx, sy) => { const o = Math.round(p[0] * sx + p[1] * sy); return ((o % 1024) + 1024) % 1024; };
    l.front.offsetx = off(l.v1, ux, uy);
    if (l.back) l.back.offsetx = off(l.v2, -ux, -uy);
  }
}

// ---------------------------------------------------------------- 3D floor control sectors
function makeControls(lv) {
  const specs = new Map();
  for (const s of lv.sectors) {
    if (!s.slab) continue;
    const k = JSON.stringify(s.slab);
    if (!specs.has(k)) {
      let t = 900; while (lv.usedTags.has(t)) t++;
      lv.usedTags.add(t);
      specs.set(k, { tag: t, slab: s.slab, targets: [] });
    }
    const sp = specs.get(k);
    sp.targets.push(s); s.tags.push(sp.tag);
  }
  // control sectors: 64x64 squares in a row below the map
  let x = 0;
  const y0 = -(lv.H * CELL) - 256;
  for (const sp of specs.values()) {
    const { slab } = sp;
    const sector = {
      id: lv.sectors.length, char: '(3d)', kind: 'control', control: true, floor: slab.z0, ceil: slab.z1,
      ff: slab.bot, cf: slab.top, light: slab.light, tags: [], pieces: [], p: {}, neighbours: new Set(),
    };
    lv.sectors.push(sector);
    const pts = [[x, y0 - 64], [x + 64, y0 - 64], [x + 64, y0], [x, y0]]; // CCW
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      const line = { v1: b, v2: a, front: { sector, mid: slab.side, offsetx: 0 }, back: null, flags: { dontdraw: true }, special: 0, args: [], role: 'control' };
      if (i === 0) { line.special = 160; line.args = [sp.tag, slab.type, slab.flags, slab.alpha]; }
      lv.lines.push(line);
    }
    lv.controls.push({ tag: sp.tag, slab, sector, targets: sp.targets });
    x += 128;
  }
}

// ---------------------------------------------------------------- things
export function sectorAt(lv, x, y) {
  const c = Math.floor(x / CELL), r = Math.floor(-y / CELL);
  const cell = lv.at(r, c);
  if (!cell || !cell.pieces) return null;
  if (cell.pieces.F) return cell.pieces.F.sector;
  // diagonal: pick the half containing the point
  const lx = (x - c * CELL) / CELL, ly = (-y - r * CELL) / CELL; // 0..1, y down
  let h;
  if (cell.ch === '/') h = lx + ly < 1 ? 'UL' : 'LR'; else h = lx > ly ? 'UR' : 'LL';
  return cell.pieces[h] ? cell.pieces[h].sector : null;
}

function parseAngle(v) {
  if (v === undefined) return 0;
  if (typeof v === 'number') return v;
  const u = String(v).toUpperCase();
  if (u in ANGLES) return ANGLES[u];
  return 0;
}

function makeThings(lv, ctx) {
  const list = [];
  for (const row of lv.cells) for (const cell of row) {
    if (cell.mark && cell.mark.type === 'thing') list.push({ cls: cell.mark.cls, col: cell.c, row: cell.r, props: cell.mark.props, line: cell.mark.line, mark: cell.mark.char });
  }
  list.push(...lv.src.things);
  for (const t of list) {
    const def = ctx.things.get(t.cls);
    if (!def) { lv.err(`unknown thing class "${t.cls}" (not in tools/data/things.json)`, t.line); continue; }
    const p = t.props;
    const x = Math.round((t.col + 0.5) * CELL + (p.dx || 0)), y = Math.round(-(t.row + 0.5) * CELL + (p.dy || 0));
    const sec = sectorAt(lv, x, y);
    if (!sec) { lv.err(`${t.cls} at col ${t.col} row ${t.row} is not inside a sector`, t.line); continue; }
    let height = 0;
    if (p.z === 'top') {
      if (!sec.slab) lv.err(`${t.cls} at col ${t.col} row ${t.row}: z=top but no slab there`, t.line);
      else height = sec.slab.z1 - sec.floor;
    } else if (typeof p.z === 'number') height = p.z - sec.floor;
    const args = (p.args === undefined ? [] : Array.isArray(p.args) ? p.args : [p.args]).map((a) => resolveArg(lv, a, t.line));
    for (let i = 0; i < 5; i++) if (p['a' + i] !== undefined) args[i] = resolveArg(lv, p['a' + i], t.line);
    if (args.length > 5) lv.err(`${t.cls}: more than 5 args`, t.line);
    const skills = p.skill !== undefined ? String(p.skill).split('').map(Number) : [1, 2, 3, 4, 5];
    const th = {
      cls: t.cls, ed: def.ed, x, y, height, z: sec.floor + height, angle: parseAngle(p.angle), args: args.map((a) => a | 0),
      skills, ambush: !!p.ambush, dormant: !!p.dormant, sector: sec, line: t.line, mark: t.mark, col: t.col, row: t.row,
      meta: {},
    };
    // checker semantics
    if (KEYS[t.cls]) th.meta.key = KEYS[t.cls];
    if (t.cls === 'DownedGuard' && DOWNED_GUARD_KEYS[th.args[0]]) th.meta.key = DOWNED_GUARD_KEYS[th.args[0]];
    const obj = p.obj ?? OBJECTIVE_ITEMS[t.cls];
    if (obj) th.meta.objective = obj;
    if (t.cls === 'HackTerminal') {
      th.meta.effect = th.args[2] ? { special: th.args[2], args: [th.args[3], 16, 150] } : null;
      if (th.args[4]) th.meta.objective = th.args[4];
      if (!th.args[0]) lv.err('HackTerminal needs args[0] = seconds', t.line);
    }
    if (t.cls === 'ExitGate') th.meta.gate = { mask: th.args[0], tag: th.args[1] };
    // HiveMind: args[0] = objective whose completion drops its shield (default 1),
    //           args[1] = objective its death completes (default 2); its death lowers tag 666
    if (t.cls === 'HiveMind') { th.meta.shieldObj = th.args[0] || 1; th.meta.deathObj = th.args[1] || 2; }
    if (p.ondeath) {
      if (!p.ondeath.special) lv.err(`${t.cls}: ondeath=Special(args)`, t.line);
      else th.meta.effect = { special: specialNumber(p.ondeath.special), args: p.ondeath.args.map((a) => resolveArg(lv, a, t.line)) };
    }
    lv.things.push(th);
  }
  const starts = lv.things.filter((t) => t.cls === 'PlayerStart');
  if (!starts.length) lv.err('no PlayerStart');
  if (starts.length > 1) lv.err(`${starts.length} PlayerStarts (want exactly 1)`);
}

// ---------------------------------------------------------------- validation
function checkTextures(lv, ctx) {
  const use = (name, what) => {
    if (!name || name === '-') return;
    if (!lv.textures.has(name)) lv.textures.set(name, what);
  };
  for (const l of lv.lines) for (const s of [l.front, l.back]) if (s) { use(s.top, 'wall'); use(s.mid, 'wall'); use(s.bottom, 'wall'); }
  for (const s of lv.sectors) { use(s.ff, 'flat'); use(s.cf, 'flat'); }
  for (const [name] of lv.textures) {
    if (!ctx.textures.all.has(name)) lv.err(`texture "${name}" is not in docs/ASSETS.md §5`);
    else if (name !== 'F_SKY1' && !ctx.textures.onDisk.has(name)) lv.missingTextures = (lv.missingTextures || 0) + 1, (lv.missingList = lv.missingList || []).push(name);
  }
}

// every sector boundary must be closed: at each vertex, as many boundary edges leave as arrive
function checkClosed(lv) {
  const bal = new Map();
  const add = (sid, v, d) => { const k = `${sid}@${vkey(v)}`; bal.set(k, (bal.get(k) || 0) + d); };
  for (const l of lv.lines) {
    add(l.front.sector.id, l.v1, 1); add(l.front.sector.id, l.v2, -1);
    if (l.back) { add(l.back.sector.id, l.v2, 1); add(l.back.sector.id, l.v1, -1); }
  }
  let bad = 0;
  for (const [k, v] of bal) if (v !== 0) { if (bad++ < 5) lv.err(`unclosed sector boundary at sector@vertex ${k}`); }
  if (bad > 5) lv.err(`... ${bad} unclosed vertices in total`);
}

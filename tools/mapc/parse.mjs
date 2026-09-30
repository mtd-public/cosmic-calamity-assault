// Parser for the mapc text format (see the header of tools/mapc.mjs and maps-src/README.md).
//
// A source is a sequence of directives and blocks:
//   map MAP01 "Title"            lump name and title (title is informational; MAPINFO owns names)
//   sky SKYA51                   informational
//   defaults k=v ...             defaults merged into every non-solid legend entry
//   tag @name N                  pin a symbolic tag to a number (otherwise auto-numbered from 100)
//   legend ... end               one entry per line:  <char> <kind> [k=v | flag]...
//   marks ... end                one entry per line:  <char> <Class> [k=v | flag]...
//                                                  or <char> switch <Special(args)> [k=v | flag]...
//   grid ... end                 the ASCII map; lines starting with ';' inside are comments/rulers
//   things ... end               one per line:        <Class> <col>,<row> [k=v | flag]...
// Comments: ';' or '//' to end of line (outside the grid block).

export class SourceError extends Error {
  constructor(file, line, msg) { super(`${file}:${line}: ${msg}`); this.file = file; this.line = line; }
}

// split on whitespace, keeping (...) "..." [...] groups together
export function tokenize(s) {
  const out = [];
  let cur = '', depth = 0, q = false;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === '"') q = false; continue; }
    if (ch === '"') { q = true; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function parseValue(v) {
  if (v === undefined) return true;
  if (/^".*"$/.test(v)) return v.slice(1, -1);
  if (/^[-+]?\d+(\.\d+)?$/.test(v)) return +v;
  let m;
  if ((m = /^(-?\d+)\.\.(-?\d+)$/.exec(v))) return { range: [+m[1], +m[2]] };
  if ((m = /^(?:#|0x)([0-9a-fA-F]{6})$/.exec(v))) return { color: parseInt(m[1], 16) };
  if ((m = /^([A-Za-z_]\w*)\((.*)\)$/.exec(v))) {
    const args = m[2].trim() ? m[2].split(',').map((a) => parseValue(a.trim())) : [];
    return { special: m[1], args };
  }
  if (v.includes(',')) return v.split(',').map((a) => parseValue(a.trim()));
  return v;
}

export function parseProps(tokens) {
  const props = {};
  for (const t of tokens) {
    const eq = t.indexOf('=');
    if (eq < 0) {
      // a bare Special(...) token is stored as props.special
      const pv = parseValue(t);
      if (pv && typeof pv === 'object' && pv.special) props.special = pv;
      else props[t] = true;
    } else props[t.slice(0, eq)] = parseValue(t.slice(eq + 1));
  }
  return props;
}

function stripComment(line) {
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    if (q) continue;
    if (c === ';') return line.slice(0, i);
    if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

export function parseSource(text, file) {
  const lines = text.split(/\r?\n/);
  const src = {
    file, name: null, title: '', sky: null, defaults: {}, pinnedTags: {},
    legend: new Map(), marks: new Map(), grid: [], gridLine0: 0, things: [],
  };
  let mode = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1, raw = lines[i];
    if (mode === 'grid') {
      if (raw.trim() === 'end') { mode = null; continue; }
      if (raw.startsWith(';')) continue;
      if (!src.grid.length) src.gridLine0 = ln;
      src.grid.push({ text: raw.replace(/\s+$/, ''), line: ln });
      continue;
    }
    const t = stripComment(raw).trim();
    if (!t) continue;
    if (mode) {
      if (t === 'end') { mode = null; continue; }
      if (mode === 'legend') {
        const ch = raw.trimStart()[0];
        const rest = tokenize(t.slice(1).trim());
        if (!rest.length) throw new SourceError(file, ln, `legend entry for '${ch}' has no kind`);
        if (src.legend.has(ch)) throw new SourceError(file, ln, `legend char '${ch}' defined twice`);
        if (ch === ';' || ch === '/' || ch === '\\' || ch === ' ') throw new SourceError(file, ln, `'${ch}' is reserved and cannot be a legend char`);
        src.legend.set(ch, { char: ch, kind: rest[0], props: parseProps(rest.slice(1)), line: ln });
      } else if (mode === 'marks') {
        const ch = raw.trimStart()[0];
        const rest = tokenize(t.slice(1).trim());
        if (!rest.length) throw new SourceError(file, ln, `mark '${ch}' has no class`);
        if (src.marks.has(ch)) throw new SourceError(file, ln, `mark char '${ch}' defined twice`);
        if (rest[0] === 'switch') {
          const sp = parseValue(rest[1] || '');
          if (!sp || !sp.special) throw new SourceError(file, ln, `switch mark '${ch}' needs a Special(args) after "switch"`);
          src.marks.set(ch, { char: ch, type: 'switch', special: sp, props: parseProps(rest.slice(2)), line: ln });
        } else {
          src.marks.set(ch, { char: ch, type: 'thing', cls: rest[0], props: parseProps(rest.slice(1)), line: ln });
        }
      } else if (mode === 'things') {
        const toks = tokenize(t);
        const m = /^(-?[\d.]+),(-?[\d.]+)$/.exec(toks[1] || '');
        if (!m) throw new SourceError(file, ln, `thing needs "<Class> <col>,<row>"`);
        src.things.push({ cls: toks[0], col: +m[1], row: +m[2], props: parseProps(toks.slice(2)), line: ln });
      }
      continue;
    }
    const toks = tokenize(t);
    switch (toks[0]) {
      case 'map': src.name = toks[1].toUpperCase(); src.title = toks[2] ? parseValue(toks.slice(2).join(' ')) : ''; break;
      case 'sky': src.sky = toks[1]; break;
      case 'defaults': Object.assign(src.defaults, parseProps(toks.slice(1))); break;
      case 'tag': src.pinnedTags[toks[1]] = +toks[2]; break;
      case 'legend': case 'marks': case 'grid': case 'things': mode = toks[0]; break;
      default: throw new SourceError(file, ln, `unknown directive "${toks[0]}"`);
    }
  }
  if (mode) throw new SourceError(file, lines.length, `block "${mode}" not closed with "end"`);
  if (!src.name) throw new SourceError(file, 1, 'missing "map MAPxx" directive');
  if (!src.grid.length) throw new SourceError(file, 1, 'missing grid');
  for (const ch of src.marks.keys()) if (src.legend.has(ch)) throw new SourceError(file, src.marks.get(ch).line, `'${ch}' is both a legend char and a mark`);
  return src;
}

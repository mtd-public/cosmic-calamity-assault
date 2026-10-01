// Palette quantization for the pk3: RGBA → ≤256-colour indexed PNG (PLTE +
// tRNS), median cut over opaque colours with a separate entry per distinct
// soft-alpha level. Source art in mod/ stays truecolour; only the packed copy
// is indexed (GZDoom renders indexed PNGs in truecolour). grAb is preserved.
import zlib from 'node:zlib';
import { decodePNG } from './png.mjs';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

// median cut on [r,g,b,a,count] entries
function medianCut(colors, maxColors) {
  let boxes = [colors];
  while (boxes.length < maxColors) {
    // split the box with the largest (range × population)
    let best = -1, bestScore = 0, bestCh = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.length < 2) continue;
      let pop = 0; const lo = [255, 255, 255, 255], hi = [0, 0, 0, 0];
      for (const c of b) { pop += c[4]; for (let k = 0; k < 4; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; } }
      const ranges = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], (hi[3] - lo[3]) * 2];
      const ch = ranges.indexOf(Math.max(...ranges));
      const score = ranges[ch] * Math.sqrt(pop);
      if (score > bestScore) { bestScore = score; best = i; bestCh = ch; }
    }
    if (best < 0) break;
    const b = boxes[best].sort((x, y) => x[bestCh] - y[bestCh]);
    let total = 0; for (const c of b) total += c[4];
    let acc = 0, cut = 1;
    for (let i = 0; i < b.length - 1; i++) { acc += b[i][4]; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(best, 1, b.slice(0, cut), b.slice(cut));
  }
  return boxes.map((b) => {
    let n = 0; const s = [0, 0, 0, 0];
    for (const c of b) { for (let k = 0; k < 4; k++) s[k] += c[k] * c[4]; n += c[4]; }
    return s.map((v) => Math.round(v / n));
  });
}

export function quantizePNG(buf, maxColors = 256) {
  const { w, h, grab, data } = decodePNG(buf);
  // histogram (5-bit per channel buckets keep it fast; alpha kept at 3 bits)
  const hist = new Map();
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a === 0) continue;
    const key = ((data[i * 4] >> 3) << 13) | ((data[i * 4 + 1] >> 3) << 8) | ((data[i * 4 + 2] >> 3) << 3) | (a >> 5);
    const e = hist.get(key);
    if (e) { e[0] += data[i * 4]; e[1] += data[i * 4 + 1]; e[2] += data[i * 4 + 2]; e[3] += a; e[4]++; }
    else hist.set(key, [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], a, 1]);
  }
  const colors = [...hist.values()].map((e) => [e[0] / e[4], e[1] / e[4], e[2] / e[4], e[3] / e[4], e[4]]);
  const pal = colors.length ? medianCut(colors, maxColors - 1) : [];
  pal.unshift([0, 0, 0, 0]);   // index 0 = fully transparent
  // map pixels (cache per bucket key)
  const cache = new Map(), idx = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a === 0) { idx[i] = 0; continue; }
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const key = ((r >> 2) << 18) | ((g >> 2) << 12) | ((b >> 2) << 6) | (a >> 2);
    let k = cache.get(key);
    if (k === undefined) {
      let bd = Infinity; k = 1;
      for (let p = 1; p < pal.length; p++) {
        const q = pal[p], d = (q[0] - r) ** 2 * 2 + (q[1] - g) ** 2 * 3 + (q[2] - b) ** 2 + (q[3] - a) ** 2 * 4;
        if (d < bd) { bd = d; k = p; }
      }
      cache.set(key, k);
    }
    idx[i] = k;
  }
  // encode: adaptive filter per row (none / sub / up) by min sum of abs
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = idx.subarray(y * w, y * w + w), prev = y ? idx.subarray((y - 1) * w, y * w) : null;
    const cand = [
      [0, (x) => row[x]],
      [1, (x) => (row[x] - (x ? row[x - 1] : 0)) & 255],
      [2, (x) => (row[x] - (prev ? prev[x] : 0)) & 255],
    ];
    let bestF = 0, bestS = Infinity;
    for (const [f, fn] of cand) { let s = 0; for (let x = 0; x < w; x++) { const v = fn(x); s += v < 128 ? v : 256 - v; } if (s < bestS) { bestS = s; bestF = f; } }
    raw[y * (w + 1)] = bestF;
    const fn = cand[bestF][1];
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = fn(x);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  const plte = Buffer.alloc(pal.length * 3), trns = Buffer.alloc(pal.length);
  pal.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; trns[i] = c[3]; });
  const parts = [SIG, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns)];
  if (grab) { const g = Buffer.alloc(8); g.writeInt32BE(grab[0], 0); g.writeInt32BE(grab[1], 4); parts.push(chunk('grAb', g)); }
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

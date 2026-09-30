// Minimal PNG encode/decode for the asset pipeline (RGBA8 only, no filters on
// encode beyond "up"). Doom offsets travel in the grAb chunk: two signed
// big-endian int32s (left offset, top offset), which GZDoom reads for sprites
// and patches.
import zlib from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

// rgba: Uint8Array/Buffer of w*h*4. grab: [leftOffset, topOffset] or null.
export function encodePNG(rgba, w, h, { grab = null } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1);
    // filter 2 ("up") compresses smooth renders noticeably better than none
    raw[o] = y === 0 ? 0 : 2;
    for (let x = 0; x < stride; x++) {
      const v = rgba[y * stride + x];
      raw[o + 1 + x] = y === 0 ? v : (v - rgba[(y - 1) * stride + x]) & 255;
    }
  }
  const parts = [SIG, chunk('IHDR', ihdr)];
  if (grab) {
    const g = Buffer.alloc(8); g.writeInt32BE(Math.round(grab[0]), 0); g.writeInt32BE(Math.round(grab[1]), 4);
    parts.push(chunk('grAb', g));
  }
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// Header + grAb only (for build-time checks): { w, h, grab }
export function pngInfo(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, grab = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); }
    if (type === 'grAb') grab = [buf.readInt32BE(p + 8), buf.readInt32BE(p + 12)];
    if (type === 'IDAT' || type === 'IEND') break;
    p += 12 + len;
  }
  return { w, h, grab };
}

// Full decode (RGBA8 / RGB8 / grey, non-interlaced), for tools that post-process renders.
export function decodePNG(buf) {
  const { w, h, grab } = pngInfo(buf);
  let p = 8, ct = 6, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    if (type === 'IHDR') ct = buf[p + 17];
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = { 6: 4, 2: 3, 0: 1, 4: 2 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(w * h * 4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[x] = r & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (bpp === 4) { out[o] = cur[x * 4]; out[o + 1] = cur[x * 4 + 1]; out[o + 2] = cur[x * 4 + 2]; out[o + 3] = cur[x * 4 + 3]; }
      else if (bpp === 3) { out[o] = cur[x * 3]; out[o + 1] = cur[x * 3 + 1]; out[o + 2] = cur[x * 3 + 2]; out[o + 3] = 255; }
      else if (bpp === 2) { out[o] = out[o + 1] = out[o + 2] = cur[x * 2]; out[o + 3] = cur[x * 2 + 1]; }
      else { out[o] = out[o + 1] = out[o + 2] = cur[x]; out[o + 3] = 255; }
    }
    cur.copy(prev);
  }
  return { w, h, grab, data: out };
}

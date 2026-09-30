// WAD read/write. A UDMF map is a WAD with lumps: <MAPNAME> (empty marker),
// TEXTMAP, [ZNODES ...], ENDMAP.
export function writeWad(lumps, type = 'PWAD') {
  let off = 12;
  const dir = [], bodies = [];
  for (const l of lumps) {
    const data = Buffer.isBuffer(l.data) ? l.data : Buffer.from(l.data || '', 'latin1');
    const d = Buffer.alloc(16);
    d.writeInt32LE(data.length ? off : 0, 0); d.writeInt32LE(data.length, 4);
    d.write(l.name.toUpperCase().slice(0, 8).padEnd(8, '\0'), 8, 'latin1');
    dir.push(d); bodies.push(data); off += data.length;
  }
  const hdr = Buffer.alloc(12);
  hdr.write(type, 0, 'latin1'); hdr.writeInt32LE(lumps.length, 4); hdr.writeInt32LE(off, 8);
  return Buffer.concat([hdr, ...bodies, ...dir]);
}

export function readWad(buf) {
  const n = buf.readInt32LE(4), dirOff = buf.readInt32LE(8), lumps = [];
  for (let i = 0; i < n; i++) {
    const o = dirOff + i * 16, pos = buf.readInt32LE(o), size = buf.readInt32LE(o + 4);
    const name = buf.toString('latin1', o + 8, o + 16).replace(/\0.*$/, '');
    lumps.push({ name, data: buf.subarray(pos, pos + size) });
  }
  return { type: buf.toString('latin1', 0, 4), lumps };
}

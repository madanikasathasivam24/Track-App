// One-off script to generate solid-color placeholder PNGs for the 5 avatar slots.
// Run: node scripts/gen-placeholder-avatars.js
// Replace the output files with real artwork before shipping (see README).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}

// Point-to-shape distance/containment helpers. All coordinates are pixel
// offsets (dx, dy) from the icon center; `s` is the canvas size, so shapes
// are specified as fractions of `s` for resolution independence.
function dist(dx, dy, cx, cy) {
  return Math.hypot(dx - cx, dy - cy);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const lenSq = sx * sx + sy * sy;
  let t = lenSq === 0 ? 0 : ((px - x1) * sx + (py - y1) * sy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * sx), py - (y1 + t * sy));
}

function inRect(dx, dy, x1, y1, x2, y2) {
  return dx >= x1 && dx <= x2 && dy >= y1 && dy <= y2;
}

// Vehicle glyphs, each a union of circles/rects/thick line-segments
// expressed as fractions of the canvas size `s`.
const glyphs = {
  car: (dx, dy, s) => {
    const body = inRect(dx, dy, -0.32 * s, -0.02 * s, 0.32 * s, 0.14 * s);
    const cabin = inRect(dx, dy, -0.16 * s, -0.18 * s, 0.14 * s, -0.02 * s);
    const wheelL = dist(dx, dy, -0.2 * s, 0.14 * s) <= 0.075 * s;
    const wheelR = dist(dx, dy, 0.2 * s, 0.14 * s) <= 0.075 * s;
    return body || cabin || wheelL || wheelR;
  },
  truck: (dx, dy, s) => {
    const cargo = inRect(dx, dy, -0.32 * s, -0.2 * s, 0.08 * s, 0.12 * s);
    const cab = inRect(dx, dy, 0.08 * s, -0.12 * s, 0.3 * s, 0.12 * s);
    const wheelL = dist(dx, dy, -0.2 * s, 0.14 * s) <= 0.075 * s;
    const wheelR = dist(dx, dy, 0.2 * s, 0.14 * s) <= 0.075 * s;
    return cargo || cab || wheelL || wheelR;
  },
  bike: (dx, dy, s) => {
    const wheelL = dist(dx, dy, -0.22 * s, 0.1 * s) <= 0.13 * s;
    const wheelR = dist(dx, dy, 0.22 * s, 0.1 * s) <= 0.13 * s;
    const seatStay = distToSegment(dx, dy, -0.22 * s, 0.1 * s, -0.02 * s, -0.14 * s) <= 0.03 * s;
    const topTube = distToSegment(dx, dy, -0.02 * s, -0.14 * s, 0.14 * s, -0.06 * s) <= 0.03 * s;
    const forkTube = distToSegment(dx, dy, 0.14 * s, -0.06 * s, 0.22 * s, 0.1 * s) <= 0.03 * s;
    const downTube = distToSegment(dx, dy, -0.02 * s, -0.14 * s, 0.04 * s, 0.1 * s) <= 0.03 * s;
    const chainStay = distToSegment(dx, dy, 0.04 * s, 0.1 * s, 0.22 * s, 0.1 * s) <= 0.03 * s;
    const seatPost = distToSegment(dx, dy, -0.02 * s, -0.14 * s, -0.02 * s, -0.2 * s) <= 0.025 * s;
    const handlebar = distToSegment(dx, dy, 0.14 * s, -0.06 * s, 0.14 * s, -0.2 * s) <= 0.025 * s;
    return wheelL || wheelR || seatStay || topTube || forkTube || downTube || chainStay || seatPost || handlebar;
  },
  airplane: (dx, dy, s) => {
    const fuselage = distToSegment(dx, dy, 0, -0.28 * s, 0, 0.24 * s) <= 0.035 * s;
    const wingL = distToSegment(dx, dy, 0, 0.02 * s, -0.32 * s, 0.16 * s) <= 0.035 * s;
    const wingR = distToSegment(dx, dy, 0, 0.02 * s, 0.32 * s, 0.16 * s) <= 0.035 * s;
    const tailL = distToSegment(dx, dy, 0, 0.2 * s, -0.14 * s, 0.28 * s) <= 0.03 * s;
    const tailR = distToSegment(dx, dy, 0, 0.2 * s, 0.14 * s, 0.28 * s) <= 0.03 * s;
    return fuselage || wingL || wingR || tailL || tailR;
  },
  scooter: (dx, dy, s) => {
    const wheelRear = dist(dx, dy, -0.22 * s, 0.15 * s) <= 0.09 * s;
    const wheelFront = dist(dx, dy, 0.22 * s, 0.15 * s) <= 0.09 * s;
    const deck = inRect(dx, dy, -0.2 * s, 0.06 * s, 0.14 * s, 0.11 * s);
    const steerColumn = distToSegment(dx, dy, 0.16 * s, 0.08 * s, 0.16 * s, -0.2 * s) <= 0.025 * s;
    const handlebar = distToSegment(dx, dy, 0.05 * s, -0.2 * s, 0.27 * s, -0.2 * s) <= 0.03 * s;
    return wheelRear || wheelFront || deck || steerColumn || handlebar;
  },
};

function iconPng(size, [r, g, b], glyph) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const cx = size / 2;
  const cy = size / 2;
  const hitTest = glyphs[glyph];

  const rowLen = size * 3;
  const raw = Buffer.alloc((rowLen + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowLen + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      const isGlyph = hitTest(x - cx, y - cy, size);
      if (isGlyph) {
        raw[px] = 255;
        raw[px + 1] = 255;
        raw[px + 2] = 255;
      } else {
        raw[px] = r;
        raw[px + 1] = g;
        raw[px + 2] = b;
      }
    }
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const avatars = [
  { color: [0x0f, 0x6e, 0x6e], glyph: 'car' }, // teal
  { color: [0xe0, 0x8e, 0x45], glyph: 'bike' }, // amber
  { color: [0x5b, 0x6f, 0xe0], glyph: 'airplane' }, // indigo
  { color: [0xe0, 0x5b, 0x8e], glyph: 'truck' }, // rose
  { color: [0x6f, 0xa8, 0x4f], glyph: 'scooter' }, // moss
];

const outDir = path.join(__dirname, '..', 'src', 'assets', 'avatars');
avatars.forEach(({ color, glyph }, i) => {
  const out = path.join(outDir, `avatar-${i + 1}.png`);
  fs.writeFileSync(out, iconPng(256, color, glyph));
  console.log('wrote', out);
});

// Rasterises the flowdraft logo (same geometry as public/favicon.svg) into PNG app icons.
// Usage: node scripts/icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#1a1a1a');
const FG = hex('#f2f2f2');
const RED = hex('#e5484d');

function sdRoundBox(px, py, x, y, w, h, r) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * t, pay - bay * t);
}

/** Layers in 64-unit logo space: [distanceFn, color]. `half` is half the stroke width. */
const makeLayers = (half) => [
  [(x, y) => Math.abs(sdRoundBox(x, y, 10, 12, 22, 15, 4)) - half, FG],
  [(x, y) => sdRoundBox(x, y, 32, 37, 22, 15, 4), RED],
  [(x, y) => Math.min(sdSegment(x, y, 21, 27, 21, 44.5), sdSegment(x, y, 21, 44.5, 28, 44.5)) - half, FG],
];

function renderRgba(size, { rounded, contentScale, stroke = 3.5 }) {
  const layers = makeLayers(stroke / 2);
  const px = new Uint8Array(size * size * 4);
  const unit = size / 64;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const lx = (i + 0.5) / unit;
      const ly = (j + 0.5) / unit;
      let a = 1;
      if (rounded) a = Math.min(1, Math.max(0, 0.5 - sdRoundBox(lx, ly, 0, 0, 64, 64, 14) * unit));
      let [r, g, b] = BG;
      // Content is scaled around the centre (maskable icons keep it inside the safe zone).
      const cx = (lx - 32) / contentScale + 32;
      const cy = (ly - 32) / contentScale + 32;
      for (const [dist, color] of layers) {
        const cov = Math.min(1, Math.max(0, 0.5 - dist(cx, cy) * unit * contentScale));
        if (cov > 0) {
          r = r + (color[0] - r) * cov;
          g = g + (color[1] - g) * cov;
          b = b + (color[2] - b) * cov;
        }
      }
      const o = (j * size + i) * 4;
      px[o] = Math.round(r);
      px[o + 1] = Math.round(g);
      px[o + 2] = Math.round(b);
      px[o + 3] = Math.round(a * 255);
    }
  }
  return px;
}

const render = (size, opts) => encodePng(size, size, renderRgba(size, opts));

/** ICO container with embedded PNG images (supported by every current browser). */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), render(192, { rounded: true, contentScale: 1 }));
writeFileSync(new URL('icon-512.png', out), render(512, { rounded: true, contentScale: 1 }));
writeFileSync(new URL('icon-maskable-512.png', out), render(512, { rounded: false, contentScale: 0.78 }));
writeFileSync(new URL('apple-touch-icon.png', out), render(180, { rounded: false, contentScale: 0.86 }));
// Tab icons: bolder strokes so the mark stays legible at 16px.
const small = (size) => ({ size, png: render(size, { rounded: true, contentScale: 1.06, stroke: size <= 16 ? 6 : 5 }) });
writeFileSync(new URL('favicon.ico', out), encodeIco([small(16), small(32), small(48)]));
writeFileSync(new URL('favicon-32.png', out), small(32).png);
console.log('icons written');

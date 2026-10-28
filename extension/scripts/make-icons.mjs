// Draws the toolbar icons (brand gradient square, two lines of text) with no dependencies.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const STOPS = [[0xa6, 0x8e, 0xff], [0x6e, 0x46, 0xff], [0xc2, 0x08, 0xff]];

function inRound(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function icon(size) {
  const S = 4; // supersampling
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = (x + (sx + 0.5) / S) / size;
          const v = (y + (sy + 0.5) / S) / size;
          if (!inRound(u, v, 0, 0, 1, 1, 0.22)) continue;
          const t = (u + v) / 2;
          const base = t < 0.45 ? mix(STOPS[0], STOPS[1], t / 0.45) : mix(STOPS[1], STOPS[2], (t - 0.45) / 0.55);
          const line = inRound(u, v, 0.25, 0.3, 0.75, 0.42, 0.06) || inRound(u, v, 0.25, 0.54, 0.58, 0.66, 0.06);
          const c = line ? [255, 255, 255] : base;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const n = S * S;
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = a ? Math.round(r / a) : 0;
      raw[i + 1] = a ? Math.round(g / a) : 0;
      raw[i + 2] = a ? Math.round(b / a) : 0;
      raw[i + 3] = Math.round((a / n) * 255);
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [16, 32, 48, 128]) writeFileSync(join(out, `icon${size}.png`), icon(size));
console.log('icons written to', out);

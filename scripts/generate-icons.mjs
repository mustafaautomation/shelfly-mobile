// Draws the Shelfly mark (the same geometry as the web app's app/icon.svg) into every
// PNG the Expo config needs. Pure Node: no image libraries, so CI and new machines can
// re-run it with `npm run icons`.
//
// The mark lives on a 32 x 32 grid: three paper shelf boards at y = 11, 16, 21 running
// from x = 7 to x = 25, and two copper uprights at x = 11 and x = 21. Stroke width 1.6.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const GREEN = [0x1e, 0x3d, 0x32, 255];
const PAPER = [0xf3, 0xef, 0xe4, 255];
const COPPER = [0xe0, 0x8a, 0x45, 255];
const WHITE = [255, 255, 255, 255];

const STROKE = 1.6;

function shelfShapes(boards, uprights, stroke = STROKE) {
  const half = stroke / 2;
  const shapes = [];
  for (const y of [11, 16, 21]) shapes.push({ kind: 'rect', x0: 7, y0: y - half, x1: 25, y1: y + half, color: boards });
  for (const x of [11, 21]) shapes.push({ kind: 'rect', x0: x - half, y0: 11, x1: x + half, y1: 21, color: uprights });
  return shapes;
}

function inside(shape, x, y) {
  if (shape.kind === 'full') return true;
  if (x < shape.x0 || x > shape.x1 || y < shape.y0 || y > shape.y1) return false;
  const r = shape.r ?? 0;
  if (r <= 0) return true;
  const cx = Math.min(Math.max(x, shape.x0 + r), shape.x1 - r);
  const cy = Math.min(Math.max(y, shape.y0 + r), shape.y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * Rasterise shapes defined on the 32-unit grid.
 * `scale` grows the artwork around the centre (16, 16) without moving the background.
 */
function render(size, { background, shapes, scale = 1, samples = 4 }) {
  const pixels = Buffer.alloc(size * size * 4);
  const unit = size / 32;
  const step = 1 / samples;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const gx = (px + (sx + 0.5) * step) / unit;
          const gy = (py + (sy + 0.5) * step) / unit;
          let color = null;
          if (background && inside(background, gx, gy)) color = background.color;
          const ax = 16 + (gx - 16) / scale;
          const ay = 16 + (gy - 16) / scale;
          for (const shape of shapes) if (inside(shape, ax, ay)) color = shape.color;
          if (color) {
            const alpha = color[3] / 255;
            r += color[0] * alpha;
            g += color[1] * alpha;
            b += color[2] * alpha;
            a += alpha;
          }
        }
      }
      const offset = (py * size + px) * 4;
      const n = samples * samples;
      pixels[offset] = a ? Math.round(r / a) : 0;
      pixels[offset + 1] = a ? Math.round(g / a) : 0;
      pixels[offset + 2] = a ? Math.round(b / a) : 0;
      pixels[offset + 3] = Math.round((a / n) * 255);
    }
  }
  return pixels;
}

function crc(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([length, body, sum]);
}

function png(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.resolve('assets/images');
fs.mkdirSync(out, { recursive: true });

const brand = shelfShapes(PAPER, COPPER);
const files = [
  // iOS / store icon: full-bleed green, the OS applies its own mask.
  ['icon.png', 1024, { background: { kind: 'full', color: GREEN }, shapes: brand, scale: 1.05 }],
  // Browser tab: the exact rounded tile from the web app.
  ['favicon.png', 96, { background: { kind: 'rect', x0: 0, y0: 0, x1: 32, y1: 32, r: 8, color: GREEN }, shapes: brand }],
  // Splash: the boards and uprights on the green splash background set in app.json.
  ['splash-icon.png', 1024, { shapes: shelfShapes(PAPER, COPPER, 1.4), scale: 1.65 }],
  // Android adaptive icon: art inside the 66 dp safe circle, solid green layer behind it.
  ['android-icon-foreground.png', 1024, { shapes: brand, scale: 0.82 }],
  ['android-icon-background.png', 512, { background: { kind: 'full', color: GREEN }, shapes: [] , samples: 1 }],
  ['android-icon-monochrome.png', 1024, { shapes: shelfShapes(WHITE, WHITE), scale: 0.82 }],
  // Android status-bar notification icon: white silhouette on transparent.
  ['notification-icon.png', 96, { shapes: shelfShapes(WHITE, WHITE, 2.2), scale: 1.5 }],
];

for (const [name, size, options] of files) {
  fs.writeFileSync(path.join(out, name), png(size, render(size, options)));
  console.log(`wrote assets/images/${name} (${size}x${size})`);
}

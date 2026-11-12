// Generates simple indigo placeholder icons (no extra dependencies needed).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size * 0.22; // corner radius
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      // rounded square mask
      const dx = Math.max(Math.abs(x + 0.5 - cx) - (cx - r), 0);
      const dy = Math.max(Math.abs(y + 0.5 - cy) - (cy - r), 0);
      const inside = dx * dx + dy * dy <= r * r;
      // white ring in the middle (a simple "timer" look)
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const ring = d > size * 0.22 && d < size * 0.32;
      const [R, G, B] = ring ? [255, 255, 255] : [79, 70, 229];
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const s of [16, 32, 48, 128]) {
  writeFileSync(`public/icons/icon${s}.png`, makePng(s));
  console.log(`public/icons/icon${s}.png`);
}

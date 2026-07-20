// Builds the Chrome Web Store upload zip (unlisted listing) from the
// already-built dist/content.js plus manifest.json and icons/. Run via
// `npm run package` (runs `npm run build` first).
//
// Uses Node's built-in zlib deflate + a hand-rolled ZIP (local file headers
// + central directory) instead of a `zip` CLI dependency, since Git Bash on
// Windows doesn't ship one and we'd rather not add a package for something
// that runs rarely.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const distEntry = path.join(root, "dist", "content.js");

if (!existsSync(distEntry)) {
  console.error("dist/content.js missing — run `npm run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const outDir = path.join(root, "release");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `screener-ai-context-v${manifest.version}.zip`);

const files = [
  "manifest.json",
  "dist/content.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, dosDate };
}

const localParts = [];
const centralParts = [];
let offset = 0;
const { time, dosDate } = dosDateTime(new Date());

for (const rel of files) {
  const data = readFileSync(path.join(root, rel));
  const compressed = deflateRawSync(data);
  const crc = crc32(data);
  const nameBuf = Buffer.from(rel.replace(/\\/g, "/"), "utf8");

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(8, 8); // method: deflate
  localHeader.writeUInt16LE(time, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  localParts.push(localHeader, nameBuf, compressed);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(8, 10); // method
  centralHeader.writeUInt16LE(time, 12);
  centralHeader.writeUInt16LE(dosDate, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30); // extra len
  centralHeader.writeUInt16LE(0, 32); // comment len
  centralHeader.writeUInt16LE(0, 34); // disk number
  centralHeader.writeUInt16LE(0, 36); // internal attrs
  centralHeader.writeUInt32LE(0, 38); // external attrs
  centralHeader.writeUInt32LE(offset, 42);

  centralParts.push(centralHeader, nameBuf);

  offset += localHeader.length + nameBuf.length + compressed.length;
}

const centralSize = centralParts.reduce((n, b) => n + b.length, 0);
const centralOffset = offset;

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(centralOffset, 16);
end.writeUInt16LE(0, 20);

writeFileSync(outFile, Buffer.concat([...localParts, ...centralParts, end]));

console.log(`Wrote ${path.relative(root, outFile)}`);

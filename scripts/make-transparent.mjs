import fs from 'fs';
import zlib from 'zlib';

function createPngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  
  // CRC32
  let crc = 0 ^ (-1);
  for (let i = 0; i < body.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ body[i]) & 0xFF];
  }
  crc = (crc ^ (-1)) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, body, crcBuf]);
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function processLogo(inputPath, outputPath) {
  const file = fs.readFileSync(inputPath);
  let pos = 8;
  let width, height;
  const idatBuffers = [];

  while (pos < file.length) {
    const length = file.readUInt32BE(pos);
    const type = file.toString('ascii', pos + 4, pos + 8);
    const data = file.slice(pos + 8, pos + 8 + length);
    pos += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatBuffers.push(data);
    }
  }

  const raw = zlib.inflateSync(Buffer.concat(idatBuffers));
  const srcStride = 1 + width * 3;
  const dstStride = 1 + width * 4;
  const dstData = Buffer.alloc(height * dstStride);

  for (let y = 0; y < height; y++) {
    const srcLine = raw.slice(y * srcStride, (y + 1) * srcStride);
    const filter = srcLine[0]; // Filter type 0
    dstData[y * dstStride] = filter;

    for (let x = 0; x < width; x++) {
      const r = srcLine[1 + x * 3];
      const g = srcLine[1 + x * 3 + 1];
      const b = srcLine[1 + x * 3 + 2];
      
      const dstIdx = y * dstStride + 1 + x * 4;
      dstData[dstIdx] = r;
      dstData[dstIdx + 1] = g;
      dstData[dstIdx + 2] = b;
      
      // If dark, transparent; if white, opaque
      const bright = (r + g + b) / 3;
      if (bright < 50) {
        dstData[dstIdx + 3] = 0;
      } else {
        dstData[dstIdx + 3] = Math.min(255, Math.round(bright));
      }
    }
  }

  // Create new PNG
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(dstData);
  const outBuf = Buffer.concat([
    header,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', compressed),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);

  fs.writeFileSync(outputPath, outBuf);
  console.log(`Saved transparent logo: ${outputPath} (${width}x${height})`);
}

processLogo('public/assets/gymmy/cleanrep-r.png', 'public/assets/gymmy/cleanrep-r.png');

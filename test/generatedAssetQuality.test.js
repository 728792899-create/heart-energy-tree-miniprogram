const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const zlib = require('node:zlib');

const projectRoot = path.resolve(__dirname, '..');
const cutouts = [
  'couple-hold.png',
  'couple-jump.png',
  'couple-stand.png',
  'particle-coin.png',
  'particle-heart.png',
  'particle-petal.png',
  'particle-star.png',
  'tree-level-1.png',
  'tree-level-2.png',
  'tree-level-3.png',
  'tree-level-4.png',
  'tree-level-5.png'
];

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodeRgba(filePath) {
  const png = fs.readFileSync(filePath);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', path.basename(filePath));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  assert.equal(bitDepth, 8, `${path.basename(filePath)} must use 8-bit channels`);
  assert.equal(colorType, 6, `${path.basename(filePath)} must be a real RGBA cutout, not a palette/checkerboard preview`);

  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[sourceOffset++];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[sourceOffset++];
      const left = x >= 4 ? pixels[rowOffset + x - 4] : 0;
      const up = y > 0 ? pixels[rowOffset - stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[rowOffset - stride + x - 4] : 0;
      if (filter === 0) pixels[rowOffset + x] = value;
      else if (filter === 1) pixels[rowOffset + x] = (value + left) & 255;
      else if (filter === 2) pixels[rowOffset + x] = (value + up) & 255;
      else if (filter === 3) pixels[rowOffset + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) pixels[rowOffset + x] = (value + paeth(left, up, upLeft)) & 255;
      else assert.fail(`${path.basename(filePath)} uses unsupported PNG filter ${filter}`);
    }
  }
  return { width, height, pixels };
}

test('generated decorative PNGs are true transparent cutouts without baked checkerboard backgrounds', () => {
  cutouts.forEach((name) => {
    const filePath = path.join(projectRoot, 'miniprogram/assets/generated', name);
    const { width, height, pixels } = decodeRgba(filePath);
    let transparent = 0;
    let opaqueNeutralGray = 0;
    let borderOpaque = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const [r, g, b, a] = pixels.subarray(index, index + 4);
        if (a < 16) transparent += 1;
        if (a > 240 && Math.max(r, g, b) - Math.min(r, g, b) < 12 && r >= 40 && r <= 130) {
          opaqueNeutralGray += 1;
        }
        if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && a > 16) borderOpaque += 1;
      }
    }

    const total = width * height;
    assert.ok(transparent / total >= 0.2, `${name} needs at least 20% transparent background`);
    assert.ok(opaqueNeutralGray / total < 0.08, `${name} still looks like it contains a gray checkerboard background`);
    assert.equal(borderOpaque, 0, `${name} must have a fully transparent outer border`);
  });
});

test('known checkerboard preview tiles around the main subjects are transparent', () => {
  const backgroundProbes = {
    'couple-hold.png': { referenceSize: [520, 520], probes: [[110, 233], [116, 209]] },
    'tree-level-1.png': { referenceSize: [420, 420], probes: [[286, 247], [205, 93]] },
    'tree-level-5.png': { referenceSize: [560, 560], probes: [[151, 40], [432, 488]] }
  };

  Object.entries(backgroundProbes).forEach(([name, { referenceSize, probes }]) => {
    const filePath = path.join(projectRoot, 'miniprogram/assets/generated', name);
    const { width, height, pixels } = decodeRgba(filePath);
    probes.forEach(([referenceX, referenceY]) => {
      const x = Math.round(referenceX * width / referenceSize[0]);
      const y = Math.round(referenceY * height / referenceSize[1]);
      const alpha = pixels[(y * width + x) * 4 + 3];
      assert.ok(alpha < 16, `${name} checkerboard probe ${x},${y} must be transparent`);
    });
  });
});

const stitchScenes = [
  'participant-avatar.jpg',
  'participant-note-avatar.jpg',
  'participant-garden.jpg',
  'companion-avatar.jpg',
  'companion-encouragement.jpg',
  'checkin-avatar.jpg',
  'checkin-yoga.jpg',
  'map-avatar.jpg',
  'map-hill.jpg',
  'map-couple.jpg',
  'shop-avatar.jpg',
  'reward-massage.jpg',
  'reward-dishes.jpg',
  'reward-dinner.jpg',
  'profile-cover.jpg',
  'profile-couple.jpg'
];

test('Stitch original scene assets are local non-empty JPEG files', () => {
  stitchScenes.forEach((name) => {
    const filePath = path.join(projectRoot, 'miniprogram/assets/stitch-original', name);
    assert.ok(fs.existsSync(filePath), `${name} must exist locally`);
    const jpeg = fs.readFileSync(filePath);
    assert.ok(jpeg.length > 5 * 1024, `${name} must not be an empty placeholder`);
    assert.equal(jpeg[0], 0xff, `${name} must start with a JPEG marker`);
    assert.equal(jpeg[1], 0xd8, `${name} must start with a JPEG marker`);
    assert.equal(jpeg[jpeg.length - 2], 0xff, `${name} must end with a JPEG marker`);
    assert.equal(jpeg[jpeg.length - 1], 0xd9, `${name} must end with a JPEG marker`);
  });
});

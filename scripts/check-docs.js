const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DOCS_ROOT = path.join(ROOT, 'docs');
const SCREENSHOT_ROOT = path.join(DOCS_ROOT, 'screenshots');
const ILLUSTRATION_ROOT = path.join(DOCS_ROOT, 'illustrations');
const TOTAL_DOC_IMAGE_BUDGET = 4 * 1024 * 1024;
const PER_IMAGE_BUDGET = 800 * 1024;
const PER_SCREENSHOT_BUDGET = 180 * 1024;
const GENERATED_ILLUSTRATION_BUDGET = 600 * 1024;
const GENERATED_ILLUSTRATIONS = new Set([
  'couple-journey.jpg',
  'trust-safety-garden.jpg'
]);

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute, predicate);
    return !predicate || predicate(absolute) ? [absolute] : [];
  });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function stripFencedCode(source) {
  return source.replace(/```[\s\S]*?```/g, '');
}

function normalizeTarget(rawTarget) {
  let target = String(rawTarget || '').trim();
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
  return target.split('#')[0].split('?')[0];
}

function isExternalTarget(target) {
  return !target
    || target.startsWith('#')
    || /^(?:https?:|mailto:|tel:|data:|file:|app:)/i.test(target);
}

function parsePng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 24 || !signature.every((value, index) => buffer[index] === value)) return null;
  return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) return null;
  let offset = 2;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 8 < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (startOfFrame.has(marker) && length >= 7) {
      return {
        format: 'jpeg',
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  return null;
}

function imageMetadata(filePath) {
  const buffer = fs.readFileSync(filePath);
  return parsePng(buffer) || parseJpeg(buffer);
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateMarkdown(markdownFiles, errors) {
  const referencedImages = new Set();
  markdownFiles.forEach((filePath) => {
    const source = stripFencedCode(fs.readFileSync(filePath, 'utf8'));
    const markdownLinks = Array.from(source.matchAll(/(!?)\[([^\]]*)\]\(([^)]+)\)/g));
    markdownLinks.forEach((match) => {
      const isImage = match[1] === '!';
      const label = match[2].trim();
      const rawTarget = match[3].trim().split(/\s+["']/)[0];
      const target = normalizeTarget(rawTarget);
      if (isImage) assert(Boolean(label), `${relative(filePath)} has an image without alt text`, errors);
      if (isExternalTarget(rawTarget)) return;
      const resolved = path.resolve(path.dirname(filePath), decodeURIComponent(target));
      assert(fs.existsSync(resolved), `${relative(filePath)} links to missing ${target}`, errors);
      if (isImage && fs.existsSync(resolved)) referencedImages.add(resolved);
    });

    Array.from(source.matchAll(/<img\b[^>]*>/gi)).forEach((match) => {
      const tag = match[0];
      const sourceMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      assert(Boolean(altMatch && altMatch[1].trim()), `${relative(filePath)} has an HTML image without alt text`, errors);
      if (!sourceMatch || isExternalTarget(sourceMatch[1])) return;
      const target = normalizeTarget(sourceMatch[1]);
      const resolved = path.resolve(path.dirname(filePath), decodeURIComponent(target));
      assert(fs.existsSync(resolved), `${relative(filePath)} links to missing ${target}`, errors);
      if (fs.existsSync(resolved)) referencedImages.add(resolved);
    });

    Array.from(source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)).forEach((match) => {
      if (isExternalTarget(match[1])) return;
      const target = normalizeTarget(match[1]);
      const resolved = path.resolve(path.dirname(filePath), decodeURIComponent(target));
      assert(fs.existsSync(resolved), `${relative(filePath)} links to missing ${target}`, errors);
    });
  });
  return referencedImages;
}

function validateImageFiles(errors) {
  const screenshotFiles = walk(SCREENSHOT_ROOT, (file) => /\.(?:png|jpe?g)$/i.test(file));
  const illustrationFiles = walk(ILLUSTRATION_ROOT, (file) => /\.(?:png|jpe?g)$/i.test(file));
  const allFiles = [...screenshotFiles, ...illustrationFiles];
  const totalBytes = allFiles.reduce((total, file) => total + fs.statSync(file).size, 0);

  assert(screenshotFiles.length === 13, `expected 13 documentation screenshots, found ${screenshotFiles.length}`, errors);
  assert(illustrationFiles.length === 3, `expected 3 documentation illustrations, found ${illustrationFiles.length}`, errors);
  assert(totalBytes <= TOTAL_DOC_IMAGE_BUDGET, `documentation images use ${totalBytes} bytes, budget is ${TOTAL_DOC_IMAGE_BUDGET}`, errors);

  allFiles.forEach((filePath) => {
    const size = fs.statSync(filePath).size;
    const metadata = imageMetadata(filePath);
    assert(Boolean(metadata), `${relative(filePath)} is not a valid JPEG or PNG`, errors);
    assert(size <= PER_IMAGE_BUDGET, `${relative(filePath)} uses ${size} bytes, per-image budget is ${PER_IMAGE_BUDGET}`, errors);
    if (!metadata) return;
    assert(metadata.width > 0 && metadata.height > 0, `${relative(filePath)} has invalid dimensions`, errors);
    if (filePath.startsWith(SCREENSHOT_ROOT + path.sep)) {
      assert(size <= PER_SCREENSHOT_BUDGET, `${relative(filePath)} uses ${size} bytes, screenshot budget is ${PER_SCREENSHOT_BUDGET}`, errors);
      assert(metadata.height >= 400, `${relative(filePath)} is too short to document a mini-program view`, errors);
    } else {
      assert(metadata.format === 'jpeg', `${relative(filePath)} should be a compressed JPEG`, errors);
      assert(metadata.width >= 1000, `${relative(filePath)} is too narrow for a documentation illustration`, errors);
      if (GENERATED_ILLUSTRATIONS.has(path.basename(filePath))) {
        assert(size <= GENERATED_ILLUSTRATION_BUDGET, `${relative(filePath)} uses ${size} bytes, generated illustration budget is ${GENERATED_ILLUSTRATION_BUDGET}`, errors);
      }
    }
  });

  return { screenshotFiles, illustrationFiles, totalBytes };
}

function validatePageCatalog(errors) {
  const appConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'miniprogram/app.json'), 'utf8'));
  const catalog = fs.readFileSync(path.join(DOCS_ROOT, 'page-catalog.md'), 'utf8');
  assert(appConfig.pages.length === 22, `expected 22 app routes, found ${appConfig.pages.length}`, errors);
  appConfig.pages.forEach((route) => {
    assert(catalog.includes(`\`${route}\``), `docs/page-catalog.md does not document ${route}`, errors);
  });
}

function main() {
  const errors = [];
  const markdownFiles = [path.join(ROOT, 'README.md'), ...walk(DOCS_ROOT, (file) => file.endsWith('.md'))];
  const referencedImages = validateMarkdown(markdownFiles, errors);
  const imageSummary = validateImageFiles(errors);
  validatePageCatalog(errors);

  if (errors.length) {
    errors.forEach((error) => console.error(`docs-check: ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Documentation check passed: ${markdownFiles.length} Markdown files, ${referencedImages.size} referenced local images, ${imageSummary.screenshotFiles.length} screenshots, ${imageSummary.illustrationFiles.length} illustrations, ${imageSummary.totalBytes} bytes.`);
}

main();

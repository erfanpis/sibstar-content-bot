import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const dataPath = path.resolve(process.argv[2] || './example.json');
const dataDir = path.dirname(dataPath);
const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
const here = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(here, 'template.svg');
const logoPath = path.join(here, 'sibstar-logo.png');

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function dataUri(buffer, mime) { return `data:${mime};base64,${buffer.toString('base64')}`; }

if (!data.appName || !data.version || !data.icon) {
  throw new Error('JSON must include appName, version, and icon.');
}

const logo = await fs.readFile(logoPath);
const iconPath = path.resolve(dataDir, data.icon);
const iconBuffer = await sharp(iconPath).rotate().resize(410, 410, {
  fit: 'cover', position: 'centre'
}).png().toBuffer();

const appName = String(data.appName);
const appNameEn = String(data.appNameEn || '').trim();
const version = String(data.version).replace(/^v/i, '');
const typeLabel = data.type === 'game' ? 'بازی' : (data.typeLabel || 'برنامه');
// Basic adaptive sizing so longer Persian names stay inside the right-side card.
const appNameSize = Math.max(34, Math.min(58, Math.floor(58 - Math.max(0, appName.length - 13) * 1.7)));
const isPersianName = /[\u0600-\u06FF]/.test(appName);
const appNameAnchor = isPersianName ? 'start' : 'end';
const appNameDirection = isPersianName ? 'rtl' : 'ltr';
const appIconElement = `<image x="166" y="385" width="382" height="382" preserveAspectRatio="xMidYMid slice" clip-path="url(#appIconClip)" href="${dataUri(iconBuffer, 'image/png')}" xlink:href="${dataUri(iconBuffer, 'image/png')}"/>`;

let svg = await fs.readFile(templatePath, 'utf8');
const replacements = {
  '{{LOGO_DATA_URI}}': dataUri(logo, 'image/png'),
  '{{APP_ICON_ELEMENT}}': appIconElement,
  '{{APP_NAME}}': esc(appName),
  '{{APP_NAME_EN}}': esc(appNameEn),
  '{{APP_NAME_SIZE}}': String(appNameSize),
  '{{APP_NAME_ANCHOR}}': appNameAnchor,
  '{{APP_NAME_DIRECTION}}': appNameDirection,
  '{{VERSION}}': esc(version),
  '{{TYPE_LABEL}}': esc(typeLabel),
};
for (const [token, value] of Object.entries(replacements)) svg = svg.replaceAll(token, value);

const outputPath = path.resolve(dataDir, data.output || './sibstar-update.png');
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(outputPath);
console.log(`Created: ${outputPath}`);

// Flowdraft asset pack. All writes stay inside icons/.
// Edit symbol.svg to change the mark, then run `npm ci && npm run build` in icons/.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import * as fontkit from 'fontkit';

const root = fileURLToPath(new URL('../', import.meta.url));
const C = { ink: '#161616', tile: '#1a1a1a', white: '#f2f2f2', paper: '#f5f5f3', red: '#e5484d' };
const fontFile = path.join(root, 'source/Geist.ttf');
const baseFont = fontkit.openSync(fontFile);
const extendedFont = fontkit.openSync(path.join(root, 'source/Geist-LatinExt.ttf'));
const fonts = new Map();
const source = await readFile(path.join(root, 'source/symbol.svg'), 'utf8');
const shapes = source.match(/<path[\s\S]*?(?=<\/svg>)/)[0].trim();
let count = 0;

async function save(name, data) {
  const target = path.join(root, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  count++;
}

function svg(width, height, content, title = 'flowdraft') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none"><title>${title}</title>${content}</svg>\n`;
}

function mark(fg = C.white, accent = C.red) {
  return shapes.replaceAll('#f2f2f2', fg).replaceAll('#e5484d', accent);
}

function placeMark(x, y, size, fg = C.white, accent = C.red) {
  return `<g transform="translate(${x} ${y}) scale(${size / 64})">${mark(fg, accent)}</g>`;
}

// Outline every glyph: delivered SVGs never depend on an installed font.
function lettering(value, x, baseline, size, color, weight = 600, spacing = -0.025) {
  if (!fonts.has(weight)) fonts.set(weight, [baseFont, extendedFont].map(f => f.getVariation({ wght: weight })));
  const available = fonts.get(weight);
  const runs = [];
  for (const char of value) {
    const font = available.find(f => f.hasGlyphForCodePoint(char.codePointAt(0)));
    if (!font) throw new Error(`Missing glyph: ${char}`);
    const last = runs.at(-1);
    if (last?.font === font) last.text += char;
    else runs.push({ font, text: char });
  }
  let cursor = 0;
  const paths = [];
  for (const { font, text } of runs) {
    const scale = size / font.unitsPerEm;
    const run = font.layout(text);
    run.glyphs.forEach((glyph, i) => {
      const pos = run.positions[i];
      paths.push(`<path d="${glyph.path.toSVG()}" transform="translate(${x + cursor + pos.xOffset * scale} ${baseline - pos.yOffset * scale}) scale(${scale} ${-scale})"/>`);
      cursor += pos.xAdvance * scale + spacing * size;
    });
  }
  return { body: `<g fill="${color}">${paths.join('')}</g>`, width: cursor };
}

function label(value, x, baseline, size = 18, color = C.ink, weight = 450) {
  return lettering(value, x, baseline, size, color, weight, 0).body;
}

function lockup(fg, accent = C.red) {
  const word = lettering('flowdraft', 172, 108, 100, fg);
  return { width: Math.ceil(172 + word.width + 20), height: 144, body: placeMark(0, 0, 144, fg, accent) + word.body };
}

function placedLockup(x, y, width, fg, accent = C.red) {
  const art = lockup(fg, accent);
  return `<g transform="translate(${x} ${y}) scale(${width / art.width})">${art.body}</g>`;
}

function tile({ rounded = false, contentScale = 0.9, bg = C.tile, mono = false } = {}) {
  const offset = (64 - 64 * contentScale) / 2;
  return svg(64, 64, `<rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${bg}"/>${placeMark(offset, offset, 64 * contentScale, C.white, mono ? C.white : C.red)}`);
}

// The 16 px mark has its own pixel-aligned silhouette and a wider connecting bar.
function favicon(size = 32) {
  if (size === 16) {
    return svg(16, 16, `<rect width="16" height="16" rx="3.5" fill="${C.tile}"/><path d="M12 2H7A4 4 0 0 0 3 6V12.5A1.5 1.5 0 0 0 6 12.5V9H10V6H6A1 1 0 0 1 7 5H12A1.5 1.5 0 0 0 12 2Z" fill="${C.white}"/><rect x="9" y="6" width="4" height="4" rx="1" fill="${C.red}"/>`);
  }
  return tile({ rounded: true, contentScale: 1 });
}

async function raster(art, width, height = width, opaque = false) {
  let pipeline = sharp(Buffer.from(art), { density: 192 }).resize(width, height);
  if (opaque) pipeline = pipeline.flatten({ background: C.tile }).removeAlpha();
  return pipeline.png().toBuffer();
}

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size;
    entry[1] = size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(i => i.data)]);
}

for (const [name, fg, accent] of [
  ['on-light', C.ink, C.red], ['on-dark', C.white, C.red],
  ['mono-black', '#000000', '#000000'], ['mono-white', '#ffffff', '#ffffff'],
]) {
  const symbol = svg(64, 64, mark(fg, accent));
  await save(`logo/symbol-${name}.svg`, symbol);
  await save(`logo/symbol-${name}.png`, await raster(symbol, 512));
  const art = lockup(fg, accent);
  const horizontal = svg(art.width, art.height, art.body);
  await save(`logo/logo-${name}.svg`, horizontal);
  await save(`logo/logo-${name}.png`, await raster(horizontal, art.width * 2, art.height * 2));
}

await save('favicon/favicon.svg', favicon());
const icoImages = [];
for (const size of [16, 32, 48, 64]) {
  const data = await raster(favicon(size), size);
  await save(`favicon/favicon-${size}.png`, data);
  if (size <= 48) icoImages.push({ size, data });
}
await save('favicon/favicon.ico', ico(icoImages));

const master = tile({ contentScale: 0.86 });
const pwa = tile({ contentScale: 0.9, rounded: true });
const maskable = tile({ contentScale: 0.8 });
await save('app/app-icon.svg', master);
await save('app/app-icon-1024.png', await raster(master, 1024, 1024, true));
await save('app/apple-touch-icon.png', await raster(master, 180, 180, true));
await save('app/icon-maskable.svg', maskable);
for (const size of [192, 512]) {
  await save(`app/icon-${size}.png`, await raster(pwa, size));
  await save(`app/icon-maskable-${size}.png`, await raster(maskable, size, size, true));
}

await save('ios/AppIcon.appiconset/icon-1024.png', await raster(master, 1024, 1024, true));
await save('ios/AppIcon.appiconset/Contents.json', JSON.stringify({
  images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n');

// Android adaptive layer: 108 dp canvas. Essential artwork fits inside r=33 dp.
// Foreground transform: 64-unit symbol centered in the 108 dp canvas.
const adaptive = svg(108, 108, placeMark(22, 22, 64));
const adaptiveMono = svg(108, 108, placeMark(22, 22, 64, '#ffffff', '#ffffff'));
await save('android/adaptive-foreground.svg', adaptive);
await save('android/adaptive-monochrome.svg', adaptiveMono);
await save('android/play-store-512.png', await raster(master, 512, 512, true));
for (const [density, legacySize, adaptiveSize] of [
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
]) {
  await save(`android/res/mipmap-${density}/ic_launcher.png`, await raster(pwa, legacySize));
  await save(`android/res/mipmap-${density}/ic_launcher_foreground.png`, await raster(adaptive, adaptiveSize));
  await save(`android/res/mipmap-${density}/ic_launcher_monochrome.png`, await raster(adaptiveMono, adaptiveSize));
}
await save('android/res/values/colors.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="flowdraft_icon_background">${C.tile}</color>\n</resources>\n`);
const adaptiveXml = (monochrome = false) => `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/flowdraft_icon_background"/>\n  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n${monochrome ? '  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n' : ''}</adaptive-icon>\n`;
await save('android/res/mipmap-anydpi-v26/ic_launcher.xml', adaptiveXml());
await save('android/res/mipmap-anydpi-v33/ic_launcher.xml', adaptiveXml(true));

// A portable visual contact sheet; all text is outlined, including the labels.
const preview = [];
preview.push(`<rect width="1440" height="1050" fill="${C.paper}"/><rect width="1440" height="420" fill="${C.tile}"/>`);
preview.push(label('flowdraft', 64, 65, 24, C.white, 600));
preview.push(label('Logo & uygulama ikonları', 1080, 65, 18, '#a8a8a8'));
preview.push(placedLockup(64, 150, 890, C.white));
preview.push(label('Fikirden akışa.', 89, 378, 22, '#a8a8a8'));
preview.push(`<g transform="translate(1150 160) scale(3)">${tile({ rounded: true, contentScale: 0.86 }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`);
preview.push(`<rect x="1150.5" y="160.5" width="191" height="191" rx="42" stroke="#3a3a3a"/>`);
preview.push(label('Açık zemin', 64, 481, 18, '#52524e'));
preview.push(placedLockup(64, 510, 520, C.ink));
preview.push(`<rect x="720" y="453" width="656" height="199" rx="16" fill="${C.tile}"/>`);
preview.push(label('Koyu zemin', 752, 490, 18, '#a8a8a8'));
preview.push(placedLockup(752, 513, 520, C.white));
preview.push(`<path d="M64 690H1376" stroke="#d3d3ce"/>`);
preview.push(label('Uygulama', 64, 741, 18, '#52524e'));
preview.push(label('Tek renk', 580, 741, 18, '#52524e'));
preview.push(label('Favicon / gerçek boyut', 978, 741, 18, '#52524e'));
preview.push(`<g transform="translate(64 773) scale(1.75)">${tile({ rounded: true, contentScale: 0.86 }).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`);
preview.push(`<clipPath id="circle"><circle cx="276" cy="829" r="56"/></clipPath><g clip-path="url(#circle)"><g transform="translate(220 773) scale(1.75)">${maskable.replace(/<svg[^>]*>|<\/svg>/g, '')}</g></g>`);
preview.push(label('iOS', 107, 916, 15, '#52524e'));
preview.push(label('Android / PWA', 223, 916, 15, '#52524e'));
preview.push(placeMark(584, 779, 96, C.ink, C.ink));
preview.push(`<rect x="729" y="773" width="112" height="112" rx="24" fill="${C.red}"/>`);
preview.push(placeMark(737, 781, 96, '#ffffff', '#ffffff'));
for (const [size, x, y] of [[16, 980, 822], [32, 1060, 814], [48, 1160, 806], [64, 1270, 798]]) {
  preview.push(`<g transform="translate(${x} ${y}) scale(${size / (size === 16 ? 16 : 64)})">${favicon(size).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`);
  preview.push(label(`${size}`, x + size / 2 - 9, 903, 14, '#52524e'));
}
preview.push(`<path d="M64 955H1376" stroke="#d3d3ce"/>`);
for (const [i, color] of [C.tile, C.white, C.red].entries()) {
  const x = 64 + i * 200;
  preview.push(`<rect x="${x}" y="982" width="24" height="24" rx="6" fill="${color}" stroke="#d3d3ce" stroke-width="0.5"/>`);
  preview.push(label(color.toUpperCase(), x + 36, 1000, 16, '#52524e'));
}
preview.push(label('Vektör kaynaklar · PNG çıktılar · Web / iOS / Android', 952, 1000, 15, '#52524e'));
const board = svg(1440, 1050, preview.join(''), 'flowdraft — logo ve ikon seti');
await save('preview.svg', board);
await save('preview.png', await raster(board, 1440, 1050, true));
console.log(`Created ${count} assets inside ${root}`);

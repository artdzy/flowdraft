// Checks the guide pages (seo/guides/*.json) the way the server loads them, then draws every example in both
// languages and writes the pages, so they can be looked at before a deploy. Needs "npm run build" first.
//
//   node scripts/check-guides.mjs [outDir = ./tmp-guides-out] [guidesDir = ./seo/guides]
//
// Exits with 1 when a file has a problem the server would refuse to start with, or when an example fails to draw.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGuides } from '../seo/guides.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'tmp-guides-out'));
const dir = process.argv[3] ? path.resolve(process.argv[3]) : undefined;

if (!existsSync(path.join(root, 'dist-server/mcp.js'))) {
  console.error('dist-server/mcp.js is missing: run "npm run build" first.');
  process.exit(1);
}
const diagram = await import('../dist-server/mcp.js');

let guides;
try {
  guides = createGuides({ root, dir, diagram });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

let pictures = 0;
const failed = [];
for (const lang of ['tr', 'en']) {
  mkdirSync(path.join(out, lang), { recursive: true });
  for (const id of guides.examples()) {
    // The server's picture() logs a drawing error and returns null; here that fails the check.
    const pic = guides.picture(lang, id);
    const small = guides.picture(lang, id, 1);
    if (!pic || !small) {
      failed.push(`${lang}/${id}`);
      continue;
    }
    writeFileSync(path.join(out, lang, `${id}.png`), pic.png);
    pictures++;
    if (pic.width > 1800) console.log(`note: ${lang}/${id}.png is ${pic.width} px wide (diagram wider than ~900 px)`);
  }
}
if (failed.length) {
  console.error(`${failed.length} example picture(s) failed to draw: ${failed.join(', ')}`);
  process.exit(1);
}

const rows = guides.report();
mkdirSync(path.join(out, 'html'), { recursive: true });
for (const row of rows) writeFileSync(path.join(out, 'html', `${row.path.slice(1).replace(/\//g, '_')}.html`), guides.html(row.path));

const table = [['page', 'lang', 'title', 'descr.', 'words', 'examples'], ...rows.map((r) => [r.path, r.lang, r.title, r.description, r.words, r.examples])];
const widths = table[0].map((_, i) => Math.max(...table.map((r) => String(r[i]).length)));
for (const [i, r] of table.entries()) {
  console.log(r.map((c, j) => (j === 0 ? String(c).padEnd(widths[j]) : String(c).padStart(widths[j]))).join('  '));
  if (i === 0) console.log(widths.map((w) => '-'.repeat(w)).join('  '));
}
console.log(`\n${rows.length} pages, ${pictures} pictures written to ${path.relative(process.cwd(), out) || '.'}`);
if (guides.warnings.length) console.log(`\n${guides.warnings.length} warning(s):\n  - ${guides.warnings.join('\n  - ')}`);

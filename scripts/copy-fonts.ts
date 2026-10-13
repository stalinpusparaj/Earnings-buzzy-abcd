// Copies the self-hosted glyph fonts from the Fontsource packages into public/fonts.
// Baloo 2 (Latin) and Baloo Thambi 2 (Tamil), weight 800, SIL Open Font License 1.1.
// Script-level subsets (Latin, Tamil) rather than per-letter ones, so adding a letter
// later never needs a new font build. Run after upgrading the packages: npm run fonts
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'public/fonts');

const FONTS = [
  { pkg: 'baloo-2', file: 'baloo-2-latin-800-normal.woff2', family: 'Baloo 2', subset: 'Latin' },
  { pkg: 'baloo-thambi-2', file: 'baloo-thambi-2-tamil-800-normal.woff2', family: 'Baloo Thambi 2', subset: 'Tamil' },
];

mkdirSync(OUT, { recursive: true });
const lines = ['# Self-hosted fonts', '', 'Copied by `npm run fonts` (scripts/copy-fonts.ts). Licensed under the SIL Open Font License 1.1: see OFL.txt.', ''];
for (const f of FONTS) {
  const dir = join(ROOT, 'node_modules/@fontsource', f.pkg);
  const version = (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string }).version;
  copyFileSync(join(dir, 'files', f.file), join(OUT, f.file));
  const kb = (statSync(join(OUT, f.file)).size / 1024).toFixed(1);
  lines.push(`- \`${f.file}\`: ${f.family}, ${f.subset} subset, weight 800 (@fontsource/${f.pkg} ${version}, ${kb} KB)`);
  console.log(`copied ${f.file} (${kb} KB)`);
}
copyFileSync(join(ROOT, 'node_modules/@fontsource/baloo-2/LICENSE'), join(OUT, 'OFL.txt'));
writeFileSync(join(OUT, 'README.md'), lines.join('\n') + '\n');
console.log('wrote public/fonts/OFL.txt and README.md');

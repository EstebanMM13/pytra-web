// Post-build step: preload the fonts the first paint needs.
//
// The font files come from @fontsource through styles.css, so esbuild emits them under
// media/ with a content hash in the name. This script looks the hashed names up in the build
// output, adds <link rel="preload"> tags to index.html and refreshes the index.html hash in
// ngsw.json (the service worker refuses to cache a file whose hash does not match).
// Idempotent: running it twice does not duplicate the links.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'dist/pytra-web/browser';
// Body text (Geist 400) and headings (Bricolage Grotesque 700) render on every first screen.
const FIRST_PAINT_FONTS = [/^geist-latin-400-normal-[\w-]+\.woff2$/, /^bricolage-grotesque-latin-700-normal-[\w-]+\.woff2$/];

const mediaFiles = readdirSync(join(OUT_DIR, 'media'));
const links = FIRST_PAINT_FONTS.map((pattern) => {
  const matches = mediaFiles.filter((file) => pattern.test(file));
  if (matches.length !== 1) {
    throw new Error(`preload-fonts: expected one file matching ${pattern}, found ${matches.length}`);
  }
  return `<link rel="preload" href="media/${matches[0]}" as="font" type="font/woff2" crossorigin>`;
});

const indexPath = join(OUT_DIR, 'index.html');
let html = readFileSync(indexPath, 'utf8').replace(/<link rel="preload" href="media\/[^"]+" as="font"[^>]*>/g, '');
html = html.replace('</head>', `${links.join('')}</head>`);
writeFileSync(indexPath, html);

const ngswPath = join(OUT_DIR, 'ngsw.json');
if (existsSync(ngswPath)) {
  const manifest = JSON.parse(readFileSync(ngswPath, 'utf8'));
  manifest.hashTable['/index.html'] = createHash('sha1').update(html).digest('hex');
  writeFileSync(ngswPath, JSON.stringify(manifest, null, 2));
}

console.log(`preload-fonts: ${links.length} font preloads added to ${indexPath}`);

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = join(root, 'docs');
execFileSync(process.execPath, ['docs/colvmn/static-gen.js', 'docs'], {
  cwd: root,
  stdio: 'inherit',
});

// Safari may deny sibling-folder resources when opening a local HTML file.
// Embed the upstream stylesheet at build time; never hand-edit generated pages
// or maintain a second copy of colvmn's CSS. Keep the upstream checkout intact.
const css = await readFile(join(docs, 'colvmn/style.css'), 'utf8');
if (/<\/style/i.test(css) || /@import\b|url\s*\(/i.test(css)) {
  throw new Error('Embedded colvmn CSS needs review: external assets or closing style tag.');
}
const style = `<style id="tron-docs-style">\n${css}\n</style>`;
let count = 0;
async function embedStyles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = new Set(entries.map(entry => entry.name));
  if (names.has('index.html') && (names.has('_index.md') || names.has('_index.json'))) {
    const path = join(directory, 'index.html');
    let html = await readFile(path, 'utf8');
    html = html.replace(/<style\b[^>]*\bid="tron-docs-style"[^>]*>[\s\S]*?<\/style>\s*/gi, '');
    html = html.replace(/<link\b[^>]*\bhref="[^"]*colvmn\/style\.css"[^>]*>\s*/gi, '');
    if (!/<\/head>/i.test(html)) throw new Error(`Missing head in ${path}`);
    html = html.replace(/<\/head>/i, () => `${style}\n</head>`);
    await writeFile(path, html);
    count++;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && resolve(directory, entry.name) !== join(docs, 'colvmn')) {
      await embedStyles(join(directory, entry.name));
    }
  }
}
await embedStyles(docs);
console.log(`Embedded colvmn stylesheet in ${count} generated documentation pages.`);

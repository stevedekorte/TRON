import {readdir, readFile, writeFile} from 'node:fs/promises';
import {loadEnv} from 'vite';
import {createHash} from 'node:crypto';
async function walk(dir) {
  const entries = await readdir(`dist/${dir}`, {withFileTypes: true});
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : `${dir}/${e.name}`))).flat();
}
const env=loadEnv('production',process.cwd(),'VITE_');
await writeFile('dist/bit/config.js',`window.BIT_API_BASE = ${JSON.stringify(process.env.VITE_JEV_API_BASE || env.VITE_JEV_API_BASE || '')};\n`);
const files = ['index.html', 'manifest.webmanifest', ...(await Promise.all(['assets','audio','fonts','images','icons','bit'].map(walk))).flat()].sort();
const template = await readFile('src/pwa/sw.js', 'utf8');
const hash = createHash('sha256').update(template);
let bytes = 0;
for (const file of files) { const data = await readFile(`dist/${file}`); hash.update(file).update(data); bytes += data.length; }
const urls = files.map(file => file.split('/').map(encodeURIComponent).join('/'));
await writeFile('dist/sw.js', template.replace('__REVISION__', hash.digest('hex').slice(0,16)).replace('__PRECACHE__', JSON.stringify(urls)));
console.log(`PWA: ${files.length} local files, ${(bytes/1024/1024).toFixed(1)} MiB offline cache.`);

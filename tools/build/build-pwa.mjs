import {readdir, readFile, writeFile} from 'node:fs/promises';
import {loadEnv} from 'vite';
import {createHash} from 'node:crypto';
async function walk(dir) {
  const entries = await readdir(`dist/${dir}`, {withFileTypes: true});
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : `${dir}/${e.name}`))).flat();
}
const env=loadEnv('production',process.cwd(),'VITE_');
await writeFile('dist/bit/config.js',`window.BIT_API_BASE = ${JSON.stringify(process.env.VITE_JEV_API_BASE || env.VITE_JEV_API_BASE || '')};\n`);
const media=JSON.parse(await readFile('dist/asset-manifest.json','utf8'));
const files = ['asset-manifest.json','index.html', 'mcp.html', 'manifest.webmanifest', ...(await Promise.all(['assets','bit'].map(walk))).flat()].filter(file=>!media[file]&&!file.includes('ort-wasm-')&&!file.startsWith('assets/source/')&&!file.split('/').some(part=>part.startsWith('.'))).sort();
const template = await readFile('src/pwa/sw.js', 'utf8');
const hash = createHash('sha256').update(template);
let bytes = 0;const hashes={};
for (const file of files) { const data = await readFile(`dist/${file}`); hash.update(file).update(data);hashes[file.split('/').map(encodeURIComponent).join('/')]=createHash('sha256').update(data).digest('hex'); bytes += data.length; }
const urls = files.map(file => file.split('/').map(encodeURIComponent).join('/'));
const aliases={...media,...Object.fromEntries(Object.entries(JSON.parse(await readFile('assets/path-map.json','utf8'))).filter(([old])=>old.startsWith('public/')).map(([old,current])=>[old.slice(7),media[current.slice(7)]??current.slice(7)]))};
hash.update(JSON.stringify(aliases));
await writeFile('dist/sw.js',template.replace('__ASSET_ALIASES__',JSON.stringify(aliases)).replace('__ASSET_HASHES__',JSON.stringify(hashes)).replace('__REVISION__',hash.digest('hex').slice(0,16)).replace('__PRECACHE__',JSON.stringify(urls)));

console.log(`PWA: ${files.length} local files, ${(bytes/1024/1024).toFixed(1)} MiB offline cache.`);

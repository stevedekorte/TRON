import {readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const catalog=JSON.parse(await readFile('assets/catalog.json','utf8'));
const byHash=new Map();for(const asset of catalog.assets){const group=byHash.get(asset.sha256)??[];group.push(asset);byHash.set(asset.sha256,group);}
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())await walk(path);else files.push(path);}}
await walk('dist');
const output=[];
for(const file of files){
 const path=file.slice(5),data=await readFile(file),sha256=createHash('sha256').update(data).digest('hex');
 if(/\.(?:mp4|m4v|mov|dae|uasset|umap|blend|psd)$/i.test(path))throw Error('Source/reference master leaked into production: '+path);
 if(path.startsWith('credentials/')||path.startsWith('.local/'))throw Error('Private directory leaked: '+path);
 const sources=byHash.get(sha256);
 if(!sources&&!path.endsWith('/LICENSE')&&!/\.(?:html|js|css|map|md|txt|json|xml|webmanifest|svg|wasm)$/i.test(path))throw Error('Uncatalogued shipped binary: '+path);
 output.push({path,bytes:data.length,sha256,assetIds:sources?.map(s=>s.id)??[],sourcePaths:sources?.map(s=>s.path)??[path.startsWith('docs/')?path:'package-lock.json'],creditIds:sources?.map(s=>s.creditId)??['project'],generated:!sources});
}
const aliases=JSON.parse(await readFile('assets/path-map.json','utf8'));
for(const [old,current] of Object.entries(aliases))if(old.startsWith('public/')||current.startsWith('assets/runtime/')){
 const deployed='dist/'+(old.startsWith('public/')?old.slice(7):old);
 const a=await readFile(deployed),b=await readFile(current);if(!a.equals(b))throw Error('Compatibility asset differs: '+old);
}
const report={files:output.length,bytes:output.reduce((n,f)=>n+f.bytes,0),assets:output};
await writeFile('test-results/asset-build.json',JSON.stringify(report,null,2)+'\n');
console.log(`Asset build audit: ${report.files} files, ${(report.bytes/1024/1024).toFixed(1)} MiB; all shipped binaries catalogued, aliases identical, no reference footage/editable masters.`);

import {cp,mkdir,readFile,readdir,stat} from 'node:fs/promises';
import {dirname,resolve,relative,extname} from 'node:path';
const paths=JSON.parse(await readFile('assets/path-map.json','utf8'));
const pages=[];
async function visit(dir){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(e.name==='colvmn')continue;
  const p=dir+'/'+e.name;
  if(e.isDirectory())await visit(p);
  else if(['_index.md','index.html'].includes(e.name)||dir==='docs'&&/\.(txt|xml)$/.test(e.name)||dir==='docs/references/mazes'&&extname(p)==='.svg')pages.push(p);
 }
}
await visit('docs');
async function copy(source,output){await mkdir(dirname(output),{recursive:true});await cp(source,output);}
for(const page of pages)await copy(page,'dist/'+page);
// Only images/licenses explicitly linked by authored pages accompany the docs.
// Never recursively copy reference collections, editable models or raw footage.
for(const page of pages.filter(p=>p.endsWith('.md'))){
 const text=await readFile(page,'utf8');
 for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
  const link=match[1].split('#')[0];if(!link||/^(?:https?:|mailto:|#)/.test(link))continue;
  const target=relative(process.cwd(),resolve(dirname(page),decodeURIComponent(link)));
  if(target.startsWith('..')||!['.png','.jpg','.jpeg','.svg','.txt','.json','.mp3','.wav'].includes(extname(target).toLowerCase()))continue;
  const source=paths[target]??target;
  try{if((await stat(source)).isFile())await copy(source,'dist/'+target);}catch{}
 }
}
for(const name of ['style.css','layout/bundle.js','LICENSE'])await copy('docs/colvmn/'+name,'dist/docs/colvmn/'+name);
await copy('node_modules/three/LICENSE','dist/THREE-LICENSE.txt');
for(const name of ['Goal.md','AGENTS.md'])await copy(name,'dist/'+name);
console.log(`Copied ${pages.length} documentation files and explicitly linked illustrations; source collections excluded.`);

await copy('assets/source/models/povray-lightcycle/LICENSE','dist/docs/models/povray-lightcycle/LICENSE');

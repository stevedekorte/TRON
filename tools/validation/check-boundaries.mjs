import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
export async function checkBoundaries(){
 const root=process.cwd(),seen=new Set();
 async function visit(path){
  path=resolve(path);if(seen.has(path))return;seen.add(path);
  const name=relative(root,path);if(!name.startsWith('shared/'))throw Error('Headless authority imports outside shared/: '+name);
  const source=await readFile(path,'utf8');
  if(/\b(?:window|document|navigator|WebGLRenderer)\s*[.(]/.test(source))throw Error('Browser dependency in '+name);
  for(const m of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
   if(m[1].startsWith('.'))await visit(resolve(dirname(path),m[1]));
   else throw Error('Unexpected headless dependency '+m[1]+' in '+name);
  }
 }
 await visit('shared/multiplayer/hub.js');
 return {modules:seen.size};
}
if(process.argv[1]?.endsWith('check-boundaries.mjs'))console.log('Headless boundary:',await checkBoundaries());

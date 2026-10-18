import {readFileSync,readdirSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
const media=/\.(?:wav|mp3|ogg|m4a|glb|obj|png|jpe?g|webp|svg|ttf|otf|woff2?|wasm)$/i;
function files(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(root+'/'+e.name):[root+'/'+e.name]).sort();}
export function publicAssetPlugin(){
 let production=false,map={},assetDir='assets',outDir='dist';
 const virtual='virtual:tron-public-assets',resolved='\0'+virtual;
 return {
  name:'tron-content-addressed-public-assets',
  config(){return {experimental:{renderBuiltUrl(filename,{hostId,hostType,type}){
   if(type!=='public'||!map[filename])return;
   const relative=posix.relative(hostType==='css'?assetDir:posix.dirname(hostId),map[filename]);
   return hostType==='js'?{runtime:`new URL(${JSON.stringify(relative)}, import.meta.url).href`}:relative;
  }}};},
  configResolved(config){production=config.command==='build';assetDir=config.build.assetsDir;outDir=config.build.outDir;},
  buildStart(){
   if(!production)return;
   map={};
   for(const file of files('public').filter(p=>media.test(p))){
    const source=readFileSync(file),path=file.slice(7),extension=posix.extname(path);
    const hash=createHash('sha256').update(source).digest('hex').slice(0,16);
    const output=path.slice(0,-extension.length)+'-'+hash+extension;
    map[path]=output;this.emitFile({type:'asset',fileName:output,source});
   }
  },
  resolveId(id){if(id===virtual)return resolved;},
  load(id){if(id===resolved)return `export default ${JSON.stringify(map)};`;},
  transformIndexHtml:{order:'post',handler(html){
   for(const [old,current] of Object.entries(map))html=html.replaceAll(old,current);
   return html;
  }},
  async closeBundle(){
   if(!production)return;
   // Only rewrite copied public documents/scripts, never Vite's already-hashed chunks.
   const substitutions=Object.entries(map).flatMap(([old,current])=>[[old,current],...(old.startsWith('bit/')?[[old.slice(4),current.slice(4)]]:[])]).sort((a,b)=>b[0].length-a[0].length);
   for(const file of files('public').filter(p=>/\.(?:html|js|css|webmanifest)$/.test(p))){
    const output=outDir+'/'+file.slice(7);let text=await readFile(output,'utf8');
    for(const [old,current] of substitutions)text=text.replaceAll(old,current);
    await writeFile(output,text);
   }
   await writeFile(outDir+'/asset-manifest.json',JSON.stringify(map,null,2)+'\n');
  },
 };
}

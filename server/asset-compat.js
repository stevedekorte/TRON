import {readFileSync} from 'node:fs';
const paths=JSON.parse(readFileSync(new URL('../assets/path-map.json',import.meta.url),'utf8'));
// Development-only aliases. Production equivalents are emitted by the build.
export function assetCompatibilityPlugin(){
 return {name:'asset-compatibility',configureServer(server){
  server.middlewares.use((req,res,next)=>{
   try{
    const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname.slice(1));
    const target=paths[path]??paths['public/'+path];
    if(target)req.url='/'+target.replace(/^public\//,'').split('/').map(encodeURIComponent).join('/')+url.search;
   }catch{}
   next();
  });
 }};
}

import {readFileSync} from 'node:fs';
export function recoveryPlugin(){
 let production=false;
 return {
  name:'tron-inline-recovery',
  configResolved(config){production=config.command==='build';},
  transformIndexHtml(html,context){
   if(!context.filename?.endsWith('/index.html'))return html;
   const source=readFileSync(new URL('../../src/pwa/recover.js',import.meta.url),'utf8').replace('__TRON_PRODUCTION__',String(production));
   return [{tag:'script',children:source,injectTo:'head-prepend'}];
  },
 };
}

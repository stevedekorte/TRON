import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
const template=readFileSync(new URL('../../src/pwa/sw.js',import.meta.url),'utf8');
const scope='https://example.test/fun/TRON/';
const hash=s=>createHash('sha256').update(s).digest('hex');
function harness(){
 const stores=new Map(),downloads=[];
 const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{
  if(!stores.has(name)){
   const data=new Map();stores.set(name,{match:async key=>data.get(String(key))?.clone(),put:async(key,response)=>data.set(String(key),response.clone()),add:async request=>{downloads.push(request.url);const body=network.get(request.url);if(body===undefined)throw Error('404');data.set(request.url,new Response(body));}});
  }return stores.get(name);
 }};
 const network=new Map();
 function worker(revision,files,aliases={}){
  for(const [path,body] of Object.entries(files))network.set(scope+path,body);
  const events={};const self={registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>events[name]=fn};
  vm.runInNewContext(template.replace('__REVISION__',revision).replace('__PRECACHE__',JSON.stringify(Object.keys(files))).replace('__ASSET_HASHES__',JSON.stringify(Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)])))).replace('__ASSET_ALIASES__',JSON.stringify(aliases)),{self,caches,URL,Request,Response,Headers,crypto:webcrypto,Uint8Array,fetch:async request=>{downloads.push(request.url);return new Response(network.get(request.url)??'',{status:network.has(request.url)?200:404});}});
  return {run:async name=>{let done;events[name]({waitUntil:p=>done=p});await done;},fetch:async(path,headers)=>{let response;events.fetch({request:new Request(scope+path,{headers}),respondWith:p=>response=p});return response;}};
 }
 return {worker,caches,downloads,stores};
}
test('code-only release downloads changed code, reuses unchanged media and cleans the old cache only on activation',async()=>{
 const h=harness(),first=h.worker('one',{'index.html':'first','assets/tank-123.wav':'audio'});
 await first.run('install');await first.run('activate');h.downloads.length=0;
 const second=h.worker('two',{'index.html':'second','assets/tank-123.wav':'audio'});
 await second.run('install');assert.deepEqual(h.downloads,[scope+'index.html']);assert.equal(h.stores.size,2);
 await second.run('activate');assert.equal(h.stores.size,1);assert.equal(await (await second.fetch('assets/tank-123.wav')).text(),'audio');
});
test('changed media gets a new URL and must download',async()=>{
 const h=harness();await h.worker('one',{'assets/tank-old.wav':'old'}).run('install');h.downloads.length=0;
 await h.worker('two',{'assets/tank-new.wav':'new'}).run('install');assert.deepEqual(h.downloads,[scope+'assets/tank-new.wav']);
});
test('legacy cache without hash metadata migrates matching bytes but never reuses changed bytes',async()=>{
 const h=harness(),old=await h.caches.open('tron-game:'+scope+':legacy');
 await old.put(scope+'audio/tank.wav',new Response('same'));await old.put(scope+'audio/cannon.wav',new Response('outdated'));
 const worker=h.worker('current',{'assets/tank-hash.wav':'same','assets/cannon-hash.wav':'new'},{'audio/tank.wav':'assets/tank-hash.wav','audio/cannon.wav':'assets/cannon-hash.wav'});
 await worker.run('install');assert.deepEqual(h.downloads,[scope+'assets/cannon-hash.wav']);
});
test('versioned legacy audio resolves offline to one hashed copy and supports ranges without intercepting APIs',async()=>{
 const h=harness(),worker=h.worker('one',{'assets/tank-hash.wav':'0123456789'},{'audio/tank.wav':'assets/tank-hash.wav'});
 await worker.run('install');h.downloads.length=0;
 const response=await worker.fetch('audio/tank.wav?v=5',{Range:'bytes=2-5'});
 assert.equal(response.status,206);assert.equal(await response.text(),'2345');assert.deepEqual(h.downloads,[]);
 assert.equal(await worker.fetch('api/multiplayer?v=2'),undefined);
 assert.equal(await worker.fetch('assets/tank-hash.wav?other=1'),undefined);
});
test('failed new cache installation preserves the working release',async()=>{
 const h=harness();await h.worker('one',{'index.html':'good'}).run('install');
 const worker=h.worker('two',{'index.html':'new'});const original=h.caches.open;
 h.caches.open=async name=>{const cache=await original(name);if(name.endsWith(':two'))cache.add=async()=>{throw Error('offline');};return cache;};
 await assert.rejects(worker.run('install'),/offline/);assert.deepEqual([...h.stores.keys()],['tron-game:'+scope+':one']);
});

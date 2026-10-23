// Build substitutes a content revision and the complete local game asset list.
const PREFIX = `tron-game:${self.registration.scope}:`;
const CACHE = PREFIX + '__REVISION__';
const URLS = __PRECACHE__.map(path => new URL(path, self.registration.scope).href);
const ASSETS = new Set(URLS);
const HASHES = Object.fromEntries(Object.entries(__ASSET_HASHES__).map(([path,hash])=>[new URL(path,self.registration.scope).href,hash]));
const METADATA = new URL('.cache-asset-hashes.json',self.registration.scope).href;
const ALIASES = new Map(Object.entries(__ASSET_ALIASES__).map(([old,current])=>[new URL(old,self.registration.scope).href,new URL(current,self.registration.scope).href]));
self.addEventListener('install', event => {
  // Activate after existing tabs close, or when the explicit update page requests it.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const previous=[];
      for(const name of await caches.keys())if(name.startsWith(PREFIX)){
        const old=await caches.open(name),metadata=await old.match(METADATA);
        if(name!==CACHE||metadata)previous.push({cache:old,hashes:metadata?await metadata.json():null});
      }
      async function install(url){
        const candidates=[url,...[...ALIASES].filter(([,current])=>current===url).map(([old])=>old)];
        for(const old of previous)for(const candidate of candidates){
          if(old.hashes&&old.hashes[candidate]!==HASHES[url])continue;
          const response=await old.cache.match(candidate);if(!response)continue;
          // One-time migration from older workers without per-file metadata.
          const digest=old.hashes?HASHES[url]:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
          if(digest===HASHES[url]){await cache.put(url,response);return;}
        }
        await cache.add(new Request(url,{cache:'reload'}));
      }
      // Limit concurrent downloads, including models and audio.
      let next = 0;
      await Promise.all(Array.from({length: 4}, async () => {
        while (next < URLS.length) await install(URLS[next++]);
      }));
      await cache.put(METADATA,new Response(JSON.stringify(HASHES),{headers:{'Content-Type':'application/json'}}));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
async function cachedResponse(request, key) {
  const cache = await caches.open(CACHE);
  const response = await cache.match(key);
  if (!response) return fetch(request);
  // HTMLAudioElement may request byte ranges even for an offline cached track.
  const range = request.headers.get('range');
  if (!range) return response;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return fetch(request);
  const bytes = await response.arrayBuffer(), size = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (start > end || start >= size) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(bytes.slice(start, end + 1), {status: 206, headers});
}
async function entryResponse(request, key) {
  // A fresh navigation should discover the current build instead of remaining
  // pinned to cached HTML. Keep the installed build as an offline fallback.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  try {
    const response=await fetch(new Request(request,{cache:'no-cache',signal:controller.signal}));
    if(response.ok&&response.headers.get('content-type')?.includes('text/html'))return response;
  } catch {}
  finally {clearTimeout(timer);}
  return cachedResponse(request,key);
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const root = new URL(self.registration.scope);
  // Query flags select game modes; they still use the same entry document.
  const entry = request.mode === 'navigate' && (url.pathname === root.pathname || url.pathname === root.pathname + 'index.html');
  // Old audio callers used ?v=N. Resolve those only for known static assets.
  const lookup=new URL(url);if([...lookup.searchParams.keys()].every(key=>key==='v'))lookup.search='';
  const candidate=ALIASES.get(lookup.href)??lookup.href;
  const key = entry ? new URL('index.html', root).href : ASSETS.has(candidate)?candidate:url.href;
  if (ASSETS.has(key)) event.respondWith(entry?entryResponse(request,key):cachedResponse(request, key));
  // Unlisted URLs (including API calls and docs) remain network requests.
});

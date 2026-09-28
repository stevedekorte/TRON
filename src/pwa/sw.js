// Build substitutes a content revision and the complete local game asset list.
const PREFIX = `tron-game:${self.registration.scope}:`;
const CACHE = PREFIX + '__REVISION__';
const URLS = __PRECACHE__.map(path => new URL(path, self.registration.scope).href);
const ASSETS = new Set(URLS);
self.addEventListener('install', event => {
  // Do not skipWaiting: a running game retains its matching code and assets.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Limit concurrent downloads, including models and audio.
      let next = 0;
      await Promise.all(Array.from({length: 4}, async () => {
        while (next < URLS.length) await cache.add(new Request(URLS[next++], {cache: 'reload'}));
      }));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
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
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const root = new URL(self.registration.scope);
  // Query flags select game modes; they still use the same entry document.
  const entry = request.mode === 'navigate' && (url.pathname === root.pathname || url.pathname === root.pathname + 'index.html');
  const key = entry ? new URL('index.html', root).href : url.href;
  if (ASSETS.has(key)) event.respondWith(cachedResponse(request, key));
  // Unlisted URLs (including API calls and docs) remain network requests.
});

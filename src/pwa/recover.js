// Inlined before the entry module: recovery must work even if that module is gone.
(() => {
  if (!__TRON_PRODUCTION__) return;
  const root = new URL('./', location.href);
  const retryParam = '__tron_recover';
  const guardKey = `tron-recovery:${root.href}`;
  const cooldownMs = 10 * 60 * 1000;
  const moduleFailure = /importing a module script failed|failed to fetch dynamically imported module|failed to load module script|loading chunk|module script|preload.*(?:css|module)/i;
  let recovering = false;
  function status(text) {
    const loading = document.querySelector('#loading');
    if (loading) loading.hidden = false;
    const line = document.querySelector('#boot-status');
    if (line) line.textContent = text;
  }
  window.tronRecoverModuleFailure = error => {
    if (!moduleFailure.test(String(error?.message || error))) return false;
    if (recovering) return true;
    let attempted = new URL(location.href).searchParams.has(retryParam);
    try { attempted ||= Date.now() - Number(sessionStorage.getItem(guardKey) || 0) < cooldownMs; } catch {}
    if (attempted || navigator.onLine === false) {
      status('PROGRAM FILES COULD NOT LOAD. CHECK YOUR CONNECTION AND RELOAD.');
      return false;
    }
    recovering = true;
    try { sessionStorage.setItem(guardKey, String(Date.now())); } catch {}
    status('REFRESHING PROGRAM FILES');
    void (async () => {
      let timer;
      const controller=new AbortController();
      try {
        await Promise.race([
          (async () => {
            // Wi-Fi connectivity does not prove the host is reachable. Confirm
            // fresh HTML is available before discarding any usable offline code.
            const probe=new URL('index.html',root);
            probe.searchParams.set('__tron_probe',String(Date.now()));
            const response=await fetch(probe,{cache:'no-store',signal:controller.signal});
            if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Current program is unavailable');
            if(!recovering)return;
            // Only this game's exact worker scope and code cache. Keep downloaded
            // models/audio, IndexedDB data, settings, and other apps untouched.
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                if(!recovering)return;
                if (registration.scope === root.href && !await registration.unregister()) throw Error('Could not release stale worker');
              }
            }
            if ('caches' in window) {
              for (const name of await caches.keys()) {
                if(!recovering)return;
                if (!name.startsWith(`tron-game:${root.href}:`)) continue;
                const cache = await caches.open(name);
                for (const request of await cache.keys()) {
                  if(!recovering)return;
                  const url = new URL(request.url);
                  if (url.href.startsWith(root.href) && /(?:\.(?:html|js|css)$|\/$)/i.test(url.pathname)) await cache.delete(request);
                }
              }
            }
          })(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Recovery timed out')), 8000); }),
        ]);
        const next = new URL(location.href);
        next.searchParams.set(retryParam, String(Date.now()));
        location.replace(next.href);
      } catch (error) {
        recovering = false;
        console.warn('Program recovery failed:', error);
        status('PROGRAM FILES COULD NOT LOAD. CHECK YOUR CONNECTION AND RELOAD.');
      } finally { clearTimeout(timer);controller.abort(); }
    })();
    return true;
  };
  addEventListener('unhandledrejection', event => window.tronRecoverModuleFailure(event.reason));
  addEventListener('vite:preloadError', event => window.tronRecoverModuleFailure(event.payload));
  addEventListener('error', event => {
    const target = event.target;
    const source = target?.tagName === 'SCRIPT' ? target.src : target?.tagName === 'LINK' && ['stylesheet', 'modulepreload'].includes(target.rel) ? target.href : null;
    if (source && new URL(source).href.startsWith(root.href)) window.tronRecoverModuleFailure('Failed to load module script');
  }, true);
  addEventListener('tron:ready', () => {
    // Keep the session guard, but return the address bar to the ordinary URL.
    try {
      if (!sessionStorage.getItem(guardKey)) return;
      const url = new URL(location.href);
      if (url.searchParams.has(retryParam)) { url.searchParams.delete(retryParam); history.replaceState(history.state, '', url.href); }
    } catch {}
  }, {once:true});
})();

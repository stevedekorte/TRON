// Production only: development reloads should never use an offline app cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}sw.js`, {scope: import.meta.env.BASE_URL, updateViaCache: 'none'},
  ).catch(error => console.warn('Offline installation unavailable:', error));
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, {once: true});
}

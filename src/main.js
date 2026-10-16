import {isMobileTerminal} from './ui/mobile-terminal.js';
import './pwa/launch.js';
performance.mark('tron:entry');
if(isMobileTerminal())document.body.classList.add('mobile-terminal');
{
  await import('./ui/style.css');
  await import('./pwa/register.js');
  // Let the static loading terminal paint before synchronous world construction.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  performance.mark('tron:module-request');
  const {createGameApp}=await import('./app/game-app.js');
  performance.mark('tron:module-ready');
  const app=await createGameApp();
  if(import.meta.hot)import.meta.hot.dispose(app.dispose);
}

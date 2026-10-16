import {isMobileTerminal} from './ui/mobile-terminal.js';
import './pwa/launch.js';
if(isMobileTerminal())document.body.classList.add('mobile-terminal');
{
  await import('./ui/style.css');
  await import('./pwa/register.js');
  // Let the static loading terminal paint before synchronous world construction.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const {createGameApp}=await import('./app/game-app.js');
  const app=await createGameApp();
  if(import.meta.hot)import.meta.hot.dispose(app.dispose);
}

import {isMobileTerminal,showMobileTerminal} from './ui/mobile-terminal.js';
if(isMobileTerminal()){
  showMobileTerminal();
}else{
  await import('./pwa/register.js');
  // Let the static loading terminal paint before synchronous world construction.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const {createGameApp}=await import('./app/game-app.js');
  const app=createGameApp();
  if(import.meta.hot)import.meta.hot.dispose(app.dispose);
}

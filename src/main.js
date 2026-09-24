import { createGameApp } from './app/game-app.js';
// Let the static loading terminal paint before synchronous world construction.
await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const app = createGameApp();
if (import.meta.hot) import.meta.hot.dispose(app.dispose);

import { createGameApp } from './app/game-app.js';
const app = createGameApp();
if (import.meta.hot) import.meta.hot.dispose(app.dispose);

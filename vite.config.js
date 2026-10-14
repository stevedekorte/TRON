import {multiplayerPlugin} from './server/multiplayer.js';
import {defineConfig,loadEnv} from 'vite';
import {jevPlugin} from './server/jev.js';
import {mcpPlugin} from './server/mcp.js';
// Keep play sessions intact while files change; refresh explicitly to try edits.
const liveReload=process.env.TRON_HMR==='1';
export default defineConfig(({mode})=>({plugins:[multiplayerPlugin(),jevPlugin(loadEnv(mode,process.cwd(),'')),mcpPlugin(loadEnv(mode,process.cwd(),''))],base:'./',server:{hmr:liveReload,fs:{deny:['**/.git/**','**/.env','**/.env.*','**/credentials/**','**/.dev.vars*','**/.wrangler/**','**/*.{crt,pem}']}},build:{rollupOptions:{input:{game:'index.html',mcp:'mcp.html',audio:'audio.html',carrier:'carrier.html',shuttle:'shuttle.html',raycastCycle:'raycast-cycle.html'}}}}));

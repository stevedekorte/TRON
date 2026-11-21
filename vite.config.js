import {sceneStudioPlugin} from './server/scene-studio.js';
import {wallStudioPlugin} from './server/wall-studio.js';
import {recoveryPlugin} from './tools/build/recovery.js';
import {publicAssetPlugin} from './tools/build/public-assets.js';
import {assetCompatibilityPlugin} from './server/asset-compat.js';
import {multiplayerPlugin} from './server/multiplayer.js';
import {defineConfig,loadEnv} from 'vite';
import {jevPlugin} from './server/jev.js';
import {mcpPlugin} from './server/mcp.js';
import {execSync} from 'node:child_process';
// Error reports name the build. CI or a clean export may set VITE_BUILD_ID instead.
if(!process.env.VITE_BUILD_ID){try{process.env.VITE_BUILD_ID=execSync('git rev-parse --short HEAD',{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{}}
// Keep play sessions intact while files change; refresh explicitly to try edits.
const liveReload=process.env.TRON_HMR==='1';
export default defineConfig(({mode})=>({plugins:[wallStudioPlugin(),sceneStudioPlugin(),recoveryPlugin(),publicAssetPlugin(),assetCompatibilityPlugin(),multiplayerPlugin(),jevPlugin(loadEnv(mode,process.cwd(),'')),mcpPlugin(loadEnv(mode,process.cwd(),''))],base:'./',server:{hmr:liveReload,fs:{deny:['**/.local/**','**/.git/**','**/.env','**/.env.*','**/credentials/**','**/.dev.vars*','**/.wrangler/**','**/*.{crt,pem}']}},build:{rollupOptions:{preserveEntrySignatures:'strict',output:{entryFileNames:chunk=>chunk.name==='bitPlay'?'src/analytics/bit-play.js':'assets/[name]-[hash].js'},input:{bitPlay:'src/analytics/bit-play.js',game:'index.html',mcp:'mcp.html',audio:'audio.html',carrier:'carrier.html',raycastCycle:'raycast-cycle.html'}}}}));

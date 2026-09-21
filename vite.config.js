import {defineConfig,loadEnv} from 'vite';
import {jevPlugin} from './server/jev.js';
// Keep play sessions intact while files change; refresh explicitly to try edits.
const liveReload=process.env.TRON_HMR==='1';
export default defineConfig(({mode})=>({plugins:[jevPlugin(loadEnv(mode,process.cwd(),''))],base:'./',server:{hmr:liveReload,fs:{deny:['**/.git/**','**/.env','**/.env.*','**/credentials/**','**/.dev.vars*','**/.wrangler/**','**/*.{crt,pem}']}},build:{rollupOptions:{input:{game:'index.html',audio:'audio.html',carrier:'carrier.html',shuttle:'shuttle.html'}}}}));

import {defineConfig} from 'vite';
// Keep play sessions intact while files change; refresh explicitly to try edits.
const liveReload=process.env.TRON_HMR==='1';
export default defineConfig({base:'./',server:{hmr:liveReload},build:{rollupOptions:{input:{game:'index.html',audio:'audio.html',carrier:'carrier.html',shuttle:'shuttle.html'}}}});

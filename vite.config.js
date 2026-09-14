import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{rollupOptions:{input:{game:'index.html',audio:'audio.html',carrier:'carrier.html'}}}});

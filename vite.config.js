import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The SPA builds to public/spa with stable (unhashed) filenames so the committed
// static shell (public/app.html) can reference /spa/app.js directly — no Blade,
// no manifest lookup, no server-side rendering. Styling comes from the central
// CSS in public/css, linked by the shell. `root` points at the SPA source so
// `vite` (dev) serves resources/spa/index.html.
export default defineConfig({
    plugins: [vue()],
    root: 'resources/spa',
    build: {
        outDir: '../../public/spa',
        emptyOutDir: true,
        rollupOptions: {
            input: fileURLToPath(new URL('./resources/spa/main.js', import.meta.url)),
            output: {
                entryFileNames: 'app.js',
                chunkFileNames: 'app-[name].js',
                assetFileNames: 'app.[ext]',
            },
        },
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});

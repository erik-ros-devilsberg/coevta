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
        // Only the SPA has a vite dev server: it owns an index.html here in
        // resources. The three PWAs are client-side static bundles served from
        // one origin by the app on 8040 (/contacts/, /tasks/, /calendar/), so
        // they run `vite build --watch` instead — see the `dev` script in
        // composer.json. strictPort makes a clash fail loudly.
        port: 8041,
        strictPort: true,
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});

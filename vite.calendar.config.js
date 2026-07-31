import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Build config for the Calendar PWA. One config per app: each PWA is a separate
// installable application with its own service worker scope, so they build to
// their own directory under public/ and never share a bundle.
//
// Output uses stable (unhashed) filenames so the committed static shell
// (public/calendar/index.html) and the hand-written service worker precache list
// can reference /calendar/app.js directly — no Blade, no manifest lookup.
//
// emptyOutDir is off because the output directory also holds committed static
// files (the shell, manifest, icons and sw.js) that must survive a build.
export default defineConfig({
	plugins: [vue()],
	root: 'resources/pwa/calendar',
	build: {
		outDir: '../../../public/calendar',
		emptyOutDir: false,
		rollupOptions: {
			input: fileURLToPath(new URL('./resources/pwa/calendar/main.js', import.meta.url)),
			output: {
				entryFileNames: 'app.js',
				chunkFileNames: 'app-[name].js',
				assetFileNames: 'app.[ext]',
			},
		},
	},
});

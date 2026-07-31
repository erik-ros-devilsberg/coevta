import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Build config for the Contacts PWA. One config per app: each PWA is a separate
// installable application with its own service worker scope, so they build to
// their own directory under public/ and never share a bundle. Calendar and Tasks
// get their own config alongside this one when they follow.
//
// Output uses stable (unhashed) filenames so the committed static shell
// (public/contacts/index.html) and the hand-written service worker precache list
// can reference /contacts/app.js directly — no Blade, no manifest lookup.
//
// emptyOutDir is off because the output directory also holds committed static
// files (the shell, manifest, icons and sw.js) that must survive a build.
export default defineConfig({
	plugins: [vue()],
	root: 'resources/pwa/contacts',
	build: {
		outDir: '../../../public/contacts',
		emptyOutDir: false,
		rollupOptions: {
			input: fileURLToPath(new URL('./resources/pwa/contacts/main.js', import.meta.url)),
			output: {
				entryFileNames: 'app.js',
				chunkFileNames: 'app-[name].js',
				assetFileNames: 'app.[ext]',
			},
		},
	},
});

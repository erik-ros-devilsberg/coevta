import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Dedicated test config (kept separate from the per-app build configs, which set
// a custom root/output per bundle). jsdom gives the lib tests a localStorage and
// the component tests a DOM to mount into. The glob spans every frontend source
// tree: the shared libs, the legacy SPA, and each PWA under resources/pwa.
export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'jsdom',
        include: ['resources/**/*.test.js'],
    },
});

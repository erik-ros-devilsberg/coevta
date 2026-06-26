import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Dedicated test config (kept separate from the build's vite.config.js, which
// sets a custom root/output for the SPA bundle). jsdom gives the lib tests a
// localStorage and the component tests a DOM to mount into.
export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'jsdom',
        include: ['resources/spa/**/*.test.js'],
    },
});

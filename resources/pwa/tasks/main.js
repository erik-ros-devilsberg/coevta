import { createApp } from 'vue';

import App from './App.vue';
import router from './router.js';

createApp(App).use(router).mount('#app');

// Register the service worker that makes the app installable and openable with
// no network. It is a hand-written static file (public/tasks/sw.js) rather than
// a build artifact — the bundle uses stable, unhashed names, so the precache
// list can be written literally. Scope is pinned to /tasks/ so this app's cache
// cannot collide with the contacts app's.
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/tasks/sw.js', { scope: '/tasks/' }).catch(() => {
			// Registration failing (unsupported browser, blocked storage) costs
			// offline support but must never break the running app.
		});
	});
}

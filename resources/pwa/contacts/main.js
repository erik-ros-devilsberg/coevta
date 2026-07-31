import { createApp } from 'vue';

import App from './App.vue';
import router from './router.js';

createApp(App).use(router).mount('#app');

// Register the service worker that makes the app installable and openable with
// no network. It is a hand-written static file (public/contacts/sw.js) rather
// than a build artifact — the bundle uses stable, unhashed names, so the
// precache list can be written literally. Scope is pinned to /contacts/ so this
// app's cache cannot collide with the calendar and tasks apps that follow.
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/contacts/sw.js', { scope: '/contacts/' }).catch(() => {
			// Registration failing (unsupported browser, blocked storage) costs
			// offline support but must never break the running app.
		});
	});
}

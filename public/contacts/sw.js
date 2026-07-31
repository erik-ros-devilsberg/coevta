/* Service worker for the Contacts PWA.
 *
 * Hand-written rather than generated: the bundle uses stable, unhashed names, so
 * the precache list can be written literally and there is no build step or
 * manifest lookup to go wrong.
 *
 * Scope is /contacts/ — the directory this file sits in. That bounds which pages
 * this worker controls, and is why each app (contacts, and later calendar and
 * tasks) is self-contained under its own path with its own cache.
 *
 * MAINTENANCE: adding a shell asset means adding it to SHELL *and* bumping
 * CACHE. A stale name in SHELL fails the whole install (addAll is atomic).
 */

// Bump on any change to SHELL — the activate handler drops older versions.
const CACHE = 'coevta-contacts-v1';

const SHELL = [
	'/contacts/',
	'/contacts/app.js',
	'/contacts/manifest.webmanifest',
	'/contacts/icon.svg',
	'/contacts/icon-maskable.svg',
	// main.css only @imports the parts, so each one is its own request and has to
	// be precached too, or the app renders unstyled offline.
	'/css/main.css',
	'/css/tokens.css',
	'/css/base.css',
	'/css/layout.css',
	'/css/components.css',
	'/css/utilities.css',
];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	// Drop caches from previous versions so an update cannot leave stale assets
	// behind. Only this app's caches are touched — the other PWAs own theirs.
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key.startsWith('coevta-contacts-') && key !== CACHE).map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	if (request.method !== 'GET' || url.origin !== self.location.origin) {
		return;
	}

	// The API is never cached here. Contact data is owned by the offline data
	// layer (IndexedDB), which knows what is stale and what is pending sync — an
	// HTTP cache would only fight with it and serve confusing stale reads.
	if (url.pathname.startsWith('/api/')) {
		return;
	}

	// Any deep link inside the app resolves to the same shell; the client-side
	// router takes it from there. This is what lets /contacts/<id> open offline.
	if (request.mode === 'navigate') {
		event.respondWith(caches.match('/contacts/').then((cached) => cached ?? fetch(request)));
		return;
	}

	event.respondWith(
		caches.match(request).then(
			(cached) =>
				cached ??
				fetch(request).then((response) => {
					// Fill the cache opportunistically for same-origin assets we did
					// not precache, so a second visit works offline too.
					if (response.ok && response.type === 'basic') {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put(request, copy));
					}

					return response;
				}),
		),
	);
});

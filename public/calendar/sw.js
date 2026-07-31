/* Service worker for the Calendar PWA.
 *
 * Hand-written rather than generated: the bundle uses stable, unhashed names, so
 * the precache list can be written literally and there is no build step or
 * manifest lookup to go wrong.
 *
 * Scope is /calendar/ — the directory this file sits in. That bounds which pages
 * this worker controls, and is why each app (contacts, tasks, calendar) is
 * self-contained under its own path with its own cache.
 *
 * MAINTENANCE: adding a shell asset means adding it to SHELL *and* bumping
 * CACHE. A stale name in SHELL fails the whole install (addAll is atomic).
 * The /css files are shared with the other apps, so a change there means
 * bumping the cache version in every app's worker, not just this one.
 */

// Bump on any change to SHELL — the activate handler drops older versions.
const CACHE = 'coevta-calendar-v1';

const SHELL = [
	'/calendar/',
	'/calendar/app.js',
	'/calendar/manifest.webmanifest',
	'/calendar/icon.svg',
	'/calendar/icon-maskable.svg',
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
	// behind. Only this app's caches are touched — the other PWAs own theirs, and
	// deleting by a broader prefix would blow away their shells.
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key.startsWith('coevta-calendar-') && key !== CACHE).map((key) => caches.delete(key)),
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

	// The API is never cached here. Event data is owned by the offline data layer
	// (IndexedDB), which knows what is stale and what is pending sync — an HTTP
	// cache would only fight with it and serve confusing stale reads.
	if (url.pathname.startsWith('/api/')) {
		return;
	}

	// Any deep link inside the app resolves to the same shell; the client-side
	// router takes it from there. This is what lets /calendar/ open offline.
	if (request.mode === 'navigate') {
		event.respondWith(caches.match('/calendar/').then((cached) => cached ?? fetch(request)));
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

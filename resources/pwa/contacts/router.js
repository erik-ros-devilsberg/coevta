import { createRouter, createWebHistory } from 'vue-router';

import ContactsListView from './views/ContactsListView.vue';
import ContactDetailView from './views/ContactDetailView.vue';
import ContactFormView from './views/ContactFormView.vue';
import ContactsLoginView from './views/ContactsLoginView.vue';
import { isAuthenticated } from '../../shared/lib/auth.js';

// History mode based at /contacts/ — every route here lives inside the service
// worker's scope. That is deliberate: a navigation outside the scope would drop
// an installed app back into a browser tab, so login lives here too rather than
// being shared with the legacy SPA at /login.
export const BASE = '/contacts/';

const routes = [
	{ path: '/login', component: ContactsLoginView },
	{ path: '/', component: ContactsListView, meta: { requiresAuth: true } },
	{ path: '/new', component: ContactFormView, meta: { requiresAuth: true } },
	{ path: '/:id', component: ContactDetailView, meta: { requiresAuth: true } },
	{ path: '/:id/edit', component: ContactFormView, meta: { requiresAuth: true } },
	{ path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
	history: createWebHistory(BASE),
	routes,
});

// Client-side guard: protected views bounce to the in-scope login when there is
// no token. The server never redirects — it just serves the shell.
router.beforeEach((to) => {
	if (to.meta.requiresAuth && !isAuthenticated()) {
		return '/login';
	}

	return true;
});

export default router;

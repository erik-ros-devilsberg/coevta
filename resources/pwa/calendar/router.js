import { createRouter, createWebHistory } from 'vue-router';

import CalendarMonthView from './views/CalendarMonthView.vue';
import CalendarLoginView from './views/CalendarLoginView.vue';
import { isAuthenticated } from '../../shared/lib/auth.js';

// History mode based at /calendar/ — every route here lives inside the service
// worker's scope. That is deliberate: a navigation outside the scope would drop
// an installed app back into a browser tab, so login lives here too rather than
// being shared with the other apps.
export const BASE = '/calendar/';

// The grid is the whole app: creating, editing and deleting all happen in a
// modal over it, so there is no detail or form route to deep-link to.
const routes = [
	{ path: '/login', component: CalendarLoginView },
	{ path: '/', component: CalendarMonthView, meta: { requiresAuth: true } },
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

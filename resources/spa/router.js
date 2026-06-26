import { createRouter, createWebHistory } from 'vue-router';

import LoginView from './views/LoginView.vue';
import DashboardView from './views/DashboardView.vue';
import ResetPasswordView from './views/ResetPasswordView.vue';
import ContactsView from './views/ContactsView.vue';
import TasksView from './views/TasksView.vue';
import { isAuthenticated } from './lib/auth.js';

// History mode — the server serves the SPA shell for these paths (see
// routes/web.php), so deep links resolve without a hash.
const routes = [
	{ path: '/login', component: LoginView },
	{ path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },
	{ path: '/contacts', component: ContactsView, meta: { requiresAuth: true } },
	{ path: '/tasks', component: TasksView, meta: { requiresAuth: true } },
	{ path: '/reset-password', component: ResetPasswordView },
	{ path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({
	history: createWebHistory('/'),
	routes,
});

// Client-side guard: protected views bounce to login when there is no token.
router.beforeEach((to) => {
	if (to.meta.requiresAuth && !isAuthenticated()) {
		return '/login';
	}

	return true;
});

export default router;

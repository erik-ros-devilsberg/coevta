import { createRouter, createWebHistory } from 'vue-router';

import LoginView from './views/LoginView.vue';
import DashboardView from './views/DashboardView.vue';
import ResetPasswordView from './views/ResetPasswordView.vue';
import PasswordResetCompleteView from './views/PasswordResetCompleteView.vue';
import { isAuthenticated } from '../shared/lib/auth.js';

// History mode — the server serves the SPA shell for these paths (see
// routes/web.php), so deep links resolve without a hash.
const routes = [
	{ path: '/login', component: LoginView },
	{ path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },
	// Every resource module is now a standalone PWA (/contacts/, /tasks/,
	// /calendar/) with its own service worker scope; the NavBar links out to
	// them. What remains here is auth and the dashboard — the shell is retained
	// for a different use rather than retired.
	{ path: '/reset-password', component: ResetPasswordView },
	// Reset is central because one credential backs all three PWAs. This page
	// confirms the account-wide sign-out and links back out to each app.
	{ path: '/password-reset-complete', component: PasswordResetCompleteView },
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

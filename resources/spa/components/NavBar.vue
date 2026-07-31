<script setup>
import { useRouter } from 'vue-router';

import { logout } from '../../shared/lib/auth.js';

const router = useRouter();

async function doLogout() {
	await logout();
	router.push('/login');
}
</script>

<template>
	<header class="nav">
		<router-link class="nav__brand wordmark" to="/dashboard">coevta</router-link>
		<nav class="nav__links">
			<!-- Every module is a separate PWA (its own service worker scope), so
			     these are real navigations out of this SPA, not router links. -->
			<a href="/calendar/">Calendar</a>
			<a href="/contacts/">Contacts</a>
			<a href="/tasks/">Tasks</a>
		</nav>
		<button class="btn btn--ghost btn--sm" type="button" @click="doLogout">Log out</button>
	</header>
</template>

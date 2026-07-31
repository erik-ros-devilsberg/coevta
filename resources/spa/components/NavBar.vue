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
			<router-link to="/calendar">Calendar</router-link>
			<!-- Contacts and Tasks are separate PWAs (their own service worker
			     scopes), so these are real navigations out of this SPA, not router
			     links. -->
			<a href="/contacts/">Contacts</a>
			<a href="/tasks/">Tasks</a>
		</nav>
		<button class="btn btn--ghost btn--sm" type="button" @click="doLogout">Log out</button>
	</header>
</template>

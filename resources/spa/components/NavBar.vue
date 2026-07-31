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
			<!-- Contacts is a separate PWA (its own service worker scope), so this
			     is a real navigation out of this SPA, not a router link. -->
			<a href="/contacts/">Contacts</a>
			<router-link to="/tasks">Tasks</router-link>
		</nav>
		<button class="btn btn--ghost btn--sm" type="button" @click="doLogout">Log out</button>
	</header>
</template>

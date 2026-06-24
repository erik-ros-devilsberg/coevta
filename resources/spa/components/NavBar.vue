<script setup>
import { useRouter } from 'vue-router';

import { logout } from '../lib/auth.js';

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
			<router-link to="/contacts">Contacts</router-link>
			<router-link to="/tasks">Tasks</router-link>
		</nav>
		<button class="btn btn--ghost btn--sm" type="button" @click="doLogout">Log out</button>
	</header>
</template>

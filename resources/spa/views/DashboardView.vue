<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { currentUser, isAuthenticated, logout } from '../lib/auth.js';

const router = useRouter();
const user = ref(null);

onMounted(async () => {
	if (!isAuthenticated()) {
		router.replace('/login');
		return;
	}

	try {
		user.value = await currentUser();
	} catch (e) {
		// Token rejected/expired — send the user back to log in.
		router.replace('/login');
	}
});

async function doLogout() {
	await logout();
	router.push('/login');
}
</script>

<template>
	<main class="container app-view">
		<p class="wordmark">coevta</p>
		<h1>Dashboard</h1>

		<p v-if="user">Signed in as {{ user.email }}.</p>

		<button class="btn btn--primary" type="button" @click="doLogout">Log out</button>
	</main>
</template>

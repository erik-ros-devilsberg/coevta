<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import NavBar from '../components/NavBar.vue';
import { currentUser, isAuthenticated } from '../lib/auth.js';

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
</script>

<template>
	<div class="app">
		<NavBar />
		<main class="container app-main">
			<h1>Dashboard</h1>
			<p v-if="user" class="text-muted">Signed in as {{ user.email }}.</p>
			<p class="text-muted">Choose a module from the navigation above.</p>
		</main>
	</div>
</template>

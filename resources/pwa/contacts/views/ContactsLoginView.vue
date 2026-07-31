<script setup>
// Login lives inside the PWA's own scope (/contacts/login) on purpose: a
// navigation outside the service worker scope would kick an installed app out
// into a browser tab. The token itself is shared with any other app on the
// origin, so signing in here signs you in everywhere.

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { login } from '../../../shared/lib/auth.js';
import { useOnline } from '../composables/useOnline.js';

const router = useRouter();
const online = useOnline();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
	// Authentication is the one thing the app genuinely cannot do offline — say
	// so plainly instead of failing with a generic network error.
	if (!online.value) {
		error.value = 'Signing in needs a connection. Your saved contacts are still readable offline.';
		return;
	}

	error.value = '';
	busy.value = true;
	try {
		await login(email.value, password.value);
		router.push('/');
	} catch (e) {
		error.value = e?.status === 401 ? 'Those credentials did not work.' : 'Could not sign in. Please try again.';
	} finally {
		busy.value = false;
	}
}
</script>

<template>
	<main class="container app-view">
		<p class="wordmark">Contacts</p>

		<p v-if="!online" class="text-muted">You are offline.</p>
		<p v-if="error" class="error">{{ error }}</p>

		<form class="form" @submit.prevent="submit">
			<label class="field">
				<span>Email</span>
				<input v-model="email" type="email" autocomplete="username" required />
			</label>
			<label class="field">
				<span>Password</span>
				<input v-model="password" type="password" autocomplete="current-password" required />
			</label>
			<button class="btn btn--primary" type="submit" :disabled="busy">Sign in</button>
		</form>
	</main>
</template>

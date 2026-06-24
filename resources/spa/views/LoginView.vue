<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { login } from '../lib/auth.js';

const router = useRouter();
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
	error.value = '';
	busy.value = true;

	try {
		await login(email.value, password.value);
		router.push('/dashboard');
	} catch (e) {
		// Generic message — never disclose whether the email exists.
		error.value = 'These credentials do not match our records.';
	} finally {
		busy.value = false;
	}
}
</script>

<template>
	<main class="container app-view">
		<p class="wordmark">coevta</p>
		<h1>Log in</h1>

		<form class="form" @submit.prevent="submit">
			<p v-if="error" class="error">{{ error }}</p>

			<label class="field">
				<span>Email</span>
				<input v-model="email" type="email" required autofocus />
			</label>

			<label class="field">
				<span>Password</span>
				<input v-model="password" type="password" required />
			</label>

			<button class="btn btn--primary" type="submit" :disabled="busy">Log in</button>
		</form>

		<p class="mt-2">
			<router-link to="/reset-password">Forgot your password?</router-link>
		</p>
	</main>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { requestReset, resetPassword } from '../lib/passwords.js';

const route = useRoute();
const router = useRouter();

// The reset link from the email carries token + email. When present we show the
// "choose a new password" form; otherwise we show the "request a link" form.
const token = String(route.query.token || '');
const email = ref(String(route.query.email || ''));
const password = ref('');
const passwordConfirmation = ref('');
const error = ref('');
const notice = ref('');
const busy = ref(false);

async function submitReset() {
	error.value = '';
	busy.value = true;

	try {
		await resetPassword({
			email: email.value,
			token,
			password: password.value,
			passwordConfirmation: passwordConfirmation.value,
		});
		router.push('/login');
	} catch (e) {
		error.value = 'This password reset token is invalid or has expired.';
	} finally {
		busy.value = false;
	}
}

async function submitRequest() {
	error.value = '';
	busy.value = true;

	try {
		await requestReset(email.value);
		// Same message regardless of whether the address exists.
		notice.value = 'If that email address is registered, a reset link has been sent.';
	} finally {
		busy.value = false;
	}
}
</script>

<template>
	<main class="container app-view">
		<p class="wordmark">coevta</p>

		<template v-if="token">
			<h1>Choose a new password</h1>
			<form class="form" @submit.prevent="submitReset">
				<p v-if="error" class="error">{{ error }}</p>

				<label class="field">
					<span>New password</span>
					<input v-model="password" type="password" required autofocus />
				</label>

				<label class="field">
					<span>Confirm password</span>
					<input v-model="passwordConfirmation" type="password" required />
				</label>

				<button class="btn btn--primary" type="submit" :disabled="busy">Reset password</button>
			</form>
		</template>

		<template v-else>
			<h1>Reset your password</h1>
			<form class="form" @submit.prevent="submitRequest">
				<p v-if="notice" class="notice">{{ notice }}</p>

				<label class="field">
					<span>Email</span>
					<input v-model="email" type="email" required autofocus />
				</label>

				<button class="btn btn--primary" type="submit" :disabled="busy">Email me a link</button>
			</form>
		</template>

		<p class="mt-2">
			<router-link to="/login">Back to log in</router-link>
		</p>
	</main>
</template>

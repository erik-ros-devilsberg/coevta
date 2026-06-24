// Password-recovery actions for the SPA. These mirror the API endpoints added in
// the previous sprint: request a reset link, then apply a new password using the
// token + email carried in the reset URL.

import { apiFetch } from './api.js';

export async function requestReset(email) {
	return apiFetch('/forgot-password', {
		method: 'POST',
		body: { email },
	});
}

export async function resetPassword({ email, token, password, passwordConfirmation }) {
	return apiFetch('/reset-password', {
		method: 'POST',
		body: {
			email,
			token,
			password,
			password_confirmation: passwordConfirmation,
		},
	});
}

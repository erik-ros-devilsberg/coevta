// Authentication actions for the SPA, layered on the API client. Login exchanges
// credentials for a Sanctum token and stores it; logout revokes it server-side
// and clears it locally.

import { apiFetch, clearToken, getToken, setToken } from './api.js';

export function isAuthenticated() {
	return Boolean(getToken());
}

export async function login(email, password) {
	const data = await apiFetch('/login', {
		method: 'POST',
		body: { email, password },
	});

	setToken(data.token);

	return data;
}

export async function logout() {
	try {
		await apiFetch('/logout', { method: 'POST' });
	} finally {
		// Always drop the local token, even if the revoke call fails.
		clearToken();
	}
}

export async function currentUser() {
	return apiFetch('/user');
}

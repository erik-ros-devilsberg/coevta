// Events resource client. Thin wrappers over /events, plus listAllEvents which
// pages through the whole collection — the API has no date filter, so the
// calendar fetches every event and groups them onto days client-side.

import { apiFetch } from './api.js';

export function listEvents(page = 1) {
	return apiFetch(`/events?page=${page}`);
}

export function getEvent(id) {
	return apiFetch(`/events/${id}`);
}

export function createEvent(data) {
	return apiFetch('/events', { method: 'POST', body: data });
}

// Full replacement (PUT-only API).
export function updateEvent(id, data) {
	return apiFetch(`/events/${id}`, { method: 'PUT', body: data });
}

export function removeEvent(id) {
	return apiFetch(`/events/${id}`, { method: 'DELETE' });
}

export async function listAllEvents() {
	let page = 1;
	let lastPage = 1;
	let all = [];

	do {
		const response = await listEvents(page);
		all = all.concat(response.data ?? []);
		lastPage = response.meta?.last_page ?? page;
		page += 1;
	} while (page <= lastPage);

	return all;
}

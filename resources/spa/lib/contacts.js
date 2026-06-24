// Contacts resource client. Thin wrappers over the API's /contacts endpoints,
// all going through apiFetch (which attaches the bearer token and throws — with
// .status and .data — on non-2xx, so callers can handle 422/401 with try/catch).

import { apiFetch } from './api.js';

export function listContacts(page = 1) {
	return apiFetch(`/contacts?page=${page}`);
}

export function getContact(id) {
	return apiFetch(`/contacts/${id}`);
}

export function createContact(data) {
	return apiFetch('/contacts', { method: 'POST', body: data });
}

// Update is a full replacement (the API is PUT-only) — send every field.
export function updateContact(id, data) {
	return apiFetch(`/contacts/${id}`, { method: 'PUT', body: data });
}

export function removeContact(id) {
	return apiFetch(`/contacts/${id}`, { method: 'DELETE' });
}

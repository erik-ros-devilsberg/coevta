// Contacts resource client. Thin wrappers over the API's /contacts endpoints,
// all going through apiFetch (which attaches the bearer token and throws — with
// .status and .data — on non-2xx, so callers can handle 422/401 with try/catch).

import { apiFetch } from './api.js';

export function listContacts(page = 1) {
	return apiFetch(`/contacts?page=${page}`);
}

/**
 * Page through the whole collection and return every contact.
 *
 * The PWA keeps the full set on the device — offline reads need it, and the A–Z
 * scrubber can only jump to a letter whose contacts are actually loaded. The
 * API paginates at 25/page, so we walk to last_page. A response without meta is
 * treated as a single page, so a shape change upstream cannot spin this forever.
 */
export async function listAllContacts() {
	const all = [];
	let page = 1;
	let lastPage = 1;

	do {
		const response = await listContacts(page);
		all.push(...(response.data ?? []));
		lastPage = response.meta?.last_page ?? page;
		page += 1;
	} while (page <= lastPage);

	return all;
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

<script setup>
// Create / edit form. Online-only for now — the durable outbox that lets these
// writes happen offline arrives in the next sprint.

import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createContactsStore } from '../lib/store.js';

const props = defineProps({
	store: { type: Object, default: null },
});

const route = useRoute();
const router = useRouter();
const store = props.store ?? createContactsStore();

const editingId = ref(route.params.id ?? null);
const busy = ref(false);

const FIELDS = ['given_name', 'family_name', 'email', 'phone', 'organization', 'address', 'notes', 'birthday'];
const form = reactive({ display_name: '', given_name: '', family_name: '', email: '', phone: '', organization: '', address: '', notes: '', birthday: '' });

onMounted(async () => {
	if (!editingId.value) {
		return;
	}

	const existing = await store.get(editingId.value);
	if (!existing) {
		return;
	}

	form.display_name = existing.display_name ?? '';
	for (const field of FIELDS) {
		form[field] = existing[field] ?? '';
	}
});

function buildPayload() {
	// Empty optional fields go as null — the API's nullable rules reject '' for
	// typed fields like email. The API's PUT is a full replacement, so every
	// field must be present or it gets wiped server-side.
	const payload = { display_name: form.display_name };
	for (const field of FIELDS) {
		payload[field] = form[field] === '' ? null : form[field];
	}

	return payload;
}

/**
 * Saving is a local write plus a queued operation — it works offline and does
 * not wait on the network, so there is no server error to handle here. A write
 * the server later refuses is reported on the list once sync has run.
 *
 * A created contact carries a temporary id that sync replaces with the server's,
 * so we return to the list rather than to a detail route whose id is about to
 * change underneath it.
 */
async function save() {
	busy.value = true;

	if (editingId.value) {
		await store.update(editingId.value, buildPayload());
		router.replace(`/${editingId.value}`);
	} else {
		await store.create(buildPayload());
		router.replace('/');
	}

	busy.value = false;
}
</script>

<template>
	<main class="app-main container">
		<h1>{{ editingId ? 'Edit contact' : 'New contact' }}</h1>

		<form class="form" @submit.prevent="save">
			<label class="field">
				<span>Display name</span>
				<input v-model="form.display_name" type="text" required autofocus />
			</label>
			<label class="field"><span>Given name</span><input v-model="form.given_name" type="text" /></label>
			<label class="field"><span>Family name</span><input v-model="form.family_name" type="text" /></label>
			<label class="field"><span>Email</span><input v-model="form.email" type="email" /></label>
			<label class="field"><span>Phone</span><input v-model="form.phone" type="text" /></label>
			<label class="field"><span>Organization</span><input v-model="form.organization" type="text" /></label>
			<label class="field"><span>Address</span><input v-model="form.address" type="text" /></label>
			<label class="field"><span>Birthday</span><input v-model="form.birthday" type="date" /></label>
			<label class="field"><span>Notes</span><input v-model="form.notes" type="text" /></label>

			<div class="modal__actions">
				<button class="btn btn--ghost btn--sm" type="button" @click="router.back()">Cancel</button>
				<button class="btn btn--primary btn--sm" type="submit" :disabled="busy">Save</button>
			</div>
		</form>
	</main>
</template>

<script setup>
// Read-only contact detail. Reads straight from the device, so it works offline
// and deep links resolve even with no network.

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ConfirmDialog from '../../../shared/components/ConfirmDialog.vue';
import { useOnline } from '../composables/useOnline.js';
import { createContactsStore } from '../lib/store.js';

const props = defineProps({
	store: { type: Object, default: null },
});

const route = useRoute();
const router = useRouter();
const online = useOnline();
const store = props.store ?? createContactsStore();

const contact = ref(null);
const loading = ref(true);
const confirmOpen = ref(false);

onMounted(async () => {
	contact.value = await store.get(route.params.id);
	loading.value = false;
});

// Deleting is a local write plus a queued operation, so it works offline and
// cannot fail on the network here.
async function confirmDelete() {
	confirmOpen.value = false;
	await store.remove(route.params.id);
	router.replace('/');
}
</script>

<template>
	<main class="app-main container">
		<p v-if="loading" class="text-muted">Loading…</p>
		<p v-else-if="!contact" class="text-muted">That contact is not on this device.</p>

		<template v-else>
			<h1>{{ contact.display_name }}</h1>

			<dl>
				<div v-if="contact.given_name || contact.family_name">
					<dt class="list__secondary">Name</dt>
					<dd>{{ [contact.given_name, contact.family_name].filter(Boolean).join(' ') }}</dd>
				</div>
				<div v-if="contact.email"><dt class="list__secondary">Email</dt><dd>{{ contact.email }}</dd></div>
				<div v-if="contact.phone"><dt class="list__secondary">Phone</dt><dd>{{ contact.phone }}</dd></div>
				<div v-if="contact.organization"><dt class="list__secondary">Organization</dt><dd>{{ contact.organization }}</dd></div>
				<div v-if="contact.address"><dt class="list__secondary">Address</dt><dd>{{ contact.address }}</dd></div>
				<div v-if="contact.birthday"><dt class="list__secondary">Birthday</dt><dd>{{ contact.birthday }}</dd></div>
				<div v-if="contact.notes"><dt class="list__secondary">Notes</dt><dd>{{ contact.notes }}</dd></div>
			</dl>

			<div class="toolbar">
				<button class="btn btn--ghost btn--sm" type="button" @click="router.push('/')">Back</button>
				<button class="btn btn--primary btn--sm" type="button" @click="router.push(`/${contact.id}/edit`)">Edit</button>
				<button class="btn btn--ghost btn--sm" type="button" @click="confirmOpen = true">Delete</button>
			</div>
			<p v-if="!online" class="text-muted">Offline — your changes are saved on this device and will sync when you reconnect.</p>
		</template>

		<ConfirmDialog
			:open="confirmOpen"
			message="Delete this contact? This cannot be undone."
			@confirm="confirmDelete"
			@cancel="confirmOpen = false"
		/>
	</main>
</template>

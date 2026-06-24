<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import NavBar from '../components/NavBar.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import {
	listContacts,
	createContact,
	updateContact,
	removeContact,
} from '../lib/contacts.js';

const router = useRouter();

// mode: 'list' | 'detail' | 'form'
const mode = ref('list');
const contacts = ref([]);
const meta = ref({ current_page: 1, last_page: 1 });
const filter = ref('');
const loading = ref(false);
const error = ref('');

const selected = ref(null);
const editingId = ref(null);
const fieldErrors = ref({});

const FIELDS = ['given_name', 'family_name', 'email', 'phone', 'organization', 'address', 'notes', 'birthday'];
const form = reactive({ display_name: '', given_name: '', family_name: '', email: '', phone: '', organization: '', address: '', notes: '', birthday: '' });

const filtered = computed(() => {
	const needle = filter.value.trim().toLowerCase();
	if (!needle) {
		return contacts.value;
	}

	return contacts.value.filter((c) =>
		[c.display_name, c.email, c.organization]
			.filter(Boolean)
			.some((v) => v.toLowerCase().includes(needle)),
	);
});

function onError(e) {
	if (e && e.status === 401) {
		router.replace('/login');
		return;
	}
	error.value = 'Something went wrong. Please try again.';
}

async function load(page = 1) {
	loading.value = true;
	error.value = '';
	try {
		const response = await listContacts(page);
		contacts.value = response.data ?? [];
		meta.value = response.meta ?? { current_page: page, last_page: page };
	} catch (e) {
		onError(e);
	} finally {
		loading.value = false;
	}
}

function resetForm(source = null) {
	form.display_name = source?.display_name ?? '';
	for (const field of FIELDS) {
		form[field] = source?.[field] ?? '';
	}
	fieldErrors.value = {};
}

function openCreate() {
	editingId.value = null;
	resetForm();
	mode.value = 'form';
}

function openEdit(contact) {
	editingId.value = contact.id;
	resetForm(contact);
	mode.value = 'form';
}

function openDetail(contact) {
	selected.value = contact;
	mode.value = 'detail';
}

function backToList() {
	selected.value = null;
	editingId.value = null;
	mode.value = 'list';
}

function buildPayload() {
	// Send empty optional fields as null (the API's 'nullable' rules reject ''
	// for typed fields like email); display_name is required.
	const payload = { display_name: form.display_name };
	for (const field of FIELDS) {
		payload[field] = form[field] === '' ? null : form[field];
	}
	return payload;
}

async function save() {
	fieldErrors.value = {};
	error.value = '';
	try {
		if (editingId.value) {
			await updateContact(editingId.value, buildPayload());
		} else {
			await createContact(buildPayload());
		}
		await load(meta.value.current_page);
		backToList();
	} catch (e) {
		if (e && e.status === 422) {
			fieldErrors.value = e.data?.errors ?? {};
			return;
		}
		onError(e);
	}
}

// --- Delete -------------------------------------------------------------
const confirmOpen = ref(false);
const pendingDelete = ref(null);

function askDelete(contact) {
	pendingDelete.value = contact;
	confirmOpen.value = true;
}

async function confirmDelete() {
	const contact = pendingDelete.value;
	confirmOpen.value = false;
	pendingDelete.value = null;
	if (!contact) {
		return;
	}
	try {
		await removeContact(contact.id);
		await load(meta.value.current_page);
		backToList();
	} catch (e) {
		onError(e);
	}
}

onMounted(() => load());
</script>

<template>
	<div class="app">
		<NavBar />
		<main class="container app-main">
			<h1>Contacts</h1>

			<p v-if="error" class="error">{{ error }}</p>

			<!-- List -->
			<template v-if="mode === 'list'">
				<div class="toolbar">
					<input v-model="filter" type="search" placeholder="Search name, email or organization" aria-label="Search contacts" />
					<button class="btn btn--primary btn--sm" type="button" @click="openCreate">New contact</button>
				</div>

				<p v-if="loading" class="text-muted">Loading…</p>
				<p v-else-if="filtered.length === 0" class="text-muted">No contacts yet.</p>

				<ul v-else class="list">
					<li v-for="contact in filtered" :key="contact.id">
						<button class="list__row" type="button" @click="openDetail(contact)">
							<span>
								<span class="list__primary">{{ contact.display_name }}</span><br />
								<span class="list__secondary">{{ contact.email || contact.organization || '—' }}</span>
							</span>
						</button>
					</li>
				</ul>

				<div v-if="meta.last_page > 1" class="toolbar">
					<button class="btn btn--ghost btn--sm" type="button" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">Previous</button>
					<span class="text-muted">Page {{ meta.current_page }} of {{ meta.last_page }}</span>
					<button class="btn btn--ghost btn--sm" type="button" :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Next</button>
				</div>
			</template>

			<!-- Detail -->
			<template v-else-if="mode === 'detail' && selected">
				<h2>{{ selected.display_name }}</h2>
				<dl>
					<div v-if="selected.given_name || selected.family_name"><dt class="list__secondary">Name</dt><dd>{{ [selected.given_name, selected.family_name].filter(Boolean).join(' ') }}</dd></div>
					<div v-if="selected.email"><dt class="list__secondary">Email</dt><dd>{{ selected.email }}</dd></div>
					<div v-if="selected.phone"><dt class="list__secondary">Phone</dt><dd>{{ selected.phone }}</dd></div>
					<div v-if="selected.organization"><dt class="list__secondary">Organization</dt><dd>{{ selected.organization }}</dd></div>
					<div v-if="selected.address"><dt class="list__secondary">Address</dt><dd>{{ selected.address }}</dd></div>
					<div v-if="selected.birthday"><dt class="list__secondary">Birthday</dt><dd>{{ selected.birthday }}</dd></div>
					<div v-if="selected.notes"><dt class="list__secondary">Notes</dt><dd>{{ selected.notes }}</dd></div>
				</dl>
				<div class="toolbar">
					<button class="btn btn--ghost btn--sm" type="button" @click="backToList">Back</button>
					<button class="btn btn--primary btn--sm" type="button" @click="openEdit(selected)">Edit</button>
					<button class="btn btn--ghost btn--sm" type="button" @click="askDelete(selected)">Delete</button>
				</div>
			</template>

			<!-- Create / edit form -->
			<template v-else-if="mode === 'form'">
				<h2>{{ editingId ? 'Edit contact' : 'New contact' }}</h2>
				<form class="form" @submit.prevent="save">
					<label class="field">
						<span>Display name</span>
						<input v-model="form.display_name" type="text" required autofocus />
						<span v-if="fieldErrors.display_name" class="field__error">{{ fieldErrors.display_name[0] }}</span>
					</label>
					<label class="field"><span>Given name</span><input v-model="form.given_name" type="text" /></label>
					<label class="field"><span>Family name</span><input v-model="form.family_name" type="text" /></label>
					<label class="field">
						<span>Email</span>
						<input v-model="form.email" type="email" />
						<span v-if="fieldErrors.email" class="field__error">{{ fieldErrors.email[0] }}</span>
					</label>
					<label class="field"><span>Phone</span><input v-model="form.phone" type="text" /></label>
					<label class="field"><span>Organization</span><input v-model="form.organization" type="text" /></label>
					<label class="field"><span>Address</span><input v-model="form.address" type="text" /></label>
					<label class="field"><span>Birthday</span><input v-model="form.birthday" type="date" /></label>
					<label class="field"><span>Notes</span><input v-model="form.notes" type="text" /></label>

					<div class="modal__actions">
						<button class="btn btn--ghost btn--sm" type="button" @click="backToList">Cancel</button>
						<button class="btn btn--primary btn--sm" type="submit">Save</button>
					</div>
				</form>
			</template>
		</main>

		<ConfirmDialog
			:open="confirmOpen"
			message="Delete this contact? This cannot be undone."
			@confirm="confirmDelete"
			@cancel="confirmOpen = false"
		/>
	</div>
</template>

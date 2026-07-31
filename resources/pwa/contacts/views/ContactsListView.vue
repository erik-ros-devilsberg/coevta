<script setup>
// The contact list. Renders from the device cache first so the app is usable
// with no network, then quietly reconciles with the server when online.
//
// The whole set is held locally, so search, sorting and grouping all happen
// here rather than on the server — which is also what makes the A–Z scrubber
// able to jump anywhere instantly.

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import AlphabetScrubber from '../components/AlphabetScrubber.vue';
import { useOnline } from '../composables/useOnline.js';
import { buildIndex, bucketFor, resolveJumpTarget } from '../lib/alphabet.js';
import { createContactsStore } from '../lib/store.js';

const props = defineProps({
	// Injected by tests; the app uses the real IndexedDB-backed store.
	store: { type: Object, default: null },
});

const router = useRouter();
const online = useOnline();
const store = props.store ?? createContactsStore();

const contacts = ref([]);
const filter = ref('');
const loading = ref(true);
const error = ref('');
const rejected = ref([]);
const pending = ref(new Set());
const pendingCount = ref(0);
const active = ref('A');
const headers = ref({});

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

// Only populated letters get a heading in the list; the scrubber still shows
// the full alphabet (dimming the empty letters), which is why it uses `index`.
const groups = computed(() => {
	const byLetter = new Map();
	for (const contact of filtered.value) {
		const letter = bucketFor(contact);
		if (!byLetter.has(letter)) {
			byLetter.set(letter, []);
		}
		byLetter.get(letter).push(contact);
	}

	return [...byLetter].map(([letter, items]) => ({ letter, contacts: items }));
});

const index = computed(() => buildIndex(filtered.value));

function jump(letter) {
	const target = resolveJumpTarget(index.value, letter);
	if (!target) {
		return;
	}

	active.value = target.letter;
	// scrollIntoView is a no-op outside a real browser, hence the optional call.
	headers.value[target.letter]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
}

// --- Scroll spy ---------------------------------------------------------
// Reflect whichever letter heading is at the top of the viewport back onto the
// scrubber. IntersectionObserver does not exist in jsdom, so this is guarded and
// simply does not run under test.
let observer = null;

function observeHeaders() {
	observer?.disconnect();
	if (typeof IntersectionObserver === 'undefined') {
		return;
	}

	observer = new IntersectionObserver(
		(entries) => {
			const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
			if (top?.target?.dataset?.letter) {
				active.value = top.target.dataset.letter;
			}
		},
		{ rootMargin: '0px 0px -85% 0px' },
	);

	for (const el of Object.values(headers.value)) {
		if (el) {
			observer.observe(el);
		}
	}
}

// flush: 'post' so the headings exist in the DOM before we observe them. This
// fires when the list first populates (groups goes from empty to loaded) and on
// every search, which is exactly when the set of headings changes.
watch(groups, observeHeaders, { flush: 'post' });
onBeforeUnmount(() => observer?.disconnect());

// --- Load and sync ------------------------------------------------------
async function readLocal() {
	contacts.value = await store.cached();
	pending.value = await store.pendingIds();
	pendingCount.value = await store.pendingCount();
}

/**
 * Push queued changes, then pull the server's view. Order matters: refreshing
 * first would reconcile against a server that has not seen our edits yet.
 */
async function syncNow() {
	if (!online.value) {
		return;
	}

	try {
		const result = await store.flush();
		// A write the server refused will never succeed on retry, so it is dropped
		// from the queue — but the user made that edit and deserves to hear that
		// it did not stick.
		rejected.value = result.rejected;

		await store.refresh();
	} catch (e) {
		if (e?.status === 401) {
			router.replace('/login');
			return;
		}
		// A failed sync is not fatal — the cached list still stands and the queue
		// keeps for the next attempt.
		error.value = 'Could not sync with the server. Showing your saved contacts.';
	} finally {
		await readLocal();
	}
}

onMounted(async () => {
	await readLocal();
	loading.value = false;
	await syncNow();
});

// Drain the queue as soon as the connection comes back.
watch(online, (isOnline) => {
	if (isOnline) {
		syncNow();
	}
});
</script>

<template>
	<main class="app-main container contacts">
		<header class="contacts__head">
			<h1>Contacts</h1>
			<p class="conn" :class="online ? 'conn--online' : 'conn--offline'">
				{{ online ? 'Online' : 'Offline' }}
				<span v-if="pendingCount > 0" class="conn__pending">
					· {{ pendingCount }} unsynced {{ pendingCount === 1 ? 'change' : 'changes' }}
				</span>
			</p>
		</header>

		<p v-if="error" class="error">{{ error }}</p>

		<!-- Writes the server refused. They are out of the queue, so without this
		     the edit would just silently not exist. -->
		<p v-for="failure in rejected" :key="failure.op.id" class="error">
			A change to “{{ failure.op.payload?.display_name ?? 'a contact' }}” was rejected by the server and could not be saved.
		</p>

		<div class="toolbar">
			<input v-model="filter" type="search" placeholder="Search name, email or organization" aria-label="Search contacts" />
			<button class="btn btn--primary btn--sm" type="button" @click="router.push('/new')">New contact</button>
		</div>

		<p v-if="loading" class="text-muted">Loading…</p>
		<p v-else-if="contacts.length === 0" class="text-muted">No contacts yet.</p>
		<p v-else-if="filtered.length === 0" class="text-muted">No contacts match “{{ filter }}”.</p>

		<ul v-else class="list contacts__list">
			<template v-for="group in groups" :key="group.letter">
				<li :ref="(el) => (headers[group.letter] = el)" :data-letter="group.letter" class="list__header">
					{{ group.letter }}
				</li>
				<li v-for="contact in group.contacts" :key="contact.id">
					<button class="list__row" type="button" @click="router.push(`/${contact.id}`)">
						<span>
							<span class="list__primary">{{ contact.display_name }}</span>
							<span v-if="pending.has(contact.id)" class="badge-pending" title="Not synced yet">Unsynced</span>
							<br />
							<span class="list__secondary">{{ contact.email || contact.organization || '—' }}</span>
						</span>
					</button>
				</li>
			</template>
		</ul>

		<AlphabetScrubber v-if="contacts.length > 0" :index="index" :active="active" @jump="jump" />
	</main>
</template>

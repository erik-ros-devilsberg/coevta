<script setup>
// The month grid — the whole app. Renders from the device cache first so it is
// usable with no network, then quietly syncs and reconciles when online.
//
// Month navigation is pure client-side arithmetic over the local event set, so
// prev/next/today work offline for any month, not just ones already visited.

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import ConfirmDialog from '../../../shared/components/ConfirmDialog.vue';
import { localDateKey, toLocalInput, fromLocalInput } from '../../../shared/lib/datetime.js';
import { useOnline } from '../composables/useOnline.js';
import { monthMatrix, groupByDay, shiftMonth, dayKeyFor } from '../lib/month.js';
import { createCalendarStore } from '../lib/store.js';

const props = defineProps({
	// Injected by tests; the app uses the real IndexedDB-backed store.
	store: { type: Object, default: null },
});

const router = useRouter();
const online = useOnline();
const store = props.store ?? createCalendarStore();

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const now = new Date();
const todayKey = localDateKey(now);
const year = ref(now.getFullYear());
const month = ref(now.getMonth());

const events = ref([]);
const loading = ref(true);
const error = ref('');
const rejected = ref([]);
const pending = ref(new Set());
const pendingCount = ref(0);

const weeks = computed(() => monthMatrix(year.value, month.value, todayKey));
// The whole event set is local, so grouping every event by day is cheap and the
// grid can render any month instantly — including offline.
const byDay = computed(() => groupByDay(events.value, dayKeyFor));
const monthLabel = computed(() =>
	new Date(Date.UTC(year.value, month.value, 1)).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
);

function eventsFor(key) {
	return byDay.value[key] ?? [];
}

function timeLabel(iso) {
	const d = new Date(iso);

	return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function goToday() {
	year.value = now.getFullYear();
	month.value = now.getMonth();
}

function step(delta) {
	const next = shiftMonth(year.value, month.value, delta);
	year.value = next.year;
	month.value = next.month;
}

// --- Load and sync ------------------------------------------------------
async function readLocal() {
	events.value = await store.cached();
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
		// A failed sync is not fatal — the cached grid still stands and the queue
		// keeps for the next attempt.
		error.value = 'Could not sync with the server. Showing your saved calendar.';
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

// --- Create / edit ------------------------------------------------------
const editingId = ref(null);
const formOpen = ref(false);
const form = reactive({ title: '', location: '', all_day: false, start: '', end: '' });

function openCreate(dayKey) {
	editingId.value = null;
	form.title = '';
	form.location = '';
	form.all_day = false;
	form.start = `${dayKey}T09:00`;
	form.end = `${dayKey}T10:00`;
	formOpen.value = true;
}

function openEdit(event) {
	editingId.value = event.id;
	form.title = event.title ?? '';
	form.location = event.location ?? '';
	form.all_day = Boolean(event.all_day);
	if (event.all_day) {
		form.start = dayKeyFor(event);
		form.end = dayKeyFor({ ...event, start_at: event.end_at });
	} else {
		form.start = toLocalInput(event.start_at);
		form.end = toLocalInput(event.end_at);
	}
	formOpen.value = true;
}

async function save() {
	const id = editingId.value;
	formOpen.value = false;

	// All-day events send date-only values; timed events send ISO 8601 UTC. The
	// store fills in the rest of the API's defaults locally, so the record on the
	// grid is already the shape the server will hand back.
	const opts = { dateOnly: form.all_day };
	const input = {
		title: form.title,
		location: form.location,
		all_day: form.all_day,
		start_at: fromLocalInput(form.start, opts),
		end_at: fromLocalInput(form.end, opts),
	};

	if (id) {
		await store.update(id, input);
	} else {
		await store.create(input);
	}

	await readLocal();
}

// --- Delete -------------------------------------------------------------
const confirmOpen = ref(false);

async function confirmDelete() {
	const id = editingId.value;
	confirmOpen.value = false;
	formOpen.value = false;
	if (!id) {
		return;
	}

	await store.remove(id);
	await readLocal();
}
</script>

<template>
	<main class="app-main container calendar">
		<div class="cal-head">
			<h1>{{ monthLabel }}</h1>
			<p class="conn" :class="online ? 'conn--online' : 'conn--offline'">
				{{ online ? 'Online' : 'Offline' }}
				<span v-if="pendingCount > 0" class="conn__pending">
					· {{ pendingCount }} unsynced {{ pendingCount === 1 ? 'change' : 'changes' }}
				</span>
			</p>
			<div class="cal-nav">
				<button class="btn btn--ghost btn--sm" type="button" aria-label="Previous month" @click="step(-1)">‹</button>
				<button class="btn btn--ghost btn--sm js-today" type="button" @click="goToday">Today</button>
				<button class="btn btn--ghost btn--sm" type="button" aria-label="Next month" @click="step(1)">›</button>
			</div>
		</div>

		<p v-if="error" class="error">{{ error }}</p>

		<!-- Writes the server refused. They are out of the queue, so without this
		     the edit would just silently not exist. -->
		<p v-for="failure in rejected" :key="failure.op.id" class="error">
			A change to “{{ failure.op.payload?.title ?? 'an event' }}” was rejected by the server and could not be saved.
		</p>

		<p v-if="loading" class="text-muted">Loading…</p>

		<div class="cal-grid">
			<div v-for="wd in WEEKDAYS" :key="wd" class="cal-weekday">{{ wd }}</div>
			<template v-for="(week, wi) in weeks" :key="wi">
				<button
					v-for="cell in week"
					:key="cell.key"
					type="button"
					class="cal-cell"
					:data-day="cell.key"
					:class="{ 'cal-cell--out': !cell.inMonth, 'cal-cell--today': cell.isToday }"
					@click="openCreate(cell.key)"
				>
					<span class="cal-cell__day">{{ cell.day }}</span>
					<span
						v-for="ev in eventsFor(cell.key).slice(0, 3)"
						:key="ev.id"
						class="cal-chip"
						:class="{ 'cal-chip--allday': ev.all_day, 'cal-chip--pending': pending.has(ev.id) }"
						:title="pending.has(ev.id) ? 'Not synced yet' : null"
						@click.stop="openEdit(ev)"
					>
						<template v-if="!ev.all_day">{{ timeLabel(ev.start_at) }} </template>{{ ev.title }}
					</span>
					<span v-if="eventsFor(cell.key).length > 3" class="cal-chip__more">
						+{{ eventsFor(cell.key).length - 3 }} more
					</span>
				</button>
			</template>
		</div>
	</main>

	<!-- Create / edit dialog -->
	<div v-if="formOpen" class="modal" role="dialog" aria-modal="true">
		<div class="modal__dialog">
			<h2>{{ editingId ? 'Edit event' : 'New event' }}</h2>
			<form class="form" @submit.prevent="save">
				<label class="field"><span>Title</span><input v-model="form.title" type="text" required /></label>
				<label class="field"><span>Location</span><input v-model="form.location" type="text" /></label>
				<label class="field field--inline"><input v-model="form.all_day" type="checkbox" /> <span>All day</span></label>
				<label class="field">
					<span>Start</span>
					<input v-model="form.start" :type="form.all_day ? 'date' : 'datetime-local'" />
				</label>
				<label class="field">
					<span>End</span>
					<input v-model="form.end" :type="form.all_day ? 'date' : 'datetime-local'" />
				</label>
				<div class="modal__actions">
					<button v-if="editingId" class="btn btn--ghost btn--sm js-delete" type="button" @click="confirmOpen = true">
						Delete
					</button>
					<button class="btn btn--ghost btn--sm" type="button" @click="formOpen = false">Cancel</button>
					<button class="btn btn--primary btn--sm" type="submit">Save</button>
				</div>
			</form>
		</div>
	</div>

	<ConfirmDialog
		:open="confirmOpen"
		message="Delete this event? This cannot be undone."
		@confirm="confirmDelete"
		@cancel="confirmOpen = false"
	/>
</template>

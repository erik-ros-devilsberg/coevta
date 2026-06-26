<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import NavBar from '../components/NavBar.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import {
	listAllEvents,
	createEvent,
	updateEvent,
	removeEvent,
} from '../lib/events.js';
import { monthMatrix, groupByDay, shiftMonth } from '../lib/month.js';
import { localDateKey, toLocalInput, fromLocalInput } from '../lib/datetime.js';

const router = useRouter();

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const now = new Date();
const year = ref(now.getFullYear());
const month = ref(now.getMonth());
const todayKey = localDateKey(now);

const events = ref([]);
const loading = ref(false);
const error = ref('');

const weeks = computed(() => monthMatrix(year.value, month.value, todayKey));
const byDay = computed(() => groupByDay(events.value, (e) => localDateKey(e.start_at)));
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

function onError(e) {
	if (e && e.status === 401) {
		router.replace('/login');
		return;
	}
	error.value = 'Something went wrong. Please try again.';
}

async function load() {
	loading.value = true;
	error.value = '';
	try {
		events.value = await listAllEvents();
	} catch (e) {
		onError(e);
	} finally {
		loading.value = false;
	}
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
		form.start = localDateKey(event.start_at);
		form.end = localDateKey(event.end_at);
	} else {
		form.start = toLocalInput(event.start_at);
		form.end = toLocalInput(event.end_at);
	}
	formOpen.value = true;
}

function closeForm() {
	formOpen.value = false;
}

function buildPayload() {
	// All-day events send date-only values (the API snaps them); timed events
	// send ISO 8601 UTC. The API fills end_at when omitted/invalid.
	const opts = { dateOnly: form.all_day };
	return {
		title: form.title,
		location: form.location === '' ? null : form.location,
		all_day: form.all_day,
		start_at: fromLocalInput(form.start, opts),
		end_at: fromLocalInput(form.end, opts),
	};
}

async function save() {
	try {
		if (editingId.value) {
			await updateEvent(editingId.value, buildPayload());
		} else {
			await createEvent(buildPayload());
		}
		formOpen.value = false;
		await load();
	} catch (e) {
		onError(e);
	}
}

// --- Delete -------------------------------------------------------------
const confirmOpen = ref(false);

function askDelete() {
	confirmOpen.value = true;
}

async function confirmDelete() {
	const id = editingId.value;
	confirmOpen.value = false;
	if (!id) {
		return;
	}
	try {
		await removeEvent(id);
		formOpen.value = false;
		await load();
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
			<div class="cal-head">
				<h1>{{ monthLabel }}</h1>
				<div class="cal-nav">
					<button class="btn btn--ghost btn--sm" type="button" @click="step(-1)" aria-label="Previous month">‹</button>
					<button class="btn btn--ghost btn--sm" type="button" @click="goToday">Today</button>
					<button class="btn btn--ghost btn--sm" type="button" @click="step(1)" aria-label="Next month">›</button>
				</div>
			</div>

			<p v-if="error" class="error">{{ error }}</p>
			<p v-if="loading" class="text-muted">Loading…</p>
			<p v-else-if="events.length === 0" class="text-muted">No events this month.</p>

			<div class="cal-grid">
				<div v-for="wd in WEEKDAYS" :key="wd" class="cal-weekday">{{ wd }}</div>
				<template v-for="(week, wi) in weeks" :key="wi">
					<button
						v-for="cell in week"
						:key="cell.key"
						type="button"
						class="cal-cell"
						:class="{ 'cal-cell--out': !cell.inMonth, 'cal-cell--today': cell.isToday }"
						@click="openCreate(cell.key)"
					>
						<span class="cal-cell__day">{{ cell.day }}</span>
						<span
							v-for="ev in eventsFor(cell.key).slice(0, 3)"
							:key="ev.id"
							class="cal-chip"
							:class="{ 'cal-chip--allday': ev.all_day }"
							@click.stop="openEdit(ev)"
						>
							<template v-if="!ev.all_day">{{ timeLabel(ev.start_at) }} </template>{{ ev.title }}
						</span>
						<span v-if="eventsFor(cell.key).length > 3" class="cal-chip__more">+{{ eventsFor(cell.key).length - 3 }} more</span>
					</button>
				</template>
			</div>
		</main>

		<!-- Create / edit dialog -->
		<div v-if="formOpen" class="modal" role="dialog" aria-modal="true">
			<div class="modal__dialog">
				<h2>{{ editingId ? 'Edit event' : 'New event' }}</h2>
				<form class="form" @submit.prevent="save">
					<label class="field"><span>Title</span><input v-model="form.title" type="text" required autofocus /></label>
					<label class="field"><span>Location</span><input v-model="form.location" type="text" /></label>
					<label class="field field--inline"><input v-model="form.all_day" type="checkbox" /> <span>All day</span></label>
					<label class="field"><span>Start</span><input v-model="form.start" :type="form.all_day ? 'date' : 'datetime-local'" /></label>
					<label class="field"><span>End</span><input v-model="form.end" :type="form.all_day ? 'date' : 'datetime-local'" /></label>
					<div class="modal__actions">
						<button v-if="editingId" class="btn btn--ghost btn--sm" type="button" @click="askDelete">Delete</button>
						<button class="btn btn--ghost btn--sm" type="button" @click="closeForm">Cancel</button>
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
	</div>
</template>

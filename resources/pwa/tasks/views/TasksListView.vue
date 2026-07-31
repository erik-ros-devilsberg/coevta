<script setup>
// The task list — the whole app, really. Renders from the device cache first so
// it is usable with no network, then quietly syncs and reconciles when online.
//
// Every write (quick-add, complete, reopen, edit, delete) applies locally at
// once and queues; nothing here is disabled offline except signing in.

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import ConfirmDialog from '../../../shared/components/ConfirmDialog.vue';
import { buildTaskBody } from '../../../shared/lib/tasks.js';
import { formatDueForDisplay } from '../../../shared/lib/datetime.js';
import { useOnline } from '../composables/useOnline.js';
import { isOverdue } from '../lib/ordering.js';
import { createTasksStore } from '../lib/store.js';

const props = defineProps({
	// Injected by tests; the app uses the real IndexedDB-backed store.
	store: { type: Object, default: null },
});

const router = useRouter();
const online = useOnline();
const store = props.store ?? createTasksStore();

const tasks = ref([]);
const loading = ref(true);
const error = ref('');
const rejected = ref([]);
const pending = ref(new Set());
const pendingCount = ref(0);
const quickTitle = ref('');

// The store hands the list back already ordered (open first, by due date), so
// the split here is presentation only.
const openTasks = computed(() => tasks.value.filter((t) => !t.completed_at));
const doneTasks = computed(() => tasks.value.filter((t) => t.completed_at));

// --- Load and sync ------------------------------------------------------
async function readLocal() {
	tasks.value = await store.cached();
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
		error.value = 'Could not sync with the server. Showing your saved tasks.';
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

// --- Writes -------------------------------------------------------------
async function quickAdd() {
	const title = quickTitle.value.trim();
	if (!title) {
		return;
	}

	// A complete body even for a one-field quick-add: it goes into the outbox
	// verbatim and the API replaces the whole record with it.
	await store.create(buildTaskBody({ title }));
	quickTitle.value = '';
	await readLocal();
}

/**
 * Tick or untick a task. Completion is stamped by the store from the device
 * clock — the moment the box was ticked, not the moment the queue drains.
 */
async function toggle(task) {
	if (task.completed_at) {
		await store.reopen(task);
	} else {
		await store.complete(task);
	}

	await readLocal();
}

// --- Edit ---------------------------------------------------------------
const editing = ref(null);
const form = reactive({ title: '', notes: '', due: '' });

function openEdit(task) {
	editing.value = task;
	form.title = task.title ?? '';
	form.notes = task.notes ?? '';
	// Due is edited as a date; an existing datetime collapses to its date part.
	form.due = task.due_at ? task.due_at.slice(0, 10) : '';
}

async function saveEdit() {
	const task = editing.value;
	editing.value = null;

	// completed_at is carried through deliberately: the API's PUT is a full
	// replacement, so dropping it here would reopen a completed task.
	await store.update(
		task.id,
		buildTaskBody({
			title: form.title,
			notes: form.notes,
			due_at: form.due,
			completed_at: task.completed_at,
		}),
	);
	await readLocal();
}

// --- Delete -------------------------------------------------------------
const pendingDelete = ref(null);

async function confirmDelete() {
	const task = pendingDelete.value;
	pendingDelete.value = null;
	if (!task) {
		return;
	}

	await store.remove(task.id);
	await readLocal();
}
</script>

<template>
	<main class="app-main container tasks">
		<header class="tasks__head">
			<h1>Tasks</h1>
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
			A change to “{{ failure.op.payload?.title ?? 'a task' }}” was rejected by the server and could not be saved.
		</p>

		<form class="toolbar" @submit.prevent="quickAdd">
			<input v-model="quickTitle" type="text" placeholder="Add a task and press Enter" aria-label="New task" />
			<button class="btn btn--primary btn--sm" type="submit">Add</button>
		</form>

		<p v-if="loading" class="text-muted">Loading…</p>
		<p v-else-if="tasks.length === 0" class="text-muted">Nothing to do.</p>

		<template v-else>
			<p v-if="openTasks.length === 0" class="text-muted">No open tasks.</p>
			<ul v-else class="list">
				<li v-for="task in openTasks" :key="task.id" class="list__row task-row">
					<input type="checkbox" :checked="false" :aria-label="`Complete ${task.title}`" @change="toggle(task)" />
					<span class="task-row__body">
						<span class="list__primary">{{ task.title }}</span>
						<span v-if="pending.has(task.id)" class="badge-pending" title="Not synced yet">Unsynced</span>
						<span v-if="task.due_at" class="list__secondary" :class="{ 'is-overdue': isOverdue(task) }">
							Due {{ formatDueForDisplay(task.due_at) }}
						</span>
					</span>
					<span class="task-row__actions">
						<button class="btn btn--ghost btn--sm js-edit" type="button" @click="openEdit(task)">Edit</button>
						<button class="btn btn--ghost btn--sm js-delete" type="button" @click="pendingDelete = task">Delete</button>
					</span>
				</li>
			</ul>

			<template v-if="doneTasks.length">
				<h2>Completed</h2>
				<ul class="list">
					<li v-for="task in doneTasks" :key="task.id" class="list__row task-row task-row--done">
						<input type="checkbox" checked :aria-label="`Reopen ${task.title}`" @change="toggle(task)" />
						<span class="task-row__body">
							<span class="list__primary">{{ task.title }}</span>
							<span v-if="pending.has(task.id)" class="badge-pending" title="Not synced yet">Unsynced</span>
						</span>
						<span class="task-row__actions">
							<button class="btn btn--ghost btn--sm js-edit" type="button" @click="openEdit(task)">Edit</button>
							<button class="btn btn--ghost btn--sm js-delete" type="button" @click="pendingDelete = task">Delete</button>
						</span>
					</li>
				</ul>
			</template>
		</template>
	</main>

	<!-- Edit dialog -->
	<div v-if="editing" class="modal" role="dialog" aria-modal="true">
		<div class="modal__dialog">
			<h2>Edit task</h2>
			<form class="form" @submit.prevent="saveEdit">
				<label class="field"><span>Title</span><input v-model="form.title" type="text" required /></label>
				<label class="field"><span>Notes</span><input v-model="form.notes" type="text" /></label>
				<label class="field"><span>Due date</span><input v-model="form.due" type="date" /></label>
				<div class="modal__actions">
					<button class="btn btn--ghost btn--sm js-cancel-edit" type="button" @click="editing = null">Cancel</button>
					<button class="btn btn--primary btn--sm" type="submit">Save</button>
				</div>
			</form>
		</div>
	</div>

	<ConfirmDialog
		:open="pendingDelete !== null"
		message="Delete this task? This cannot be undone."
		@confirm="confirmDelete"
		@cancel="pendingDelete = null"
	/>
</template>

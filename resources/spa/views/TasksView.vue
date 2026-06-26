<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import NavBar from '../components/NavBar.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import {
	listTasks,
	createTask,
	updateTask,
	completeTask,
	removeTask,
	buildTaskBody,
} from '../lib/tasks.js';
import { formatDueForDisplay } from '../lib/datetime.js';

const router = useRouter();

const tasks = ref([]);
const meta = ref({ current_page: 1, last_page: 1 });
const loading = ref(false);
const error = ref('');
const quickTitle = ref('');

const openTasks = computed(() => tasks.value.filter((t) => !t.completed_at));
const doneTasks = computed(() => tasks.value.filter((t) => t.completed_at));

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
		const response = await listTasks(page);
		tasks.value = response.data ?? [];
		meta.value = response.meta ?? { current_page: page, last_page: page };
	} catch (e) {
		onError(e);
	} finally {
		loading.value = false;
	}
}

async function quickAdd() {
	const title = quickTitle.value.trim();
	if (!title) {
		return;
	}
	try {
		await createTask(buildTaskBody({ title }));
		quickTitle.value = '';
		await load(meta.value.current_page);
	} catch (e) {
		onError(e);
	}
}

async function toggle(task) {
	try {
		if (task.completed_at) {
			// Reopen: PUT a full replacement with completed_at omitted (null).
			await updateTask(task.id, buildTaskBody({
				title: task.title,
				notes: task.notes ?? '',
				due_at: task.due_at ?? null,
				completed_at: null,
			}));
		} else {
			// Complete: no-body convenience action.
			await completeTask(task.id);
		}
		await load(meta.value.current_page);
	} catch (e) {
		onError(e);
	}
}

// --- Edit ---------------------------------------------------------------
const editingId = ref(null);
const editingCompletedAt = ref(null);
const form = reactive({ title: '', notes: '', due: '' });

function openEdit(task) {
	editingId.value = task.id;
	editingCompletedAt.value = task.completed_at ?? null;
	form.title = task.title ?? '';
	form.notes = task.notes ?? '';
	// Due is edited as a date; an existing datetime collapses to its date part.
	form.due = task.due_at ? task.due_at.slice(0, 10) : '';
}

function cancelEdit() {
	editingId.value = null;
}

async function saveEdit() {
	try {
		// Resend completed_at so a completed task stays completed (PUT replaces).
		await updateTask(editingId.value, buildTaskBody({
			title: form.title,
			notes: form.notes,
			due_at: form.due === '' ? null : form.due,
			completed_at: editingCompletedAt.value,
		}));
		editingId.value = null;
		await load(meta.value.current_page);
	} catch (e) {
		onError(e);
	}
}

// --- Delete -------------------------------------------------------------
const confirmOpen = ref(false);
const pendingDelete = ref(null);

function askDelete(task) {
	pendingDelete.value = task;
	confirmOpen.value = true;
}

async function confirmDelete() {
	const task = pendingDelete.value;
	confirmOpen.value = false;
	pendingDelete.value = null;
	if (!task) {
		return;
	}
	try {
		await removeTask(task.id);
		await load(meta.value.current_page);
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
			<h1>Tasks</h1>

			<p v-if="error" class="error">{{ error }}</p>

			<form class="toolbar" @submit.prevent="quickAdd">
				<input v-model="quickTitle" type="text" placeholder="Add a task and press Enter" aria-label="New task" />
				<button class="btn btn--primary btn--sm" type="submit">Add</button>
			</form>

			<p v-if="loading" class="text-muted">Loading…</p>
			<p v-else-if="tasks.length === 0" class="text-muted">Nothing to do.</p>

			<template v-else>
				<!-- Open -->
				<h2>Open</h2>
				<p v-if="openTasks.length === 0" class="text-muted">No open tasks.</p>
				<ul v-else class="list">
					<li v-for="task in openTasks" :key="task.id" class="list__row task-row">
						<input type="checkbox" :checked="false" :aria-label="`Complete ${task.title}`" @change="toggle(task)" />
						<span class="task-row__body">
							<span class="list__primary">{{ task.title }}</span>
							<span v-if="task.due_at" class="list__secondary">Due {{ formatDueForDisplay(task.due_at) }}</span>
						</span>
						<span class="task-row__actions">
							<button class="btn btn--ghost btn--sm" type="button" @click="openEdit(task)">Edit</button>
							<button class="btn btn--ghost btn--sm" type="button" @click="askDelete(task)">Delete</button>
						</span>
					</li>
				</ul>

				<!-- Completed -->
				<template v-if="doneTasks.length">
					<h2>Completed</h2>
					<ul class="list">
						<li v-for="task in doneTasks" :key="task.id" class="list__row task-row task-row--done">
							<input type="checkbox" checked :aria-label="`Reopen ${task.title}`" @change="toggle(task)" />
							<span class="task-row__body">
								<span class="list__primary">{{ task.title }}</span>
							</span>
							<span class="task-row__actions">
								<button class="btn btn--ghost btn--sm" type="button" @click="openEdit(task)">Edit</button>
								<button class="btn btn--ghost btn--sm" type="button" @click="askDelete(task)">Delete</button>
							</span>
						</li>
					</ul>
				</template>

				<div v-if="meta.last_page > 1" class="toolbar">
					<button class="btn btn--ghost btn--sm" type="button" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">Previous</button>
					<span class="text-muted">Page {{ meta.current_page }} of {{ meta.last_page }}</span>
					<button class="btn btn--ghost btn--sm" type="button" :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Next</button>
				</div>
			</template>
		</main>

		<!-- Edit dialog -->
		<div v-if="editingId" class="modal" role="dialog" aria-modal="true">
			<div class="modal__dialog">
				<h2>Edit task</h2>
				<form class="form" @submit.prevent="saveEdit">
					<label class="field"><span>Title</span><input v-model="form.title" type="text" required autofocus /></label>
					<label class="field"><span>Notes</span><input v-model="form.notes" type="text" /></label>
					<label class="field"><span>Due date</span><input v-model="form.due" type="date" /></label>
					<div class="modal__actions">
						<button class="btn btn--ghost btn--sm" type="button" @click="cancelEdit">Cancel</button>
						<button class="btn btn--primary btn--sm" type="submit">Save</button>
					</div>
				</form>
			</div>
		</div>

		<ConfirmDialog
			:open="confirmOpen"
			message="Delete this task? This cannot be undone."
			@confirm="confirmDelete"
			@cancel="confirmOpen = false"
		/>
	</div>
</template>

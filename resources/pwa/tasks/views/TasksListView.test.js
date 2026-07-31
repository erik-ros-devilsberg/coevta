import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { pushMock, replaceMock } = vi.hoisted(() => ({ pushMock: vi.fn(), replaceMock: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock, replace: replaceMock }) }));

import TasksListView from './TasksListView.vue';

const task = (id, title, extra = {}) => ({ id, title, notes: null, due_at: null, completed_at: null, ...extra });

function fakeStore({ cached = [], refresh, flush, pending = [] } = {}) {
	const state = [...cached];

	return {
		cached: vi.fn(async () => state),
		refresh: refresh ?? vi.fn(async () => state),
		flush: flush ?? vi.fn(async () => ({ rejected: [], stopped: null })),
		pendingIds: vi.fn(async () => new Set(pending)),
		pendingCount: vi.fn(async () => pending.length),
		get: vi.fn(async (id) => state.find((t) => t.id === id) ?? null),
		create: vi.fn(async (payload) => {
			const record = { id: 'local-1', ...payload };
			state.push(record);
			return record;
		}),
		update: vi.fn(async (id, payload) => ({ id, ...payload })),
		remove: vi.fn(async (id) => {
			state.splice(state.findIndex((t) => t.id === id), 1);
		}),
		complete: vi.fn(async () => null),
		reopen: vi.fn(async () => null),
	};
}

function mountView(store) {
	return mount(TasksListView, { props: { store }, global: { stubs: { RouterLink: true } } });
}

// jsdom reports navigator.onLine as true; flip it per test.
function setOnline(value) {
	Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

async function quickAdd(wrapper, title) {
	await wrapper.get('input[aria-label="New task"]').setValue(title);
	await wrapper.get('form.toolbar').trigger('submit.prevent');
	await flushPromises();
}

beforeEach(() => {
	pushMock.mockReset();
	replaceMock.mockReset();
	setOnline(true);
});

describe('loading', () => {
	it('renders the cached tasks before the network responds', async () => {
		// The whole point of the offline layer: the list paints from the device.
		let release;
		const slow = new Promise((resolve) => {
			release = resolve;
		});
		const store = fakeStore({ cached: [task('1', 'Pay rent')], refresh: vi.fn(() => slow) });

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Pay rent');

		release();
		await flushPromises();
	});

	it('syncs then refreshes when online', async () => {
		const store = fakeStore({ cached: [] });

		mountView(store);
		await flushPromises();

		expect(store.flush).toHaveBeenCalled();
		expect(store.refresh).toHaveBeenCalled();
	});

	it('does not hit the network when offline', async () => {
		setOnline(false);
		const store = fakeStore({ cached: [task('1', 'Pay rent')] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(store.refresh).not.toHaveBeenCalled();
		expect(store.flush).not.toHaveBeenCalled();
		expect(wrapper.text()).toContain('Pay rent');
	});

	it('says so when there is nothing to do', async () => {
		const wrapper = mountView(fakeStore({ cached: [] }));
		await flushPromises();

		expect(wrapper.text()).toContain('Nothing to do');
	});
});

describe('connection state', () => {
	it('shows the offline state', async () => {
		setOnline(false);

		const wrapper = mountView(fakeStore());
		await flushPromises();

		expect(wrapper.get('.conn').text()).toContain('Offline');
	});

	it('shows how many changes are waiting to sync', async () => {
		const store = fakeStore({ cached: [task('1', 'Pay rent')], pending: ['1'] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.get('.conn').text()).toContain('1 unsynced change');
	});

	it('marks the individual tasks that have not synced', async () => {
		const store = fakeStore({ cached: [task('1', 'Pay rent'), task('2', 'Call bank')], pending: ['1'] });

		const wrapper = mountView(store);
		await flushPromises();

		const rows = wrapper.findAll('.list__row');
		expect(rows[0].text()).toContain('Unsynced');
		expect(rows[1].text()).not.toContain('Unsynced');
	});
});

describe('quick add', () => {
	it('adds a task offline and shows it immediately', async () => {
		setOnline(false);
		const store = fakeStore({ cached: [] });

		const wrapper = mountView(store);
		await flushPromises();
		await quickAdd(wrapper, 'Buy milk');

		expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Buy milk' }));
		expect(wrapper.text()).toContain('Buy milk');
	});

	it('sends a complete body so the queued create carries every field', async () => {
		const store = fakeStore({ cached: [] });

		const wrapper = mountView(store);
		await flushPromises();
		await quickAdd(wrapper, 'Buy milk');

		expect(store.create).toHaveBeenCalledWith({
			title: 'Buy milk',
			notes: null,
			due_at: null,
			completed_at: null,
		});
	});

	it('clears the input after adding', async () => {
		const wrapper = mountView(fakeStore({ cached: [] }));
		await flushPromises();
		await quickAdd(wrapper, 'Buy milk');

		expect(wrapper.get('input[aria-label="New task"]').element.value).toBe('');
	});

	it('ignores an empty title', async () => {
		const store = fakeStore({ cached: [] });

		const wrapper = mountView(store);
		await flushPromises();
		await quickAdd(wrapper, '   ');

		expect(store.create).not.toHaveBeenCalled();
	});
});

describe('completing', () => {
	it('completes a task offline through the store, not the API action', async () => {
		setOnline(false);
		const store = fakeStore({ cached: [task('1', 'Pay rent')] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('input[type="checkbox"]').trigger('change');
		await flushPromises();

		expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
	});

	it('reopens a completed task', async () => {
		const store = fakeStore({ cached: [task('1', 'Pay rent', { completed_at: '2026-07-30T10:00:00Z' })] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('input[type="checkbox"]').trigger('change');
		await flushPromises();

		expect(store.reopen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
		expect(store.complete).not.toHaveBeenCalled();
	});

	it('splits open tasks from completed ones', async () => {
		const store = fakeStore({
			cached: [task('1', 'Open one'), task('2', 'Done one', { completed_at: '2026-07-30T10:00:00Z' })],
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Completed');
	});
});

describe('editing', () => {
	it('saves a full body, carrying completed_at so the task does not reopen', async () => {
		// A PUT that omitted completed_at would silently reopen the task.
		const completed = '2026-07-30T10:00:00Z';
		const store = fakeStore({ cached: [task('1', 'Pay rent', { completed_at: completed })] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('button.js-edit').trigger('click');
		await wrapper.get('.modal input[type="text"]').setValue('Pay the rent');
		await wrapper.get('.modal form').trigger('submit.prevent');
		await flushPromises();

		expect(store.update).toHaveBeenCalledWith('1', {
			title: 'Pay the rent',
			notes: null,
			due_at: null,
			completed_at: completed,
		});
	});

	it('closes the dialog on cancel without saving', async () => {
		const store = fakeStore({ cached: [task('1', 'Pay rent')] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('button.js-edit').trigger('click');
		await wrapper.get('button.js-cancel-edit').trigger('click');

		expect(wrapper.find('.modal').exists()).toBe(false);
		expect(store.update).not.toHaveBeenCalled();
	});
});

describe('deleting', () => {
	it('removes the task once the deletion is confirmed', async () => {
		const store = fakeStore({ cached: [task('1', 'Pay rent')] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('button.js-delete').trigger('click');
		await wrapper.getComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm');
		await flushPromises();

		expect(store.remove).toHaveBeenCalledWith('1');
	});

	it('keeps the task when the deletion is cancelled', async () => {
		const store = fakeStore({ cached: [task('1', 'Pay rent')] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('button.js-delete').trigger('click');
		await wrapper.getComponent({ name: 'ConfirmDialog' }).vm.$emit('cancel');
		await flushPromises();

		expect(store.remove).not.toHaveBeenCalled();
	});
});

describe('sync failures', () => {
	it('returns to the in-scope login on a 401', async () => {
		const store = fakeStore({
			cached: [],
			flush: vi.fn(async () => {
				throw Object.assign(new Error('unauthorized'), { status: 401 });
			}),
		});

		mountView(store);
		await flushPromises();

		expect(replaceMock).toHaveBeenCalledWith('/login');
	});

	it('tells the user when the server rejected one of their changes', async () => {
		// The op is out of the queue by now, so without this the edit would just
		// silently not exist.
		const store = fakeStore({
			cached: [],
			flush: vi.fn(async () => ({
				rejected: [{ op: { id: 'op-1', payload: { title: 'Bad task' } }, error: { status: 422 } }],
				stopped: null,
			})),
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Bad task');
		expect(wrapper.text()).toContain('rejected');
	});

	it('keeps showing the cached list when a sync fails', async () => {
		const store = fakeStore({
			cached: [task('1', 'Pay rent')],
			refresh: vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Pay rent');
		expect(wrapper.get('.error').text()).toContain('Could not sync');
	});
});

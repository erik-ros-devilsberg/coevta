import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { pushMock, replaceMock } = vi.hoisted(() => ({ pushMock: vi.fn(), replaceMock: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock, replace: replaceMock }) }));

import ContactsListView from './ContactsListView.vue';

const contact = (id, display_name, extra = {}) => ({ id, display_name, ...extra });

function fakeStore({ cached = [], refresh, flush, pending = [] } = {}) {
	return {
		cached: vi.fn(async () => cached),
		refresh: refresh ?? vi.fn(async () => cached),
		flush: flush ?? vi.fn(async () => ({ rejected: [], stopped: null })),
		pendingIds: vi.fn(async () => new Set(pending)),
		pendingCount: vi.fn(async () => pending.length),
		get: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
	};
}

function mountView(store) {
	return mount(ContactsListView, { props: { store }, global: { stubs: { RouterLink: true } } });
}

// jsdom reports navigator.onLine as true; flip it per test.
function setOnline(value) {
	Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
	pushMock.mockReset();
	replaceMock.mockReset();
	setOnline(true);
});

describe('loading', () => {
	it('renders the cached contacts before the network responds', async () => {
		// The whole point of the offline layer: the list paints from the device.
		let release;
		const slow = new Promise((resolve) => {
			release = resolve;
		});
		const store = fakeStore({ cached: [contact('1', 'Ada')], refresh: vi.fn(() => slow) });

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Ada');

		store.cached.mockResolvedValue([contact('1', 'Ada'), contact('2', 'Zoe')]);
		release();
		await flushPromises();
		expect(wrapper.text()).toContain('Zoe');
	});

	it('refreshes from the server when online', async () => {
		const store = fakeStore({ cached: [] });

		mountView(store);
		await flushPromises();

		expect(store.refresh).toHaveBeenCalled();
	});

	it('does not hit the network when offline', async () => {
		setOnline(false);
		const store = fakeStore({ cached: [contact('1', 'Ada')] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(store.refresh).not.toHaveBeenCalled();
		expect(store.flush).not.toHaveBeenCalled();
		expect(wrapper.text()).toContain('Ada');
	});

	it('pushes queued changes before pulling the server\'s view', async () => {
		// Refreshing first would reconcile against a server that has not seen the
		// queued edits yet, and briefly show stale data.
		const order = [];
		const store = fakeStore({ cached: [] });
		store.flush.mockImplementation(async () => {
			order.push('flush');
			return { rejected: [], stopped: null };
		});
		store.refresh.mockImplementation(async () => {
			order.push('refresh');
			return [];
		});

		mountView(store);
		await flushPromises();

		expect(order).toEqual(['flush', 'refresh']);
	});

	it('keeps showing cached contacts when the refresh fails', async () => {
		const store = fakeStore({
			cached: [contact('1', 'Ada')],
			refresh: vi.fn(async () => {
				throw new Error('network');
			}),
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Ada');
		expect(wrapper.find('.error').exists()).toBe(true);
	});

	it('redirects to the in-scope login on a 401', async () => {
		const store = fakeStore({
			cached: [],
			refresh: vi.fn(async () => {
				throw Object.assign(new Error('unauthenticated'), { status: 401 });
			}),
		});

		mountView(store);
		await flushPromises();

		expect(replaceMock).toHaveBeenCalledWith('/login');
	});

	it('shows an empty state when there are no contacts', async () => {
		const wrapper = mountView(fakeStore({ cached: [] }));
		await flushPromises();

		expect(wrapper.text()).toContain('No contacts yet.');
	});
});

describe('connection state', () => {
	it('tells the user when it is offline', async () => {
		setOnline(false);
		const wrapper = mountView(fakeStore({ cached: [] }));
		await flushPromises();

		expect(wrapper.get('.conn').text()).toContain('Offline');
	});

	it('reacts to the connection dropping while open', async () => {
		const wrapper = mountView(fakeStore({ cached: [] }));
		await flushPromises();
		expect(wrapper.get('.conn').text()).toContain('Online');

		setOnline(false);
		globalThis.dispatchEvent(new Event('offline'));
		await flushPromises();

		expect(wrapper.get('.conn').text()).toContain('Offline');
	});

	it('still lets you create a contact while offline', async () => {
		// Offline-first, not offline-tolerant: the write goes to the device and
		// the outbox, so there is nothing to disable.
		setOnline(false);
		const wrapper = mountView(fakeStore({ cached: [contact('1', 'Ada')] }));
		await flushPromises();

		expect(wrapper.get('button.btn--primary').attributes('disabled')).toBeUndefined();
	});

	it('syncs as soon as the connection returns', async () => {
		setOnline(false);
		const store = fakeStore({ cached: [] });
		mountView(store);
		await flushPromises();
		expect(store.flush).not.toHaveBeenCalled();

		setOnline(true);
		globalThis.dispatchEvent(new Event('online'));
		await flushPromises();

		expect(store.flush).toHaveBeenCalled();
	});
});

describe('pending changes', () => {
	it('reports how many changes are waiting to sync', async () => {
		const wrapper = mountView(fakeStore({ cached: [contact('1', 'Ada')], pending: ['1'] }));
		await flushPromises();

		expect(wrapper.get('.conn').text()).toContain('1 unsynced change');
	});

	it('pluralises the pending count', async () => {
		const wrapper = mountView(fakeStore({ cached: [contact('1', 'Ada'), contact('2', 'Zoe')], pending: ['1', '2'] }));
		await flushPromises();

		expect(wrapper.get('.conn').text()).toContain('2 unsynced changes');
	});

	it('says nothing when everything is synced', async () => {
		const wrapper = mountView(fakeStore({ cached: [contact('1', 'Ada')] }));
		await flushPromises();

		expect(wrapper.find('.conn__pending').exists()).toBe(false);
	});

	it('marks the contacts that have unsynced changes', async () => {
		const wrapper = mountView(fakeStore({ cached: [contact('1', 'Ada'), contact('2', 'Zoe')], pending: ['2'] }));
		await flushPromises();

		const rows = wrapper.findAll('.list__row');
		expect(rows[0].find('.badge-pending').exists()).toBe(false);
		expect(rows[1].find('.badge-pending').exists()).toBe(true);
	});

	it('surfaces a change the server rejected, rather than dropping it silently', async () => {
		// The op is gone from the queue by now; if the UI stays quiet the user
		// believes an edit stuck when it did not.
		const store = fakeStore({ cached: [] });
		store.flush.mockResolvedValue({
			rejected: [{ op: { id: 'op-1', payload: { display_name: 'Ada' } }, error: { status: 422 } }],
			stopped: null,
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('rejected by the server');
		expect(wrapper.text()).toContain('Ada');
	});
});

describe('search', () => {
	const store = () => fakeStore({ cached: [contact('1', 'Ada Lovelace', { email: 'ada@example.test' }), contact('2', 'Zoe')] });

	it('filters by name', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		await wrapper.get('input[type="search"]').setValue('zoe');

		expect(wrapper.text()).toContain('Zoe');
		expect(wrapper.text()).not.toContain('Ada Lovelace');
	});

	it('filters by email', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		await wrapper.get('input[type="search"]').setValue('ada@example');

		expect(wrapper.text()).toContain('Ada Lovelace');
	});

	it('reports when nothing matches', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		await wrapper.get('input[type="search"]').setValue('nobody');

		expect(wrapper.text()).toContain('No contacts match');
	});
});

describe('grouping and the scrubber', () => {
	const store = () => fakeStore({ cached: [contact('1', 'Ada'), contact('2', 'Amy'), contact('3', 'Zoe')] });

	it('groups the list under letter headings', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		expect(wrapper.findAll('.list__header').map((h) => h.text())).toEqual(['A', 'Z']);
	});

	it('renders the full alphabet on the scrubber, A first and # last', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		const letters = wrapper.findAll('.scrubber__letter').map((b) => b.text());
		expect(letters).toHaveLength(27);
		expect(letters[0]).toBe('A');
		expect(letters.at(-1)).toBe('#');
	});

	it('dims letters that have no contacts', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		const byLetter = (letter) => wrapper.findAll('.scrubber__letter').find((b) => b.text() === letter);
		expect(byLetter('B').classes()).toContain('is-empty');
		expect(byLetter('A').classes()).not.toContain('is-empty');
	});

	it('scrolls to the letter when it is tapped', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		const target = wrapper.findAll('.list__header').find((h) => h.text() === 'Z');
		const scrollIntoView = vi.fn();
		target.element.scrollIntoView = scrollIntoView;

		await wrapper.findAll('.scrubber__letter').find((b) => b.text() === 'Z').trigger('click');

		expect(scrollIntoView).toHaveBeenCalled();
		expect(wrapper.findAll('.scrubber__letter').find((b) => b.text() === 'Z').classes()).toContain('is-active');
	});

	it('jumps forward to the next populated letter when an empty one is tapped', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		const target = wrapper.findAll('.list__header').find((h) => h.text() === 'Z');
		target.element.scrollIntoView = vi.fn();

		// Nothing under M — a drag across the gap should still land somewhere.
		await wrapper.findAll('.scrubber__letter').find((b) => b.text() === 'M').trigger('click');

		expect(target.element.scrollIntoView).toHaveBeenCalled();
	});

	it('exposes the letter and its count to assistive tech', async () => {
		const wrapper = mountView(store());
		await flushPromises();

		const a = wrapper.findAll('.scrubber__letter').find((b) => b.text() === 'A');
		expect(a.attributes('aria-label')).toBe('A, 2 contacts');
		expect(wrapper.get('.scrubber').attributes('aria-label')).toBe('Jump to letter');
	});

	it('hides the scrubber when there are no contacts', async () => {
		const wrapper = mountView(fakeStore({ cached: [] }));
		await flushPromises();

		expect(wrapper.find('.scrubber').exists()).toBe(false);
	});
});

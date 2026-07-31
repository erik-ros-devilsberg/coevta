import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { pushMock, replaceMock } = vi.hoisted(() => ({ pushMock: vi.fn(), replaceMock: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock, replace: replaceMock }) }));

import CalendarMonthView from './CalendarMonthView.vue';
import { dayKeyFor } from '../lib/month.js';

// Anchored to a fixed month so cell positions are stable; the view reads "today"
// from the clock, so the clock is faked rather than the component parameterised.
const TODAY = new Date('2026-08-12T09:00:00.000Z');

const event = (id, title, extra = {}) => ({
	id,
	title,
	location: null,
	all_day: false,
	start_at: '2026-08-12T10:00:00.000Z',
	end_at: '2026-08-12T11:00:00.000Z',
	...extra,
});

function fakeStore({ cached = [], refresh, flush, pending = [] } = {}) {
	const state = [...cached];

	// The real store returns a freshly sorted array on every read; returning the
	// same array reference here would mutate what the component already holds and
	// Vue would never see the change.
	return {
		cached: vi.fn(async () => [...state]),
		refresh: refresh ?? vi.fn(async () => [...state]),
		flush: flush ?? vi.fn(async () => ({ rejected: [], stopped: null })),
		pendingIds: vi.fn(async () => new Set(pending)),
		pendingCount: vi.fn(async () => pending.length),
		get: vi.fn(async (id) => state.find((e) => e.id === id) ?? null),
		create: vi.fn(async (payload) => {
			const record = { id: 'local-1', ...payload };
			state.push(record);
			return record;
		}),
		update: vi.fn(async (id, payload) => ({ id, ...payload })),
		remove: vi.fn(async (id) => {
			state.splice(state.findIndex((e) => e.id === id), 1);
		}),
		dayKey: dayKeyFor,
	};
}

function mountView(store) {
	return mount(CalendarMonthView, { props: { store }, global: { stubs: { RouterLink: true } } });
}

function setOnline(value) {
	Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

/** The grid cell for a day of the anchored month. */
function cell(wrapper, key) {
	return wrapper.get(`[data-day="${key}"]`);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(TODAY);
	pushMock.mockReset();
	replaceMock.mockReset();
	setOnline(true);
});

describe('the grid', () => {
	it('renders the current month from cached events with no network', async () => {
		setOnline(false);
		const store = fakeStore({ cached: [event('1', 'Standup')] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Standup');
		expect(store.refresh).not.toHaveBeenCalled();
		expect(store.flush).not.toHaveBeenCalled();
	});

	it('names the month being shown', async () => {
		const wrapper = mountView(fakeStore());
		await flushPromises();

		expect(wrapper.text()).toContain('2026');
	});

	it('places an event on its own day cell', async () => {
		const store = fakeStore({ cached: [event('1', 'Standup')] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(cell(wrapper, dayKeyFor(event('1', 'Standup'))).text()).toContain('Standup');
	});

	it('puts an all-day event on its calendar date rather than a timezone-shifted one', async () => {
		const allDay = event('1', 'Holiday', { all_day: true, start_at: '2026-08-12T00:00:00.000Z', end_at: '2026-08-12T23:59:59.000Z' });
		const store = fakeStore({ cached: [allDay] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(cell(wrapper, '2026-08-12').text()).toContain('Holiday');
	});

	it('distinguishes all-day events from timed ones', async () => {
		const store = fakeStore({
			cached: [
				event('1', 'Timed'),
				event('2', 'Holiday', { all_day: true, start_at: '2026-08-12', end_at: '2026-08-12' }),
			],
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.findAll('.cal-chip--allday')).toHaveLength(1);
	});
});

describe('navigation', () => {
	it('moves to the previous and next month offline', async () => {
		setOnline(false);
		const wrapper = mountView(fakeStore());
		await flushPromises();

		const startLabel = wrapper.get('.cal-head h1').text();

		await wrapper.get('button[aria-label="Next month"]').trigger('click');
		const next = wrapper.get('.cal-head h1').text();
		expect(next).not.toBe(startLabel);

		await wrapper.get('button[aria-label="Previous month"]').trigger('click');
		expect(wrapper.get('.cal-head h1').text()).toBe(startLabel);
	});

	it('returns to the current month with Today', async () => {
		const wrapper = mountView(fakeStore());
		await flushPromises();

		const startLabel = wrapper.get('.cal-head h1').text();
		await wrapper.get('button[aria-label="Next month"]').trigger('click');
		await wrapper.get('button.js-today').trigger('click');

		expect(wrapper.get('.cal-head h1').text()).toBe(startLabel);
	});

	it('shows a month with no events without complaint', async () => {
		const wrapper = mountView(fakeStore({ cached: [] }));
		await flushPromises();

		await wrapper.get('button[aria-label="Next month"]').trigger('click');

		expect(wrapper.findAll('.cal-cell').length).toBeGreaterThan(0);
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
		const store = fakeStore({ cached: [event('1', 'Standup')], pending: ['1'] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.get('.conn').text()).toContain('1 unsynced change');
	});

	it('marks an unsynced event on the grid', async () => {
		const store = fakeStore({ cached: [event('1', 'Standup')], pending: ['1'] });

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.find('.cal-chip--pending').exists()).toBe(true);
	});
});

describe('creating', () => {
	it('opens the form on the day that was clicked', async () => {
		const wrapper = mountView(fakeStore());
		await flushPromises();

		await cell(wrapper, '2026-08-20').trigger('click');

		expect(wrapper.get('.modal').text()).toContain('New event');
		expect(wrapper.get('.modal input[type="datetime-local"]').element.value).toContain('2026-08-20');
	});

	it('creates an event offline and shows it immediately', async () => {
		setOnline(false);
		const store = fakeStore();

		const wrapper = mountView(store);
		await flushPromises();
		await cell(wrapper, '2026-08-20').trigger('click');
		await wrapper.get('.modal input[type="text"]').setValue('Dentist');
		await wrapper.get('.modal form').trigger('submit.prevent');
		await flushPromises();

		expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dentist' }));
		expect(wrapper.text()).toContain('Dentist');
	});

	it('switches the date inputs when all-day is ticked', async () => {
		const wrapper = mountView(fakeStore());
		await flushPromises();
		await cell(wrapper, '2026-08-20').trigger('click');

		await wrapper.get('.modal input[type="checkbox"]').setValue(true);

		expect(wrapper.get('.modal input[type="date"]').exists()).toBe(true);
	});
});

describe('editing and deleting', () => {
	it('opens an existing event and saves the edit', async () => {
		const store = fakeStore({ cached: [event('1', 'Standup')] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('.cal-chip').trigger('click');
		await wrapper.get('.modal input[type="text"]').setValue('Standup (moved)');
		await wrapper.get('.modal form').trigger('submit.prevent');
		await flushPromises();

		expect(store.update).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'Standup (moved)' }));
	});

	it('does not open the create form when a chip is clicked', async () => {
		// The chip sits inside the day cell, so its click must not fall through.
		const store = fakeStore({ cached: [event('1', 'Standup')] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('.cal-chip').trigger('click');

		expect(wrapper.get('.modal').text()).toContain('Edit event');
		expect(store.create).not.toHaveBeenCalled();
	});

	it('deletes an event once the deletion is confirmed', async () => {
		const store = fakeStore({ cached: [event('1', 'Standup')] });

		const wrapper = mountView(store);
		await flushPromises();
		await wrapper.get('.cal-chip').trigger('click');
		await wrapper.get('button.js-delete').trigger('click');
		await wrapper.getComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm');
		await flushPromises();

		expect(store.remove).toHaveBeenCalledWith('1');
	});
});

describe('sync failures', () => {
	it('returns to the in-scope login on a 401', async () => {
		const store = fakeStore({
			flush: vi.fn(async () => {
				throw Object.assign(new Error('unauthorized'), { status: 401 });
			}),
		});

		mountView(store);
		await flushPromises();

		expect(replaceMock).toHaveBeenCalledWith('/login');
	});

	it('tells the user when the server rejected one of their changes', async () => {
		const store = fakeStore({
			flush: vi.fn(async () => ({
				rejected: [{ op: { id: 'op-1', payload: { title: 'Bad event' } }, error: { status: 422 } }],
				stopped: null,
			})),
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Bad event');
		expect(wrapper.text()).toContain('rejected');
	});

	it('keeps showing the cached grid when a sync fails', async () => {
		const store = fakeStore({
			cached: [event('1', 'Standup')],
			refresh: vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		});

		const wrapper = mountView(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Standup');
		expect(wrapper.get('.error').text()).toContain('Could not sync');
	});
});

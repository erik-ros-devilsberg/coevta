import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { replaceMock, routeParams } = vi.hoisted(() => ({ replaceMock: vi.fn(), routeParams: { value: { id: 'srv-1' } } }));
vi.mock('vue-router', () => ({
	useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
	useRoute: () => ({ params: routeParams.value }),
}));

import ContactDetailView from './ContactDetailView.vue';

function fakeStore(existing) {
	return {
		get: vi.fn(async () => existing),
		remove: vi.fn(async () => undefined),
	};
}

const mountDetail = (store) => mount(ContactDetailView, { props: { store }, global: { stubs: { RouterLink: true } } });

function setOnline(value) {
	Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
	replaceMock.mockReset();
	routeParams.value = { id: 'srv-1' };
	setOnline(true);
});

describe('reading', () => {
	it('reads the contact from the device, so detail works offline', async () => {
		setOnline(false);
		const store = fakeStore({ id: 'srv-1', display_name: 'Ada Lovelace', email: 'ada@example.test' });

		const wrapper = mountDetail(store);
		await flushPromises();

		expect(wrapper.text()).toContain('Ada Lovelace');
		expect(wrapper.text()).toContain('ada@example.test');
	});

	it('says so when the contact is not on this device', async () => {
		const wrapper = mountDetail(fakeStore(null));
		await flushPromises();

		expect(wrapper.text()).toContain('not on this device');
	});

	it('tells the user their changes will sync later when offline', async () => {
		setOnline(false);
		const wrapper = mountDetail(fakeStore({ id: 'srv-1', display_name: 'Ada' }));
		await flushPromises();

		expect(wrapper.text()).toContain('will sync when you reconnect');
	});
});

describe('deleting', () => {
	it('asks before deleting', async () => {
		const store = fakeStore({ id: 'srv-1', display_name: 'Ada' });

		const wrapper = mountDetail(store);
		await flushPromises();
		await wrapper.findAll('button').find((b) => b.text() === 'Delete').trigger('click');

		expect(store.remove).not.toHaveBeenCalled();
		expect(wrapper.find('.modal').exists()).toBe(true);
	});

	it('deletes while offline and returns to the list', async () => {
		setOnline(false);
		const store = fakeStore({ id: 'srv-1', display_name: 'Ada' });

		const wrapper = mountDetail(store);
		await flushPromises();
		await wrapper.findAll('button').find((b) => b.text() === 'Delete').trigger('click');
		await wrapper.get('.modal .btn--primary').trigger('click');
		await flushPromises();

		expect(store.remove).toHaveBeenCalledWith('srv-1');
		expect(replaceMock).toHaveBeenCalledWith('/');
	});

	it('does not delete when the confirmation is dismissed', async () => {
		const store = fakeStore({ id: 'srv-1', display_name: 'Ada' });

		const wrapper = mountDetail(store);
		await flushPromises();
		await wrapper.findAll('button').find((b) => b.text() === 'Delete').trigger('click');
		await wrapper.get('.modal .btn--ghost').trigger('click');
		await flushPromises();

		expect(store.remove).not.toHaveBeenCalled();
	});
});

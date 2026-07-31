import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { replaceMock, backMock, routeParams } = vi.hoisted(() => ({
	replaceMock: vi.fn(),
	backMock: vi.fn(),
	routeParams: { value: {} },
}));
vi.mock('vue-router', () => ({
	useRouter: () => ({ replace: replaceMock, back: backMock, push: vi.fn() }),
	useRoute: () => ({ params: routeParams.value }),
}));

import ContactFormView from './ContactFormView.vue';

function fakeStore(existing = null) {
	return {
		get: vi.fn(async () => existing),
		create: vi.fn(async (payload) => ({ id: 'local-1', ...payload })),
		update: vi.fn(async (id, payload) => ({ id, ...payload })),
	};
}

const mountForm = (store) => mount(ContactFormView, { props: { store }, global: { stubs: { RouterLink: true } } });

function setOnline(value) {
	Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
	replaceMock.mockReset();
	backMock.mockReset();
	routeParams.value = {};
	setOnline(true);
});

describe('creating', () => {
	it('saves a new contact while offline, with no network call', async () => {
		setOnline(false);
		const store = fakeStore();

		const wrapper = mountForm(store);
		await wrapper.get('input[type="text"]').setValue('Ada Lovelace');
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Ada Lovelace' }));
	});

	it('sends empty optional fields as null, not empty strings', async () => {
		// The API's nullable rules reject '' for typed fields like email.
		const store = fakeStore();

		const wrapper = mountForm(store);
		await wrapper.get('input[type="text"]').setValue('Ada');
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Ada', email: null, phone: null }));
	});

	it('returns to the list rather than a detail route whose id is about to change', async () => {
		// A contact created offline holds a temporary id until sync swaps in the
		// server's — routing to it would break the moment it syncs.
		const wrapper = mountForm(fakeStore());
		await wrapper.get('input[type="text"]').setValue('Ada');
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(replaceMock).toHaveBeenCalledWith('/');
	});
});

describe('editing', () => {
	beforeEach(() => {
		routeParams.value = { id: 'srv-1' };
	});

	it('loads the existing contact from the device', async () => {
		const wrapper = mountForm(fakeStore({ id: 'srv-1', display_name: 'Ada', email: 'ada@example.test' }));
		await flushPromises();

		expect(wrapper.get('input[type="text"]').element.value).toBe('Ada');
		expect(wrapper.get('input[type="email"]').element.value).toBe('ada@example.test');
	});

	it('saves an edit while offline, with no network call', async () => {
		setOnline(false);
		const store = fakeStore({ id: 'srv-1', display_name: 'Ada' });

		const wrapper = mountForm(store);
		await flushPromises();
		await wrapper.get('input[type="text"]').setValue('Ada Lovelace');
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(store.update).toHaveBeenCalledWith('srv-1', expect.objectContaining({ display_name: 'Ada Lovelace' }));
		expect(store.create).not.toHaveBeenCalled();
	});

	it('sends every field, because the API\'s PUT is a full replacement', async () => {
		// Omitting a field would wipe it server-side.
		const store = fakeStore({ id: 'srv-1', display_name: 'Ada', phone: '123', organization: 'Analytical Engines' });

		const wrapper = mountForm(store);
		await flushPromises();
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(store.update).toHaveBeenCalledWith(
			'srv-1',
			expect.objectContaining({ display_name: 'Ada', phone: '123', organization: 'Analytical Engines' }),
		);
	});

	it('goes back to the contact after saving', async () => {
		const wrapper = mountForm(fakeStore({ id: 'srv-1', display_name: 'Ada' }));
		await flushPromises();
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(replaceMock).toHaveBeenCalledWith('/srv-1');
	});
});

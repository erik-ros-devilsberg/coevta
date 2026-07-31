import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { loginMock, pushMock } = vi.hoisted(() => ({ loginMock: vi.fn(), pushMock: vi.fn() }));
vi.mock('../../../shared/lib/auth.js', () => ({ login: loginMock }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock, replace: vi.fn() }) }));

import ContactsLoginView from './ContactsLoginView.vue';

const mountOpts = { global: { stubs: { RouterLink: true } } };

function setOnline(value) {
	Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

async function submitCredentials(wrapper, password = 'secret') {
	await wrapper.get('input[type="email"]').setValue('a@b.test');
	await wrapper.get('input[type="password"]').setValue(password);
	await wrapper.get('form').trigger('submit.prevent');
	await flushPromises();
}

beforeEach(() => {
	loginMock.mockReset();
	pushMock.mockReset();
	setOnline(true);
});

describe('ContactsLoginView', () => {
	it('signs in and lands on the list, staying inside the app scope', async () => {
		loginMock.mockResolvedValue({ token: 't' });

		const wrapper = mount(ContactsLoginView, mountOpts);
		await submitCredentials(wrapper);

		expect(loginMock).toHaveBeenCalledWith('a@b.test', 'secret');
		// '/' is the list, relative to the /contacts/ router base — never an
		// absolute path that would navigate the installed app out of scope.
		expect(pushMock).toHaveBeenCalledWith('/');
	});

	it('reports bad credentials without navigating', async () => {
		loginMock.mockRejectedValue(Object.assign(new Error('nope'), { status: 401 }));

		const wrapper = mount(ContactsLoginView, mountOpts);
		await submitCredentials(wrapper, 'wrong');

		expect(wrapper.get('.error').text()).toContain('did not work');
		expect(pushMock).not.toHaveBeenCalled();
	});

	it('explains that signing in needs a connection rather than failing silently', async () => {
		setOnline(false);

		const wrapper = mount(ContactsLoginView, mountOpts);
		await submitCredentials(wrapper);

		// Auth is the one thing that genuinely cannot work offline.
		expect(wrapper.get('.error').text()).toContain('needs a connection');
		expect(loginMock).not.toHaveBeenCalled();
	});

	it('shows a generic error for a server failure', async () => {
		loginMock.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

		const wrapper = mount(ContactsLoginView, mountOpts);
		await submitCredentials(wrapper);

		expect(wrapper.get('.error').text()).toContain('Could not sign in');
	});
});

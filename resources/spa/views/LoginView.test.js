import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// Hoisted mocks (vi.mock is hoisted above imports).
const { loginMock, pushMock } = vi.hoisted(() => ({ loginMock: vi.fn(), pushMock: vi.fn() }));
vi.mock('../lib/auth.js', () => ({ login: loginMock }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock, replace: vi.fn() }) }));

import LoginView from './LoginView.vue';

const mountOpts = { global: { stubs: { RouterLink: true } } };

beforeEach(() => {
	loginMock.mockReset();
	pushMock.mockReset();
});

describe('LoginView', () => {
	it('logs in and routes to the dashboard on success', async () => {
		loginMock.mockResolvedValue({ token: 't' });

		const wrapper = mount(LoginView, mountOpts);
		await wrapper.get('input[type="email"]').setValue('a@b.test');
		await wrapper.get('input[type="password"]').setValue('secret');
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(loginMock).toHaveBeenCalledWith('a@b.test', 'secret');
		expect(pushMock).toHaveBeenCalledWith('/dashboard');
		expect(wrapper.find('.error').exists()).toBe(false);
	});

	it('shows a generic error and does not navigate on failure', async () => {
		loginMock.mockRejectedValue(new Error('bad'));

		const wrapper = mount(LoginView, mountOpts);
		await wrapper.get('input[type="email"]').setValue('a@b.test');
		await wrapper.get('input[type="password"]').setValue('wrong');
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(wrapper.find('.error').exists()).toBe(true);
		expect(pushMock).not.toHaveBeenCalled();
	});
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const { requestResetMock, resetPasswordMock, pushMock, queryRef } = vi.hoisted(() => ({
	requestResetMock: vi.fn(),
	resetPasswordMock: vi.fn(),
	pushMock: vi.fn(),
	queryRef: { current: {} },
}));

vi.mock('../lib/passwords.js', () => ({
	requestReset: requestResetMock,
	resetPassword: resetPasswordMock,
}));
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn() }),
	useRoute: () => ({ query: queryRef.current }),
}));

import ResetPasswordView from './ResetPasswordView.vue';

const mountOpts = { global: { stubs: { RouterLink: true } } };

async function submitNewPassword(wrapper) {
	const fields = wrapper.findAll('input[type="password"]');
	await fields[0].setValue('new-secret');
	await fields[1].setValue('new-secret');
	await wrapper.get('form').trigger('submit.prevent');
	await flushPromises();
}

beforeEach(() => {
	requestResetMock.mockReset();
	resetPasswordMock.mockReset();
	pushMock.mockReset();
	queryRef.current = {};
});

describe('ResetPasswordView', () => {
	it('lands on the confirmation page after a successful reset', async () => {
		queryRef.current = { token: 'tok', email: 'a@b.test' };
		resetPasswordMock.mockResolvedValue({ message: 'ok' });

		const wrapper = mount(ResetPasswordView, mountOpts);
		await submitNewPassword(wrapper);

		// Not /login: the user may have started at a PWA, so the confirmation
		// page is what tells them the account is signed out everywhere and
		// offers a way back to the app they came from.
		expect(pushMock).toHaveBeenCalledWith('/password-reset-complete');
	});

	it('reports an expired token without navigating', async () => {
		queryRef.current = { token: 'stale', email: 'a@b.test' };
		resetPasswordMock.mockRejectedValue(Object.assign(new Error('nope'), { status: 422 }));

		const wrapper = mount(ResetPasswordView, mountOpts);
		await submitNewPassword(wrapper);

		expect(wrapper.get('.error').text()).toContain('invalid or has expired');
		expect(pushMock).not.toHaveBeenCalled();
	});

	it('asks for an email and gives nothing away when no token is present', async () => {
		requestResetMock.mockResolvedValue({ message: 'ok' });

		const wrapper = mount(ResetPasswordView, mountOpts);
		await wrapper.get('input[type="email"]').setValue('a@b.test');
		await wrapper.get('form').trigger('submit.prevent');
		await flushPromises();

		expect(requestResetMock).toHaveBeenCalledWith('a@b.test');
		// Same message whether or not the address is registered.
		expect(wrapper.get('.notice').text()).toContain('If that email address is registered');
	});
});

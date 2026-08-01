import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

const { clearTokenMock } = vi.hoisted(() => ({ clearTokenMock: vi.fn() }));
vi.mock('../../shared/lib/api.js', () => ({ clearToken: clearTokenMock }));

import PasswordResetCompleteView from './PasswordResetCompleteView.vue';

const mountOpts = { global: { stubs: { RouterLink: true } } };

beforeEach(() => {
	clearTokenMock.mockReset();
});

describe('PasswordResetCompleteView', () => {
	it('drops the local token so the account-wide sign-out is true here too', () => {
		mount(PasswordResetCompleteView, mountOpts);

		// The server already revoked every token. The origin-wide localStorage
		// copy is shared by all three PWAs, and the route guards only check that
		// a token exists — leaving it behind would half-open an app before the
		// first request 401s.
		expect(clearTokenMock).toHaveBeenCalled();
	});

	it('says the reset covers the whole account, not one app', () => {
		const wrapper = mount(PasswordResetCompleteView, mountOpts);

		expect(wrapper.text()).toContain('account');
		expect(wrapper.text()).toContain('signed out');
	});

	it('offers a way back into each app', () => {
		const wrapper = mount(PasswordResetCompleteView, mountOpts);

		// Plain anchors: each app is a separate installable PWA with its own
		// service worker scope, so these are real navigations out of the SPA.
		for (const path of ['/contacts/', '/tasks/', '/calendar/']) {
			expect(wrapper.find(`a[href="${path}"]`).exists()).toBe(true);
		}
	});

	it('links back to the SPA login', () => {
		const wrapper = mount(PasswordResetCompleteView, mountOpts);

		// In-SPA navigation, so this one stays a router-link (stubbed here).
		expect(wrapper.find('router-link-stub[to="/login"]').exists()).toBe(true);
	});
});

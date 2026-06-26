import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const h = vi.hoisted(() => ({
	listTasks: vi.fn(),
	createTask: vi.fn(),
	updateTask: vi.fn(),
	completeTask: vi.fn(),
	removeTask: vi.fn(),
}));

vi.mock('../lib/tasks.js', () => ({
	listTasks: h.listTasks,
	createTask: h.createTask,
	updateTask: h.updateTask,
	completeTask: h.completeTask,
	removeTask: h.removeTask,
	buildTaskBody: (x) => x,
}));
vi.mock('../lib/datetime.js', () => ({ formatDueForDisplay: (v) => v ?? '' }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import TasksView from './TasksView.vue';

const mountOpts = { global: { stubs: { NavBar: true, ConfirmDialog: true } } };

beforeEach(() => {
	Object.values(h).forEach((m) => m.mockReset());
});

describe('TasksView', () => {
	it('shows the empty state when there are no tasks', async () => {
		h.listTasks.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });

		const wrapper = mount(TasksView, mountOpts);
		await flushPromises();

		expect(wrapper.text()).toContain('Nothing to do');
	});

	it('quick-adds a task and reloads the list', async () => {
		h.listTasks.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
		h.createTask.mockResolvedValue({});

		const wrapper = mount(TasksView, mountOpts);
		await flushPromises();

		await wrapper.get('input[aria-label="New task"]').setValue('Buy milk');
		await wrapper.get('form.toolbar').trigger('submit.prevent');
		await flushPromises();

		expect(h.createTask).toHaveBeenCalledWith({ title: 'Buy milk' });
		// once on mount, once after the add
		expect(h.listTasks).toHaveBeenCalledTimes(2);
	});

	it('completes an open task via the no-body complete action', async () => {
		h.listTasks.mockResolvedValue({
			data: [{ id: '1', title: 'A', completed_at: null }],
			meta: { current_page: 1, last_page: 1 },
		});
		h.completeTask.mockResolvedValue({});

		const wrapper = mount(TasksView, mountOpts);
		await flushPromises();

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await flushPromises();

		expect(h.completeTask).toHaveBeenCalledWith('1');
	});
});

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import AlphabetScrubber from './AlphabetScrubber.vue';
import { buildIndex, sortContacts } from '../lib/alphabet.js';

const index = buildIndex(sortContacts([
	{ id: '1', display_name: 'Ada' },
	{ id: '2', display_name: 'Mia' },
	{ id: '3', display_name: 'Zoe' },
]));

// The track maths reads getBoundingClientRect, which jsdom always reports as
// zero. Pin a 270px-wide track: 27 letters, so each letter is exactly 10px.
function mountScrubber(props = {}) {
	const wrapper = mount(AlphabetScrubber, { props: { index, active: 'A', ...props } });

	wrapper.get('.scrubber').element.getBoundingClientRect = () => ({ left: 0, width: 270 });

	return wrapper;
}

const jumps = (wrapper) => wrapper.emitted('jump')?.flat() ?? [];

// test-utils' trigger() cannot set clientX (jsdom exposes it as a getter), so
// pointer events are constructed and dispatched directly. jsdom has no
// PointerEvent, but a MouseEvent carries everything the handler reads.
function pointer(wrapper, type, clientX, pointerId = 1) {
	const event = new MouseEvent(type, { clientX, bubbles: true });
	Object.defineProperty(event, 'pointerId', { value: pointerId });
	wrapper.get('.scrubber').element.dispatchEvent(event);

	return nextTick();
}

describe('pointer', () => {
	it('jumps to the letter under the pointer on press', async () => {
		const wrapper = mountScrubber();

		// 5px in — the first 10px slot, which is A.
		await pointer(wrapper, 'pointerdown', 5);

		expect(jumps(wrapper)).toEqual(['A']);
	});

	it('scrubs while dragging across the track', async () => {
		const wrapper = mountScrubber();

		await pointer(wrapper, 'pointerdown', 5);
		await pointer(wrapper, 'pointermove', 135);
		await pointer(wrapper, 'pointermove', 255);

		// 135/270 = halfway = N; 255/270 lands in the Z slot.
		expect(jumps(wrapper)).toEqual(['A', 'N', 'Z']);
	});

	it('ignores movement when the pointer is not held down', async () => {
		const wrapper = mountScrubber();

		await pointer(wrapper, 'pointermove', 135);

		expect(jumps(wrapper)).toEqual([]);
	});

	it('stops scrubbing once the pointer is released', async () => {
		const wrapper = mountScrubber();

		await pointer(wrapper, 'pointerdown', 5);
		await pointer(wrapper, 'pointerup', 5);
		await pointer(wrapper, 'pointermove', 265);

		expect(jumps(wrapper)).toEqual(['A']);
	});

	it('clamps a drag past the end of the track to the last letter', async () => {
		const wrapper = mountScrubber();

		await pointer(wrapper, 'pointerdown', 400);

		expect(jumps(wrapper)).toEqual(['#']);
	});

	it('captures the pointer so a finger sliding off the track keeps scrubbing', async () => {
		const wrapper = mountScrubber();
		const setPointerCapture = vi.fn();
		wrapper.get('.scrubber').element.setPointerCapture = setPointerCapture;

		await pointer(wrapper, 'pointerdown', 5, 7);

		expect(setPointerCapture).toHaveBeenCalledWith(7);
	});
});

describe('keyboard', () => {
	const letterButton = (wrapper, letter) => wrapper.findAll('.scrubber__letter').find((b) => b.text() === letter);

	it('steps right with the arrow key', async () => {
		const wrapper = mountScrubber({ active: 'M' });

		await letterButton(wrapper, 'M').trigger('keydown', { key: 'ArrowRight' });

		expect(jumps(wrapper)).toEqual(['N']);
	});

	it('steps left with the arrow key', async () => {
		const wrapper = mountScrubber({ active: 'M' });

		await letterButton(wrapper, 'M').trigger('keydown', { key: 'ArrowLeft' });

		expect(jumps(wrapper)).toEqual(['L']);
	});

	it('does not step past either end', async () => {
		const first = mountScrubber({ active: 'A' });
		await letterButton(first, 'A').trigger('keydown', { key: 'ArrowLeft' });
		expect(jumps(first)).toEqual(['A']);

		const last = mountScrubber({ active: '#' });
		await letterButton(last, '#').trigger('keydown', { key: 'ArrowRight' });
		expect(jumps(last)).toEqual(['#']);
	});

	it('jumps to either end with Home and End', async () => {
		const wrapper = mountScrubber({ active: 'M' });

		await letterButton(wrapper, 'M').trigger('keydown', { key: 'Home' });
		await letterButton(wrapper, 'M').trigger('keydown', { key: 'End' });

		expect(jumps(wrapper)).toEqual(['A', '#']);
	});

	it('leaves other keys alone', async () => {
		const wrapper = mountScrubber({ active: 'M' });

		await letterButton(wrapper, 'M').trigger('keydown', { key: 'Tab' });

		expect(jumps(wrapper)).toEqual([]);
	});
});

describe('accessibility', () => {
	it('marks the active letter for assistive tech', () => {
		const wrapper = mountScrubber({ active: 'M' });

		const active = wrapper.findAll('.scrubber__letter').find((b) => b.text() === 'M');
		expect(active.attributes('aria-current')).toBe('true');
		expect(wrapper.findAll('.scrubber__letter').find((b) => b.text() === 'A').attributes('aria-current')).toBeUndefined();
	});

	it('names each letter and how many contacts it holds, singular and plural', () => {
		const wrapper = mountScrubber();
		const label = (letter) => wrapper.findAll('.scrubber__letter').find((b) => b.text() === letter).attributes('aria-label');

		expect(label('A')).toBe('A, 1 contact');
		expect(label('B')).toBe('B, 0 contacts');
	});
});

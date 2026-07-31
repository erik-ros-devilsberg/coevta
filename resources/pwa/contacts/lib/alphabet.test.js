import { describe, it, expect } from 'vitest';

import {
	LETTERS,
	bucketFor,
	sortContacts,
	buildIndex,
	letterAtRatio,
	ratioForLetter,
	resolveJumpTarget,
} from './alphabet.js';

const contact = (display_name, id = display_name) => ({ id, display_name });

describe('LETTERS', () => {
	it('runs A on the left to Z on the right, with the non-alphabetic bucket last', () => {
		expect(LETTERS[0]).toBe('A');
		expect(LETTERS[25]).toBe('Z');
		expect(LETTERS[26]).toBe('#');
		expect(LETTERS).toHaveLength(27);
	});
});

describe('bucketFor', () => {
	it('buckets by the first letter of the display name', () => {
		expect(bucketFor(contact('Ada Lovelace'))).toBe('A');
		expect(bucketFor(contact('Grace Hopper'))).toBe('G');
	});

	it('is case-insensitive', () => {
		expect(bucketFor(contact('ada lovelace'))).toBe('A');
	});

	it('folds accents so Ålund and alund land under the same letter', () => {
		expect(bucketFor(contact('Ålund'))).toBe('A');
		expect(bucketFor(contact('alund'))).toBe('A');
		expect(bucketFor(contact('Émile Zola'))).toBe('E');
		expect(bucketFor(contact('Øystein'))).toBe('O');
	});

	it('buckets names that do not start with a letter under #', () => {
		expect(bucketFor(contact('1st National Bank'))).toBe('#');
		expect(bucketFor(contact('+31 6 12345678'))).toBe('#');
	});

	it('buckets a blank or missing display name under #', () => {
		expect(bucketFor(contact(''))).toBe('#');
		expect(bucketFor({ id: 'x' })).toBe('#');
		expect(bucketFor(contact('   '))).toBe('#');
	});

	it('ignores leading whitespace', () => {
		expect(bucketFor(contact('  Ada'))).toBe('A');
	});
});

describe('sortContacts', () => {
	it('sorts alphabetically, ignoring case', () => {
		const sorted = sortContacts([contact('grace'), contact('Ada'), contact('Bob')]);

		expect(sorted.map((c) => c.display_name)).toEqual(['Ada', 'Bob', 'grace']);
	});

	it('sorts accented names next to their unaccented equivalents', () => {
		const sorted = sortContacts([contact('Bob'), contact('Ålund'), contact('Ada')]);

		expect(sorted.map((c) => c.display_name)).toEqual(['Ada', 'Ålund', 'Bob']);
	});

	it('places the # bucket after Z', () => {
		const sorted = sortContacts([contact('1st Bank'), contact('Zoe'), contact('Ada')]);

		expect(sorted.map((c) => c.display_name)).toEqual(['Ada', 'Zoe', '1st Bank']);
	});

	it('does not mutate the input array', () => {
		const input = [contact('Zoe'), contact('Ada')];
		sortContacts(input);

		expect(input.map((c) => c.display_name)).toEqual(['Zoe', 'Ada']);
	});

	it('breaks ties by id so ordering is stable across reloads', () => {
		const sorted = sortContacts([
			{ id: 'b', display_name: 'Ada' },
			{ id: 'a', display_name: 'Ada' },
		]);

		expect(sorted.map((c) => c.id)).toEqual(['a', 'b']);
	});
});

describe('buildIndex', () => {
	it('reports every letter, marking which ones have contacts', () => {
		const index = buildIndex(sortContacts([contact('Ada'), contact('Zoe')]));

		expect(index).toHaveLength(27);
		expect(index.find((e) => e.letter === 'A')).toMatchObject({ count: 1, firstId: 'Ada' });
		expect(index.find((e) => e.letter === 'B')).toMatchObject({ count: 0, firstId: null });
		expect(index.find((e) => e.letter === 'Z')).toMatchObject({ count: 1, firstId: 'Zoe' });
	});

	it('points each letter at its first contact', () => {
		const index = buildIndex(sortContacts([contact('Bea'), contact('Ada'), contact('Amy')]));

		expect(index.find((e) => e.letter === 'A')).toMatchObject({ count: 2, firstId: 'Ada' });
	});

	it('counts the # bucket', () => {
		const index = buildIndex(sortContacts([contact('1st Bank'), contact('+31 6')]));

		expect(index.find((e) => e.letter === '#')).toMatchObject({ count: 2 });
	});

	it('reports every letter empty for an empty contact list', () => {
		const index = buildIndex([]);

		expect(index).toHaveLength(27);
		expect(index.every((e) => e.count === 0 && e.firstId === null)).toBe(true);
	});
});

describe('resolveJumpTarget', () => {
	const index = buildIndex(sortContacts([contact('Ada'), contact('Mia'), contact('Zoe')]));

	it('lands on the requested letter when it has contacts', () => {
		expect(resolveJumpTarget(index, 'M')).toMatchObject({ letter: 'M', firstId: 'Mia' });
	});

	it('skips forward to the next populated letter across a gap', () => {
		// Dragging over empty letters should still move the list, not feel dead.
		expect(resolveJumpTarget(index, 'B')).toMatchObject({ letter: 'M' });
	});

	it('falls back to the nearest populated letter behind when nothing follows', () => {
		expect(resolveJumpTarget(index, '#')).toMatchObject({ letter: 'Z' });
	});

	it('returns null when there are no contacts at all', () => {
		expect(resolveJumpTarget(buildIndex([]), 'A')).toBe(null);
	});

	it('returns null for a letter that is not on the track', () => {
		expect(resolveJumpTarget(index, '!')).toBe(null);
	});
});

describe('letterAtRatio', () => {
	it('maps the left edge to A and the right edge to #', () => {
		expect(letterAtRatio(0)).toBe('A');
		expect(letterAtRatio(1)).toBe('#');
	});

	it('maps the middle of the track to a middle letter', () => {
		expect(letterAtRatio(0.5)).toBe('N');
	});

	it('clamps out-of-range positions rather than returning undefined', () => {
		// Dragging past either end of the track must stay on the end letter.
		expect(letterAtRatio(-0.4)).toBe('A');
		expect(letterAtRatio(2)).toBe('#');
	});
});

describe('ratioForLetter', () => {
	it('is the inverse of letterAtRatio for every letter', () => {
		for (const letter of LETTERS) {
			expect(letterAtRatio(ratioForLetter(letter))).toBe(letter);
		}
	});

	it('returns 0 for an unknown letter rather than NaN', () => {
		expect(ratioForLetter('!')).toBe(0);
	});
});

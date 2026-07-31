// Pure helpers behind the A–Z scrubber and the sorted contact list.
//
// Everything here is framework-free and deterministic so the ordering rules —
// which are easy to get subtly wrong around case, accents and non-alphabetic
// names — are pinned by unit tests rather than eyeballed in the browser.

// Left to right along the scrubber track. '#' collects everything that does not
// start with a letter, and sits after Z.
export const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

const OTHER = '#';

/**
 * Strip accents and case so 'Ålund' and 'alund' compare and group identically.
 * NFD splits a letter into base + combining mark; dropping the marks leaves the
 * base letter. Ø has no decomposition, so it is mapped explicitly.
 */
// U+0300–U+036F is the combining diacritical marks block that NFD splits off.
const COMBINING_MARKS = /[̀-ͯ]/g;

function fold(name) {
	return String(name ?? '')
		.trim()
		.normalize('NFD')
		.replace(COMBINING_MARKS, '')
		.replace(/ø/gi, 'o')
		.replace(/æ/gi, 'ae')
		.replace(/ß/g, 'ss')
		.toUpperCase();
}

/** The scrubber bucket a contact belongs to: 'A'–'Z', or '#'. */
export function bucketFor(contact) {
	const first = fold(contact?.display_name).charAt(0);

	return first >= 'A' && first <= 'Z' ? first : OTHER;
}

/**
 * Sort by folded display name, with the '#' bucket after Z. Ties break on id so
 * the order is stable across reloads (two contacts can share a display name).
 */
export function sortContacts(contacts) {
	return [...contacts].sort((a, b) => {
		const bucketDelta = LETTERS.indexOf(bucketFor(a)) - LETTERS.indexOf(bucketFor(b));
		if (bucketDelta !== 0) {
			return bucketDelta;
		}

		const nameDelta = fold(a.display_name).localeCompare(fold(b.display_name));

		return nameDelta !== 0 ? nameDelta : String(a.id).localeCompare(String(b.id));
	});
}

/**
 * Describe every letter for the scrubber: how many contacts it holds and which
 * contact to jump to. Letters with no contacts are still returned (count 0) —
 * the track always shows the full alphabet, it just dims the empty letters.
 *
 * Expects an already-sorted list (see sortContacts), so the first match per
 * bucket is the one to scroll to.
 */
export function buildIndex(sortedContacts) {
	return LETTERS.map((letter) => {
		const inBucket = sortedContacts.filter((c) => bucketFor(c) === letter);

		return {
			letter,
			count: inBucket.length,
			firstId: inBucket.length > 0 ? inBucket[0].id : null,
		};
	});
}

/**
 * Which letter a jump to `letter` should actually land on.
 *
 * Most alphabets have gaps — dragging across a stretch of empty letters should
 * still move the list rather than feel dead. So we take the requested letter if
 * it has contacts, else the next letter forward that does, else the nearest one
 * back. Returns null only when there are no contacts at all.
 */
export function resolveJumpTarget(index, letter) {
	const start = LETTERS.indexOf(letter);
	if (start < 0) {
		return null;
	}

	const at = (i) => index.find((e) => e.letter === LETTERS[i]);

	for (let i = start; i < LETTERS.length; i += 1) {
		if (at(i)?.count > 0) {
			return at(i);
		}
	}

	for (let i = start - 1; i >= 0; i -= 1) {
		if (at(i)?.count > 0) {
			return at(i);
		}
	}

	return null;
}

/** Map a 0–1 position along the track to a letter, clamping past either end. */
export function letterAtRatio(ratio) {
	const clamped = Math.min(Math.max(ratio, 0), 1);
	const index = Math.min(Math.floor(clamped * LETTERS.length), LETTERS.length - 1);

	return LETTERS[index];
}

/** The centre position of a letter along the track. Inverse of letterAtRatio. */
export function ratioForLetter(letter) {
	const index = LETTERS.indexOf(letter);

	return index < 0 ? 0 : (index + 0.5) / LETTERS.length;
}

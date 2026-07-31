<script setup>
// Horizontal A–Z scrubber pinned to the bottom of the contact list. A on the
// left, Z on the right, '#' last. Works three ways: click a letter, drag along
// the track, or focus it and use the arrow keys.
//
// The letter↔position maths lives in lib/alphabet.js so it can be unit-tested;
// this component only turns pointer/keyboard input into a letter and emits it.

import { computed, ref } from 'vue';

import { LETTERS, letterAtRatio } from '../lib/alphabet.js';

const props = defineProps({
	// One entry per letter: { letter, count, firstId }.
	index: { type: Array, required: true },
	active: { type: String, default: '' },
});

const emit = defineEmits(['jump']);

const track = ref(null);
const dragging = ref(false);

const activeIndex = computed(() => LETTERS.indexOf(props.active));

function letterFromEvent(event) {
	const rect = track.value?.getBoundingClientRect();
	if (!rect || rect.width === 0) {
		return null;
	}

	return letterAtRatio((event.clientX - rect.left) / rect.width);
}

function jump(letter) {
	if (letter) {
		emit('jump', letter);
	}
}

function onPointerDown(event) {
	dragging.value = true;
	// Keep receiving move events even if the finger slides off the track.
	track.value?.setPointerCapture?.(event.pointerId);
	jump(letterFromEvent(event));
}

function onPointerMove(event) {
	if (dragging.value) {
		jump(letterFromEvent(event));
	}
}

function onPointerUp(event) {
	dragging.value = false;
	track.value?.releasePointerCapture?.(event.pointerId);
}

function onKeydown(event) {
	const step = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[event.key];
	if (step === undefined) {
		return;
	}

	event.preventDefault();
	const from = activeIndex.value < 0 ? 0 : activeIndex.value;
	const next = Math.min(Math.max(from + step, 0), LETTERS.length - 1);
	jump(LETTERS[next]);
}
</script>

<template>
	<div
		ref="track"
		class="scrubber"
		role="group"
		aria-label="Jump to letter"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerUp"
		@pointercancel="onPointerUp"
	>
		<button
			v-for="entry in index"
			:key="entry.letter"
			class="scrubber__letter"
			:class="{ 'is-empty': entry.count === 0, 'is-active': entry.letter === active }"
			:aria-label="`${entry.letter}, ${entry.count} ${entry.count === 1 ? 'contact' : 'contacts'}`"
			:aria-current="entry.letter === active ? 'true' : undefined"
			type="button"
			@click="jump(entry.letter)"
			@keydown="onKeydown"
		>
			{{ entry.letter }}
		</button>
	</div>
</template>

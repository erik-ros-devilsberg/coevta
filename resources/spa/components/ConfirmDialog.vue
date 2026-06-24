<script setup>
// Reusable confirm-delete dialog. Parent controls visibility via `open` and
// reacts to `confirm` / `cancel`.
defineProps({
	open: { type: Boolean, default: false },
	message: { type: String, default: 'Are you sure?' },
	confirmLabel: { type: String, default: 'Delete' },
});

const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
	<div v-if="open" class="modal" role="dialog" aria-modal="true" @keydown.esc="emit('cancel')">
		<div class="modal__dialog">
			<p>{{ message }}</p>
			<div class="modal__actions">
				<button class="btn btn--ghost btn--sm" type="button" @click="emit('cancel')">Cancel</button>
				<button class="btn btn--primary btn--sm" type="button" @click="emit('confirm')">{{ confirmLabel }}</button>
			</div>
		</div>
	</div>
</template>

// Live connection state. The PWA is usable offline, so the UI has to say which
// mode it is in rather than leaving the user guessing why saving is disabled.
//
// navigator.onLine only tells us the device has *a* network, not that the API is
// reachable — good enough to drive the banner and to decide when to retry.

import { onMounted, onUnmounted, ref } from 'vue';

export function useOnline() {
	const online = ref(globalThis.navigator?.onLine ?? true);

	const goOnline = () => {
		online.value = true;
	};
	const goOffline = () => {
		online.value = false;
	};

	onMounted(() => {
		globalThis.addEventListener?.('online', goOnline);
		globalThis.addEventListener?.('offline', goOffline);
	});

	onUnmounted(() => {
		globalThis.removeEventListener?.('online', goOnline);
		globalThis.removeEventListener?.('offline', goOffline);
	});

	return online;
}

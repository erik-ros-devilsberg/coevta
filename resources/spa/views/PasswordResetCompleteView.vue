<script setup>
// Reset is an account-level action, not an app-level one: one credential backs
// Contacts, Tasks and Calendar, and the API revokes every Sanctum token on
// reset. This page exists to say that plainly and to hand the user back to
// whichever app they started from — a PWA user arrives here from a browser tab
// outside their app's service worker scope.

import { clearToken } from '../../shared/lib/api.js';

// The server has already revoked the tokens; drop the origin-wide local copy so
// the sign-out is real here too. Without this the route guards (which only test
// that a token exists) would let an app render before its first request 401s.
clearToken();
</script>

<template>
	<main class="container app-view">
		<p class="wordmark">coevta</p>

		<h1>Your password has been reset</h1>

		<p class="notice">
			Your new password applies to your whole account. You have been signed out
			of every app, so sign in again with the new password.
		</p>

		<!-- Plain anchors, not router-links: each app is a separate installable
		     PWA with its own service worker scope, so these must be real
		     navigations out of this SPA rather than in-app routing. -->
		<p class="mt-2"><a href="/contacts/">Go to Contacts</a></p>
		<p class="mt-2"><a href="/tasks/">Go to Tasks</a></p>
		<p class="mt-2"><a href="/calendar/">Go to Calendar</a></p>

		<p class="mt-2">
			<router-link to="/login">Back to log in</router-link>
		</p>
	</main>
</template>
